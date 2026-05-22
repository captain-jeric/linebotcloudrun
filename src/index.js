const express = require("express");
const line = require("@line/bot-sdk");
const crypto = require("crypto");

const { PORT, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, LOG_FULL_WEBHOOK_BODY } = require("./config");
const { normalizeCode } = require("./lang");
const { resolveExpiryDateFromDuration, normalizeExpiryDate, parseNonNegativeInteger } = require("./utils");
const { supabase } = require("./config");
const { findUserByLineUserId, loadAdminData } = require("./db");
const { normalizeUserInput, buildUserUpdatePayload, validateUserInput } = require("./user");
const {
  requireAdmin, adminTokenFromRequest, isGoogleAdminConfigured,
  getGoogleRedirectUri, getCookie, buildCookie, createAdminSession,
} = require("./auth");
const { ADMIN_ALLOWED_EMAILS } = require("./config");
const {
  renderAdminPage, renderAdminLogin, buildAdminRedirect,
  buildAdminRedirectWithOptions, buildAdminRedirectWithRenewUser, redactWebhookBody,
} = require("./admin-ui");
const { handleEvent } = require("./bot");
const { translationCache } = require("./translate");
const { ADMIN_SESSION_COOKIE, ADMIN_OAUTH_STATE_COOKIE } = require("./config");

const app = express();

// ── health check ──────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "line-translate-bot-userid",
    cacheSize: translationCache.size,
    database: "supabase",
  });
});

// ── admin auth ────────────────────────────────────────────────────────────────

app.use("/admin", express.urlencoded({ extended: false }));

app.get("/admin/login/google", (req, res) => {
  if (!isGoogleAdminConfigured()) {
    res.redirect(buildAdminRedirect("", "Google 登录尚未配置。"));
    return;
  }
  const state = crypto.randomBytes(24).toString("base64url");
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getGoogleRedirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.setHeader("Set-Cookie", buildCookie(ADMIN_OAUTH_STATE_COOKIE, state, 600));
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get("/admin/auth/google/callback", async (req, res) => {
  try {
    if (!isGoogleAdminConfigured()) {
      res.redirect(buildAdminRedirect("", "Google 登录尚未配置。"));
      return;
    }
    const expectedState = getCookie(req, ADMIN_OAUTH_STATE_COOKIE);
    const actualState = String(req.query.state || "");
    const code = String(req.query.code || "");
    if (!code || !expectedState || actualState !== expectedState) {
      res.redirect(buildAdminRedirect("", "Google 登录状态无效，请重新登录。"));
      return;
    }
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: getGoogleRedirectUri(req), grant_type: "authorization_code",
      }),
    });
    const tokenBody = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenBody.access_token) {
      console.error("Google OAuth token exchange failed:", tokenBody);
      res.redirect(buildAdminRedirect("", "Google 登录失败，请查看服务日志。"));
      return;
    }
    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tokenBody.access_token}` },
    });
    const userInfo = await userResponse.json();
    const email = String(userInfo.email || "").toLowerCase();
    if (!userResponse.ok || userInfo.email_verified !== true || !ADMIN_ALLOWED_EMAILS.has(email)) {
      console.warn("Google admin login rejected:", { email, emailVerified: userInfo.email_verified, time: new Date().toISOString() });
      res.redirect(buildAdminRedirect("", "该 Google 账号不在管理员白名单中。"));
      return;
    }
    res.setHeader("Set-Cookie", [
      buildCookie(ADMIN_SESSION_COOKIE, createAdminSession(email), require("./config").ADMIN_SESSION_MAX_AGE_SECONDS),
      buildCookie(ADMIN_OAUTH_STATE_COOKIE, "", 0),
    ]);
    res.redirect("/admin");
  } catch (error) {
    console.error("Google admin login failed:", error);
    res.redirect(buildAdminRedirect("", "Google 登录失败，请稍后重试。"));
  }
});

app.get("/admin/logout", (_req, res) => {
  res.setHeader("Set-Cookie", buildCookie(ADMIN_SESSION_COOKIE, "", 0));
  res.redirect("/admin");
});

// ── admin pages ───────────────────────────────────────────────────────────────

app.get("/admin", requireAdmin, async (req, res) => {
  try {
    const data = await loadAdminData(req.query.renew_userid || "", req.query.search || "", req.query.conversation_search || "");
    res.status(200).send(renderAdminPage({
      ...data,
      token: adminTokenFromRequest(req),
      message: req.query.message || "",
      adminEmail: req.adminEmail,
    }));
  } catch (error) {
    console.error("Load admin page failed:", error);
    res.status(500).send("管理页面加载失败，请查看服务日志。");
  }
});

app.post("/admin/users", requireAdmin, async (req, res) => {
  const token = adminTokenFromRequest(req);
  const input = normalizeUserInput(req.body);
  const validationError = validateUserInput(input);
  if (validationError) { res.redirect(buildAdminRedirect(token, validationError)); return; }

  const { data: user, error } = await supabase.from("users").insert(input).select("id, expires_at").single();
  if (error) {
    console.error("Create user failed:", error);
    res.redirect(buildAdminRedirect(token, `创建失败：${error.message}`));
    return;
  }
  const { error: renewalError } = await supabase.from("user_renewals").insert({
    user_id: user.id, type: "purchase", chars_delta: input.quota_chars,
    expires_at_before: null, expires_at_after: input.expires_at,
    note: input.notes || `初始购买 ${input.quota_chars} 字符，有效期 1 年`,
  });
  if (renewalError) console.warn("Record purchase failed:", renewalError.message);
  res.redirect(buildAdminRedirect(token, "用户已创建。"));
});

app.post("/admin/users/:id", requireAdmin, async (req, res) => {
  const token = adminTokenFromRequest(req);
  const { data: existing, error: loadError } = await supabase.from("users").select("*").eq("id", req.params.id).single();
  if (loadError || !existing) {
    res.redirect(buildAdminRedirect(token, `保存失败：${loadError?.message || "找不到该用户"}`));
    return;
  }
  const input = normalizeUserInput(req.body, existing);
  const validationError = validateUserInput(input);
  if (validationError) { res.redirect(buildAdminRedirect(token, validationError)); return; }

  const { error } = await supabase.from("users").update(buildUserUpdatePayload(input)).eq("id", existing.id);
  if (error) {
    console.error("Update user failed:", error);
    res.redirect(buildAdminRedirect(token, `保存失败：${error.message}`));
    return;
  }
  res.redirect(buildAdminRedirectWithOptions(token, "用户信息已保存。", { renewUserId: input.line_user_id }));
});

app.post("/admin/users/:id/recharge", requireAdmin, async (req, res) => {
  const token = adminTokenFromRequest(req);
  const lineUserId = String(req.body.line_user_id || "").trim();
  const rechargeChars = parseNonNegativeInteger(req.body.recharge_chars);
  const note = String(req.body.note || "").trim();

  if (rechargeChars <= 0) { res.redirect(buildAdminRedirectWithRenewUser(token, "充值流量必须大于 0。", lineUserId)); return; }

  const { data: user, error: loadError } = await supabase.from("users").select("id, line_user_id").eq("id", req.params.id).single();
  if (loadError || !user) {
    res.redirect(buildAdminRedirectWithRenewUser(token, `充值失败：${loadError?.message || "找不到该用户"}`, lineUserId));
    return;
  }

  const nextExpiryDate = resolveExpiryDateFromDuration({ expiry_months: req.body.recharge_months, expires_at: req.body.expires_at }, 12);
  if (Number.isNaN(new Date(normalizeExpiryDate(nextExpiryDate)).getTime())) {
    res.redirect(buildAdminRedirectWithRenewUser(token, "充值后有效期格式不正确。", lineUserId));
    return;
  }

  const { data: rechargeData, error: updateError } = await supabase.rpc("recharge_user_flow", {
    p_user_id: user.id, p_chars: rechargeChars, p_expires_at: normalizeExpiryDate(nextExpiryDate),
  });
  const rechargeResult = Array.isArray(rechargeData) ? rechargeData[0] : null;
  if (updateError || !rechargeResult) {
    console.error("Recharge user failed:", updateError);
    res.redirect(buildAdminRedirectWithRenewUser(token, `充值失败：${updateError?.message || "更新用户失败"}`, user.line_user_id));
    return;
  }

  const { error: renewalError } = await supabase.from("user_renewals").insert({
    user_id: user.id, type: "recharge", chars_delta: rechargeChars,
    expires_at_before: rechargeResult.expires_at_before, expires_at_after: rechargeResult.expires_at,
    note: note || `流量充值 ${rechargeChars} 字符，有效期设置为 ${nextExpiryDate}`,
  });
  if (renewalError) console.warn("Record recharge failed:", renewalError.message);
  res.redirect(buildAdminRedirectWithRenewUser(token, "流量充值已完成。", user.line_user_id));
});

app.post("/admin/conversations/:id", requireAdmin, async (req, res) => {
  const token = adminTokenFromRequest(req);
  const action = String(req.body.action || "save");

  if (action === "unbind") {
    const { error } = await supabase.from("conversation_users").delete().eq("id", req.params.id);
    if (error) {
      console.error("Unbind conversation failed:", error);
      res.redirect(buildAdminRedirectWithOptions(token, `解绑失败：${error.message}`, { hash: "conversations" }));
      return;
    }
    res.redirect(buildAdminRedirectWithOptions(token, "群聊绑定已解绑。", { hash: "conversations" }));
    return;
  }

  const lineUserId = String(req.body.line_user_id || "").trim();
  const translationEnabled = String(req.body.translation_enabled || "true") === "true";
  const mode = String(req.body.mode || "").trim();
  const fromLang = req.body.from_lang ? normalizeCode(req.body.from_lang) : "";
  const toLang = req.body.to_lang ? normalizeCode(req.body.to_lang) : "";
  const validModes = new Set(["", "bilingual", "trilingual"]);
  const { ADMIN_LANGUAGE_OPTIONS } = require("./lang");
  const validLangs = new Set(["", ...ADMIN_LANGUAGE_OPTIONS]);

  if (!validModes.has(mode)) { res.redirect(buildAdminRedirectWithOptions(token, "保存失败：群聊模式不正确。", { hash: "conversations" })); return; }
  if (!validLangs.has(fromLang) || !validLangs.has(toLang)) { res.redirect(buildAdminRedirectWithOptions(token, "保存失败：群聊语言不正确。", { hash: "conversations" })); return; }
  if (mode !== "trilingual" && fromLang && toLang && fromLang === toLang) { res.redirect(buildAdminRedirectWithOptions(token, "保存失败：默认语言和互译语言不能相同。", { hash: "conversations" })); return; }

  const updatePayload = {
    translation_enabled: translationEnabled,
    mode: mode || null, from_lang: fromLang || null, to_lang: toLang || null,
    updated_at: new Date().toISOString(),
  };

  if (lineUserId) {
    const user = await findUserByLineUserId(lineUserId);
    if (!user) { res.redirect(buildAdminRedirectWithOptions(token, `保存失败：找不到 USERID ${lineUserId}`, { hash: "conversations" })); return; }
    updatePayload.user_id = user.id;
  }

  const { error } = await supabase.from("conversation_users").update(updatePayload).eq("id", req.params.id);
  if (error) {
    console.error("Update conversation binding failed:", error);
    res.redirect(buildAdminRedirectWithOptions(token, `保存失败：${error.message}`, { hash: "conversations" }));
    return;
  }
  res.redirect(buildAdminRedirectWithOptions(token, "群聊绑定已保存。", { hash: "conversations" }));
});

// ── webhook ───────────────────────────────────────────────────────────────────

app.post("/webhook", line.middleware({ channelSecret: process.env.LINE_CHANNEL_SECRET }), async (req, res) => {
  try {
    const events = req.body.events || [];
    console.log("Webhook received:", { eventCount: events.length, time: new Date().toISOString() });
    if (LOG_FULL_WEBHOOK_BODY) {
      console.log("Webhook body:");
      console.log(JSON.stringify(redactWebhookBody(req.body), null, 2));
    }
    await Promise.all(
      events.map(async (event) => {
        try {
          await handleEvent(event);
        } catch (error) {
          console.error("Event handling failed:", {
            error: error.message, stack: error.stack, eventType: event?.type,
            sourceType: event?.source?.type, groupId: event?.source?.groupId,
            roomId: event?.source?.roomId, userId: event?.source?.userId,
            time: new Date().toISOString(),
          });
        }
      })
    );
    res.status(200).end();
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).end();
  }
});

// ── error handler & server ────────────────────────────────────────────────────

app.use((error, _req, res, _next) => {
  console.error("Application error:", error);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, message: "Internal Server Error" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LINE translate bot running on port ${PORT}`);
  console.log(`Bot user ID configured: ${require("./config").BOT_USER_ID ? "yes" : "no"}`);
});

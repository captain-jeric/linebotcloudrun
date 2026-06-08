const { BILLING_TIME_ZONE } = require("./config");
const { normalizeCode, getLangName, getLangShortLabel, ADMIN_LANGUAGE_OPTIONS } = require("./lang");
const { escapeHtml, formatDate, formatDateInput, formatNumber, getBangkokDateString, addMonthsToDateString, parsePositiveInteger } = require("./utils");
const {
  getQuotaChars, getUsedChars, getStoredRemainingChars, isUserExpired,
  hasConversationTranslationConfig, getEffectiveTranslationConfig,
} = require("./user");
const { BILLING_PLANS } = require("./billing");

// ── URL builders ─────────────────────────────────────────────────────────────

function buildAdminRedirect(token, message) {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (message) params.set("message", message);
  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

function buildAdminRedirectWithOptions(token, message, options = {}) {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (message) params.set("message", message);
  if (options.search) params.set("search", options.search);
  if (options.limit) params.set("limit", options.limit);
  if (options.renewUserId) params.set("renew_userid", options.renewUserId);
  const query = params.toString();
  const hash = options.hash ? `#${options.hash}` : "";
  return `${query ? `/admin?${query}` : "/admin"}${hash}`;
}

function buildAdminRedirectWithRenewUser(token, message, lineUserId) {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (message) params.set("message", message);
  if (lineUserId) params.set("renew_userid", lineUserId);
  const query = params.toString();
  return `${query ? `/admin?${query}` : "/admin"}#recharge`;
}

function buildAdminRedirectWithQuickUser(token, message, lineUserId) {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (message) params.set("message", message);
  if (lineUserId) params.set("quick_userid", lineUserId);
  const query = params.toString();
  return `${query ? `/admin?${query}` : "/admin"}#quick-manage`;
}

// ── select renderers ──────────────────────────────────────────────────────────

function renderQuotaOptions(selectedValue = 100000) {
  const selected = Number(selectedValue || 0);
  const values = new Set(BILLING_PLANS.map((plan) => plan.chars));
  for (let value = 100000; value <= 1000000; value += 100000) {
    values.add(value);
  }
  return [...values]
    .sort((a, b) => a - b)
    .map((value) => `<option value="${value}" ${selected === value ? "selected" : ""}>${formatNumber(value)} 字符</option>`)
    .join("");
}

function renderBillingPlanOptions(selectedValue = "") {
  const selected = String(selectedValue || "");
  return [
    `<option value="" ${selected ? "" : "selected"}>自定义流量</option>`,
    ...BILLING_PLANS.map((plan) => `<option value="${plan.id}" ${selected === plan.id ? "selected" : ""}>${escapeHtml(plan.label)}</option>`),
  ].join("");
}

function renderBillingRules() {
  return `<section class="panel billing-panel">
      <h2>计费规则</h2>
      <div class="plan-grid">
        ${BILLING_PLANS.map((plan) => `<div class="plan-card">
          <strong>${escapeHtml(plan.priceCny.toFixed(1))} 元 / 月</strong>
          <span>${formatNumber(plan.chars)} 字符</span>
          <small>套餐有效期 ${plan.months} 个月</small>
        </div>`).join("")}
      </div>
      <p class="meta">后台选择套餐时，会按规则写入字符数、1 个月有效期和充值记录备注；特殊调整请选“自定义流量”。</p>
    </section>`;
}

function renderMonthOptions(selectedValue = 12, includeBlank = false) {
  const selected = includeBlank && !selectedValue ? "" : parsePositiveInteger(selectedValue, 12);
  const options = [1, 3, 6, 9, 12]
    .map((value) => `<option value="${value}" ${selected === value ? "selected" : ""}>${value} 个月</option>`)
    .join("");
  if (!includeBlank) return options;
  return `<option value="" ${selected === "" ? "selected" : ""}>按月数调整</option>${options}`;
}

function renderLanguageOptions(selectedValue = "zh") {
  const selected = normalizeCode(selectedValue || "zh");
  return ADMIN_LANGUAGE_OPTIONS.map(
    (code) => `<option value="${code}" ${selected === code ? "selected" : ""}>${getLangShortLabel(code)}</option>`
  ).join("");
}

function renderOptionalLanguageOptions(selectedValue = "") {
  const selected = selectedValue ? normalizeCode(selectedValue) : "";
  return [
    `<option value="" ${selected ? "" : "selected"}>使用用户默认</option>`,
    ...ADMIN_LANGUAGE_OPTIONS.map(
      (code) => `<option value="${code}" ${selected === code ? "selected" : ""}>${getLangShortLabel(code)}</option>`
    ),
  ].join("");
}

function renderOptionalModeOptions(selectedValue = "") {
  const selected = String(selectedValue || "");
  return [
    `<option value="" ${selected ? "" : "selected"}>使用用户默认</option>`,
    `<option value="bilingual" ${selected === "bilingual" ? "selected" : ""}>双语模式</option>`,
    `<option value="trilingual" ${selected === "trilingual" ? "selected" : ""}>三语模式</option>`,
  ].join("");
}

function renderReadonlyMetric(label, value) {
  return `<div class="metric"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`;
}

function renderInlineMetric(label, value) {
  return `<div class="metric inline-metric"><b>${escapeHtml(label)}：</b><span>${escapeHtml(value)}</span></div>`;
}

// ── page sections ─────────────────────────────────────────────────────────────

function renderAdminLogin(errorMessage) {
  const { isGoogleAdminConfigured } = require("./auth");
  const { ADMIN_TOKEN } = require("./config");
  const googleConfigured = isGoogleAdminConfigured();
  const tokenConfigured = Boolean(ADMIN_TOKEN);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LINE 翻译机器人管理</title>
  <style>
    body { margin: 0; font-family: Arial, "PingFang SC", sans-serif; background: #f5f7fb; color: #172033; }
    main { max-width: 420px; margin: 12vh auto; padding: 24px; background: #fff; border: 1px solid #d9e0ea; border-radius: 8px; }
    label { display: block; font-size: 13px; color: #4b5870; margin-bottom: 8px; }
    input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #b7c2d1; border-radius: 6px; font-size: 15px; }
    button, .button { display: inline-block; margin-top: 14px; padding: 10px 14px; border: 0; border-radius: 6px; background: #1f6feb; color: #fff; font-weight: 700; cursor: pointer; text-decoration: none; }
    .secondary { background: #536078; }
    .error { color: #b42318; margin-bottom: 12px; }
    .meta { color: #536078; font-size: 13px; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>管理入口</h1>
    ${errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : ""}
    ${googleConfigured ? '<p><a class="button" href="/admin/login/google">使用 Google 账号登录</a></p>' : '<p class="meta">Google 登录尚未配置。请设置 GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET、SESSION_SECRET 和 ADMIN_ALLOWED_EMAILS。</p>'}
    ${tokenConfigured ? `<form method="get" action="/admin"><label for="token">备用 ADMIN_TOKEN</label><input id="token" name="token" type="password" autocomplete="current-password" ${googleConfigured ? "" : "autofocus"}><button class="secondary" type="submit">使用备用 token 进入</button></form>` : ""}
  </main>
</body>
</html>`;
}

function renderUserRows(users, token) {
  return (users || [])
    .map((user) => {
      const quotaChars = getQuotaChars(user);
      const usedChars = getUsedChars(user);
      const remainingChars = getStoredRemainingChars(user);
      const status = isUserExpired(user) ? "已过期" : user.status;
      const mode = user.mode === "trilingual" ? "三语模式" : "双语模式";
      const languages = user.mode === "trilingual"
        ? "中文 / ภาษาไทย / မြန်မာဘာသာ"
        : `${getLangName(user.from_lang)} ↔ ${getLangName(user.to_lang)}`;

      return `<details class="user">
        <summary>
          <span class="summary-main">
            <strong>${escapeHtml(user.name)}</strong>
            <code>${escapeHtml(user.line_user_id)}</code>
            <span class="badge ${isUserExpired(user) ? "danger-badge" : ""}">${isUserExpired(user) ? "expired" : escapeHtml(user.status)}</span>
          </span>
          <span class="summary-stats">有效期至 ${escapeHtml(formatDateInput(user.expires_at))} · 剩余 ${formatNumber(remainingChars)} 字符</span>
        </summary>
        <div class="user-body">
          <div class="metric-grid">
            ${renderReadonlyMetric("用户名", user.name)}
            ${renderReadonlyMetric("USERID", user.line_user_id)}
            ${renderReadonlyMetric("状态", status)}
            ${renderReadonlyMetric("有效期至", formatDate(user.expires_at))}
            ${renderReadonlyMetric("模式", mode)}
            ${renderReadonlyMetric("语言", languages)}
            ${renderReadonlyMetric("总购买字符", `${formatNumber(quotaChars)} 字符`)}
            ${renderReadonlyMetric("已用字符", `${formatNumber(usedChars)} 字符`)}
            ${renderReadonlyMetric("剩余字符", `${formatNumber(remainingChars)} 字符`)}
            ${renderReadonlyMetric("最近使用", formatDate(user.last_active_at))}
            ${renderReadonlyMetric("备注", user.notes || "-")}
          </div>
          <form method="post" action="/admin/users/${escapeHtml(user.id)}" class="edit-form">
            <input type="hidden" name="token" value="${escapeHtml(token)}">
            <div class="edit-grid">
              <label>USERID<input name="line_user_id" value="${escapeHtml(user.line_user_id)}" required></label>
              <label>用户名<input name="name" value="${escapeHtml(user.name)}" required></label>
              <label>状态<select name="status"><option value="active" ${user.status === "active" ? "selected" : ""}>active</option><option value="paused" ${user.status === "paused" ? "selected" : ""}>paused</option></select></label>
              <label>模式<select name="mode"><option value="bilingual" ${user.mode === "bilingual" ? "selected" : ""}>双语模式</option><option value="trilingual" ${user.mode === "trilingual" ? "selected" : ""}>三语模式</option></select></label>
              <label>默认语言<select name="from_lang">${renderLanguageOptions(user.from_lang)}</select></label>
              <label>互译语言<select name="to_lang">${renderLanguageOptions(user.to_lang)}</select></label>
              <label>总购买字符<input name="quota_chars" type="number" min="0" step="1" value="${quotaChars}" required></label>
              <label>已用字符<input name="used_chars" type="number" min="0" step="1" value="${usedChars}" required></label>
              <label>有效期<select name="expiry_months" data-expiry-months data-expiry-target="user-expiry-${escapeHtml(user.id)}">${renderMonthOptions("", true)}</select></label>
              <label>有效期至<input id="user-expiry-${escapeHtml(user.id)}" name="expires_at" type="date" value="${escapeHtml(formatDateInput(user.expires_at))}" required></label>
              <label class="wide">备注<input name="notes" value="${escapeHtml(user.notes || "")}"></label>
              <div class="form-actions edit-actions"><button type="submit">保存用户</button></div>
            </div>
          </form>
        </div>
      </details>`;
    })
    .join("");
}

function renderRenewalHistoryRows(renewalHistory) {
  if (!renewalHistory || renewalHistory.length === 0) {
    return '<p class="meta">暂无充值记录。</p>';
  }
  return `<div class="history-list">
    ${renewalHistory.map((item) => `<div class="history-row">
        <span>${escapeHtml(formatDate(item.created_at))}</span>
        <span>${escapeHtml(item.type)}</span>
        <span>${formatNumber(item.chars_delta)} 字符</span>
        <span>有效期：${escapeHtml(formatDate(item.expires_at_before))} → ${escapeHtml(formatDate(item.expires_at_after))}</span>
        <span>${escapeHtml(item.note || "-")}</span>
      </div>`).join("")}
  </div>`;
}

function renderRenewalPanel({ renewUser, renewUserId, renewUserNotFound, renewalHistory, token }) {
  const quotaChars = getQuotaChars(renewUser);
  const usedChars = getUsedChars(renewUser);
  const remainingChars = getStoredRemainingChars(renewUser);
  const nextExpiry = addMonthsToDateString(getBangkokDateString(), 1);
  const userStatus = renewUser ? (isUserExpired(renewUser) ? "已过期" : renewUser.status) : "";

  return `<section id="recharge" class="panel recharge-panel">
      <h2>流量充值</h2>
      <form method="get" action="/admin#recharge" class="lookup-form">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <label>USERID<input name="renew_userid" value="${escapeHtml(renewUserId || "")}" placeholder="输入 USERID 后检索" required></label>
        <button type="submit">检索</button>
      </form>
      ${renewUserNotFound ? `<p class="message error">找不到该 USERID：${escapeHtml(renewUserId)}</p>` : ""}
      ${renewUser ? `<div class="renew-user">
              <div class="renew-split">
                <div class="renew-metrics">
                  <div class="renew-metric-row single">${renderInlineMetric("USERID", renewUser.line_user_id)}</div>
                  <div class="renew-metric-row">${renderReadonlyMetric("用户名", renewUser.name)}${renderReadonlyMetric("状态", userStatus)}</div>
                  <div class="renew-metric-row">${renderReadonlyMetric("总购买字符", `${formatNumber(quotaChars)} 字符`)}${renderReadonlyMetric("剩余字符", `${formatNumber(remainingChars)} 字符`)}</div>
                  <div class="renew-metric-row">${renderReadonlyMetric("已用字符", `${formatNumber(usedChars)} 字符`)}${renderReadonlyMetric("有效期至", formatDate(renewUser.expires_at))}</div>
                  <div class="renew-metric-row">${renderReadonlyMetric("最近使用", formatDate(renewUser.last_active_at))}${renderReadonlyMetric("充值后有效期", `${nextExpiry}`)}</div>
                </div>
                <div class="renew-actions">
                  <form method="post" action="/admin/users/${escapeHtml(renewUser.id)}/recharge" class="renew-card">
                    <input type="hidden" name="token" value="${escapeHtml(token)}">
                    <input type="hidden" name="line_user_id" value="${escapeHtml(renewUser.line_user_id)}">
                    <h3>充值流量</h3>
                    <div class="renew-grid compact">
                      <label>计费套餐<select name="billing_plan" data-billing-plan data-chars-target="recharge-chars" data-months-target="recharge-months" data-expiry-target="recharge-expiry" data-note-target="recharge-note">${renderBillingPlanOptions("monthly_29_9_100000")}</select></label>
                      <label>增加流量<select id="recharge-chars" name="recharge_chars">${renderQuotaOptions(100000)}</select></label>
                      <label>套餐时长<select id="recharge-months" name="recharge_months" data-expiry-months data-expiry-target="recharge-expiry">${renderMonthOptions(1)}</select></label>
                      <label>充值后有效期<input id="recharge-expiry" name="expires_at" type="date" value="${escapeHtml(nextExpiry)}"></label>
                      <label class="wide">备注<input id="recharge-note" name="note" placeholder="收款/订单备注"></label>
                    </div>
                    <p class="meta">选择计费套餐时固定按 1 个月计算有效期；特殊日期或字符数请选“自定义流量”。</p>
                    <div class="form-actions recharge-actions"><button type="submit">提交充值</button></div>
                  </form>
                </div>
              </div>
              <h3>最近充值记录</h3>
              ${renderRenewalHistoryRows(renewalHistory)}
            </div>` : '<p class="meta">输入 USERID 并点击检索后，可查看用户基本信息并充值流量。</p>'}
    </section>`;
}

function renderQuickManagePanel({ quickUser, quickUserId, quickUserNotFound, token, quickMessage = "", quickMessageType = "success" }) {
  const defaultExpiry = addMonthsToDateString(getBangkokDateString(), 1);
  const quotaChars = getQuotaChars(quickUser);
  const usedChars = getUsedChars(quickUser);
  const remainingChars = getStoredRemainingChars(quickUser);
  const userStatus = quickUser ? (isUserExpired(quickUser) ? "已过期" : quickUser.status) : "";
  const messageClass = quickMessageType === "error" ? "message error" : "message";

  return `<section id="quick-manage" class="panel quick-panel">
      <h2>快速管理</h2>
      ${quickMessage ? `<div class="${messageClass}">${escapeHtml(quickMessage)}</div>` : ""}
      <form method="get" action="/admin#quick-manage" class="lookup-form">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <label>USERID<input name="quick_userid" value="${escapeHtml(quickUserId || "")}" placeholder="输入 USERID 后确认" required></label>
        <button type="submit">确定</button>
      </form>
      ${quickUserId && quickUser ? `<div class="quick-body">
          <div class="renew-metrics">
            <div class="renew-metric-row single">${renderInlineMetric("USERID", quickUser.line_user_id)}</div>
            <div class="renew-metric-row">${renderReadonlyMetric("用户名", quickUser.name)}${renderReadonlyMetric("状态", userStatus)}</div>
            <div class="renew-metric-row">${renderReadonlyMetric("总购买字符", `${formatNumber(quotaChars)} 字符`)}${renderReadonlyMetric("剩余字符", `${formatNumber(remainingChars)} 字符`)}</div>
            <div class="renew-metric-row">${renderReadonlyMetric("已用字符", `${formatNumber(usedChars)} 字符`)}${renderReadonlyMetric("有效期至", formatDate(quickUser.expires_at))}</div>
          </div>
          <form method="post" action="/admin/users/${escapeHtml(quickUser.id)}/recharge" class="quick-form">
            <input type="hidden" name="token" value="${escapeHtml(token)}">
            <input type="hidden" name="line_user_id" value="${escapeHtml(quickUser.line_user_id)}">
            <input type="hidden" name="quick_userid" value="${escapeHtml(quickUser.line_user_id)}">
            <div class="quick-grid">
              <label>计费套餐<select name="billing_plan" data-billing-plan data-chars-target="quick-recharge-chars" data-months-target="quick-recharge-months" data-expiry-target="quick-recharge-expiry" data-note-target="quick-recharge-note">${renderBillingPlanOptions("monthly_29_9_100000")}</select></label>
              <label>增加流量<select id="quick-recharge-chars" name="recharge_chars">${renderQuotaOptions(100000)}</select></label>
              <label>有效期<select id="quick-recharge-months" name="recharge_months" data-expiry-months data-expiry-target="quick-recharge-expiry">${renderMonthOptions(1)}</select></label>
              <label>有效期至<input id="quick-recharge-expiry" name="expires_at" type="date" value="${escapeHtml(defaultExpiry)}"></label>
              <label class="wide">备注<input id="quick-recharge-note" name="note" placeholder="收款/订单备注"></label>
              <div class="form-actions quick-actions"><button type="submit">提交充值</button></div>
            </div>
          </form>
        </div>` : ""}
      ${quickUserId && quickUserNotFound ? `<div class="quick-body">
          <p class="meta">该 USERID 不存在，请填写用户名、套餐和有效期后新增用户。</p>
          <form method="post" action="/admin/users" class="quick-form">
            <input type="hidden" name="token" value="${escapeHtml(token)}">
            <input type="hidden" name="quick_userid" value="${escapeHtml(quickUserId)}">
            <div class="quick-grid">
              <label>USERID<input name="line_user_id" value="${escapeHtml(quickUserId)}" required></label>
              <label>用户名<input name="name" placeholder="后台自定义名称" required></label>
              <label>计费套餐<select name="billing_plan" data-billing-plan data-chars-target="quick-create-quota" data-months-target="quick-create-months" data-expiry-target="quick-create-expiry" data-note-target="quick-create-note">${renderBillingPlanOptions("monthly_29_9_100000")}</select></label>
              <label>初始流量<select id="quick-create-quota" name="quota_chars">${renderQuotaOptions(100000)}</select></label>
              <label>有效期<select id="quick-create-months" name="expiry_months" data-expiry-months data-expiry-target="quick-create-expiry">${renderMonthOptions(1)}</select></label>
              <label>有效期至<input id="quick-create-expiry" name="expires_at" type="date" value="${escapeHtml(defaultExpiry)}"></label>
              <input type="hidden" name="status" value="active">
              <input type="hidden" name="mode" value="bilingual">
              <input type="hidden" name="from_lang" value="zh">
              <input type="hidden" name="to_lang" value="th">
              <input type="hidden" name="used_chars" value="0">
              <label class="wide">备注<input id="quick-create-note" name="notes" placeholder="收款/套餐/客户备注"></label>
              <div class="form-actions quick-actions"><button type="submit">新增用户</button></div>
            </div>
          </form>
        </div>` : ""}
      ${!quickUserId ? '<p class="meta">输入 USERID 并点击确定，系统会自动判断是新增用户还是为现有用户充值。</p>' : ""}
    </section>`;
}

function renderConversationRows(conversationBindings, token) {
  if (!conversationBindings || conversationBindings.length === 0) {
    return '<p class="meta">暂无群聊或多人聊天室绑定。</p>';
  }
  return `<div class="conversation-list">
    ${conversationBindings.map((binding) => {
      const user = binding.user;
      const config = getEffectiveTranslationConfig(user, binding);
      const configSource = hasConversationTranslationConfig(binding) ? "群聊设置" : "使用用户默认";
      const languageSummary = config.mode === "trilingual" ? "中文 / ภาษาไทย / မြန်မာဘာသာ" : `${getLangName(config.from_lang)} ↔ ${getLangName(config.to_lang)}`;
      return `<details class="conversation-item">
          <summary>
            <span class="summary-main">
              <strong>${binding.source_type === "group" ? "群聊" : "多人聊天室"}</strong>
              <code>${escapeHtml(binding.conversation_id)}</code>
              <span class="badge">${binding.translation_enabled === false ? "自动翻译关闭" : "自动翻译开启"}</span>
            </span>
            <span class="summary-stats">${escapeHtml(user ? `${user.name} / ${user.line_user_id}` : "未找到绑定用户")}</span>
          </summary>
          <div class="user-body">
            <div class="metric-grid">
              ${renderReadonlyMetric("绑定用户", user ? user.name : "-")}
              ${renderReadonlyMetric("USERID", user ? user.line_user_id : "-")}
              ${renderReadonlyMetric("绑定来源", binding.source_type)}
              ${renderReadonlyMetric("语言配置", configSource)}
              ${renderReadonlyMetric("模式", config.mode === "trilingual" ? "三语模式" : "双语模式")}
              ${renderReadonlyMetric("语言", languageSummary)}
              ${renderReadonlyMetric("更新时间", formatDate(binding.updated_at))}
            </div>
            <form method="post" action="/admin/conversations/${escapeHtml(binding.id)}" class="edit-form">
              <input type="hidden" name="token" value="${escapeHtml(token)}">
              <div class="edit-grid">
                <label>改绑到 USERID<input name="line_user_id" placeholder="留空则只切换开关/解绑"></label>
                <label>自动翻译<select name="translation_enabled"><option value="true" ${binding.translation_enabled !== false ? "selected" : ""}>开启</option><option value="false" ${binding.translation_enabled === false ? "selected" : ""}>关闭</option></select></label>
                <label>群聊模式<select name="mode">${renderOptionalModeOptions(binding.mode)}</select></label>
                <label>默认语言<select name="from_lang">${renderOptionalLanguageOptions(binding.from_lang)}</select></label>
                <label>互译语言<select name="to_lang">${renderOptionalLanguageOptions(binding.to_lang)}</select></label>
                <div class="form-actions edit-actions">
                  <button type="submit" name="action" value="save">保存绑定</button>
                  <button type="submit" name="action" value="unbind" class="secondary">解绑</button>
                </div>
              </div>
            </form>
          </div>
        </details>`;
    }).join("")}
  </div>`;
}

function renderAdminPage({ users, conversationBindings, renewUser, renewUserId, renewUserNotFound, renewalHistory, quickUser, quickUserId, quickUserNotFound, searchTerm, conversationSearchTerm, token, message, adminEmail }) {
  const defaultExpiry = addMonthsToDateString(getBangkokDateString(), 1);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LINE 翻译机器人管理</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: Arial, "PingFang SC", sans-serif; background: #f4f6fa; color: #172033; }
    header { background: #0f172a; color: #fff; padding: 18px 24px; }
    main { max-width: 1180px; margin: 0 auto; padding: 22px; }
    h1 { margin: 0; font-size: 22px; }
    h2 { font-size: 18px; margin: 24px 0 12px; }
    form { margin: 0; }
    .panel, .user { background: #fff; border: 1px solid #d9e0ea; border-radius: 8px; margin-bottom: 10px; }
    .panel { padding: 16px; }
    .recharge-panel, .quick-panel { scroll-margin-top: 14px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap: 14px; align-items: start; }
    .create-grid, .edit-grid { display: grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap: 12px 14px; align-items: start; }
    .wide { grid-column: span 2; }
    .full { grid-column: 1 / -1; }
    .inline-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: end; }
    .create-actions { grid-template-columns: minmax(0, calc(50% - 6px)) auto; justify-content: start; }
    label { display: flex; flex-direction: column; gap: 6px; min-width: 0; font-size: 13px; color: #4b5870; }
    input, select { box-sizing: border-box; width: 100%; height: 38px; padding: 8px 10px; border: 1px solid #b7c2d1; border-radius: 6px; font-size: 14px; line-height: 20px; background: #fff; }
    input[type="date"] { appearance: auto; cursor: pointer; }
    select { appearance: auto; cursor: pointer; }
    input[type="checkbox"] { width: 16px; height: 16px; padding: 0; flex: 0 0 auto; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; }
    button { width: 92px; min-width: 92px; height: 38px; padding: 0 13px; border: 0; border-radius: 6px; background: #1f6feb; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; white-space: nowrap; }
    button.secondary { background: #536078; }
    summary { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 14px; cursor: pointer; }
    summary::-webkit-details-marker { display: none; }
    .summary-main, .summary-stats { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .summary-stats { color: #536078; font-size: 13px; justify-content: flex-end; }
    .badge { background: #e8f2ff; color: #175cd3; border-radius: 999px; padding: 2px 8px; font-size: 12px; }
    .danger-badge { background: #fff1f0; color: #a8071a; }
    .user-body { border-top: 1px solid #e8edf3; padding: 14px; }
    .edit-form { border-top: 1px solid #e8edf3; margin-top: 14px; padding-top: 14px; }
    .renew-grid { display: grid; grid-template-columns: minmax(240px, 1.4fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(150px, 1fr); gap: 14px; align-items: start; }
    .renew-grid.compact { grid-template-columns: repeat(2, minmax(180px, 1fr)); }
    .lookup-form { display: grid; grid-template-columns: minmax(260px, calc(50% - 6px)) auto; gap: 12px; align-items: end; justify-content: start; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(160px, 1fr)); gap: 10px; margin-top: 14px; }
    .metric { background: #f8fafc; border: 1px solid #e8edf3; border-radius: 6px; padding: 9px 10px; min-height: 38px; box-sizing: border-box; }
    .metric b, .metric span { display: block; }
    .metric b { color: #4b5870; font-size: 12px; font-weight: 600; }
    .metric span { color: #172033; font-size: 14px; margin-top: 3px; overflow-wrap: anywhere; }
    .inline-metric { display: flex; align-items: center; gap: 0; min-height: 38px; }
    .inline-metric b, .inline-metric span { display: inline; margin-top: 0; white-space: nowrap; }
    .inline-metric span { overflow: hidden; text-overflow: ellipsis; }
    .renew-user { border-top: 1px solid #e8edf3; margin-top: 14px; padding-top: 14px; }
    .renew-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: stretch; }
    .renew-metrics { display: grid; gap: 10px; }
    .renew-metric-row { display: grid; grid-template-columns: repeat(2, minmax(150px, 1fr)); gap: 10px; }
    .renew-metric-row.single { grid-template-columns: 1fr; }
    .renew-metrics .metric { margin: 0; }
    .renew-actions { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
    .renew-card { min-height: 100%; border: 1px solid #e8edf3; border-radius: 8px; padding: 14px; background: #fbfcfe; box-sizing: border-box; }
    .renew-card h3 { margin: 0 0 12px; font-size: 16px; }
    .quick-body { border-top: 1px solid #e8edf3; margin-top: 14px; padding-top: 14px; display: grid; gap: 14px; }
    .quick-grid { display: grid; grid-template-columns: repeat(4, minmax(160px, 1fr)); gap: 12px 14px; align-items: start; }
    .quick-form { background: #fbfcfe; border: 1px solid #e8edf3; border-radius: 8px; padding: 14px; }
    .quick-actions { align-self: end; margin-top: 0; }
    .list-toolbar { display: flex; align-items: end; justify-content: space-between; gap: 14px; margin-top: 24px; flex-wrap: wrap; }
    .list-toolbar h2 { margin: 0; }
    .limit-form, .search-form { display: flex; align-items: end; gap: 10px; flex-wrap: nowrap; }
    .search-form label { width: min(420px, 100%); }
    .search-form button { flex: 0 0 auto; }
    .limit-form label { width: 130px; }
    .form-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 14px; }
    .recharge-actions { justify-content: flex-end; margin-top: 24px; }
    .check { display: inline-flex; flex-direction: row; align-items: center; gap: 8px; min-height: 38px; color: #4b5870; }
    .check input { width: 16px; }
    .meta { color: #536078; font-size: 13px; margin: 10px 0 0; }
    .message { background: #ecfdf3; border: 1px solid #abefc6; color: #067647; padding: 10px 12px; border-radius: 6px; margin-bottom: 14px; }
    .message.error { background: #fff1f0; border-color: #ffccc7; color: #a8071a; margin-top: 14px; }
    .plan-grid { display: grid; grid-template-columns: repeat(3, minmax(180px, 1fr)); gap: 12px; }
    .plan-card { display: grid; gap: 5px; background: #f8fafc; border: 1px solid #e8edf3; border-radius: 6px; padding: 12px; }
    .plan-card strong { color: #172033; font-size: 17px; }
    .plan-card span { color: #1f6feb; font-size: 14px; font-weight: 700; }
    .plan-card small { color: #536078; font-size: 12px; }
    .history-list, .conversation-list { display: grid; gap: 8px; margin-top: 10px; }
    .history-row { display: grid; grid-template-columns: 90px 90px 130px minmax(180px, 1fr) minmax(160px, 1fr); gap: 10px; padding: 9px 10px; background: #f8fafc; border: 1px solid #e8edf3; border-radius: 6px; font-size: 13px; }
    .conversation-item { background: #fff; border: 1px solid #d9e0ea; border-radius: 8px; }
    @media (max-width: 860px) {
      .grid, .create-grid, .edit-grid, .renew-grid, .renew-grid.compact, .lookup-form, .metric-grid, .renew-metric-row, .renew-actions, .renew-split, .inline-row, .create-actions, .quick-grid, .history-row, .plan-grid { grid-template-columns: 1fr; }
      .wide { grid-column: span 1; }
      .list-toolbar { align-items: stretch; flex-direction: column; }
      .limit-form, .search-form { align-items: stretch; }
      .limit-form label, .search-form label { width: 100%; }
      .search-form { flex-wrap: nowrap; }
      .search-form label { flex: 1 1 auto; }
      summary { align-items: flex-start; flex-direction: column; }
      .summary-stats { justify-content: flex-start; }
      main { padding: 14px; }
    }
  </style>
</head>
<body>
  <header><h1>LINE 翻译机器人管理</h1><p class="meta">当前管理员：${escapeHtml(adminEmail || "unknown")} · <a href="/admin/logout">退出</a></p></header>
  <main>
    ${message ? `<div class="message">${escapeHtml(message)}</div>` : ""}
    ${renderQuickManagePanel({ quickUser, quickUserId, quickUserNotFound, token })}
    ${renderBillingRules()}
    <section class="panel">
      <h2>新增用户</h2>
      <form method="post" action="/admin/users">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <div class="create-grid">
          <label>USERID<input name="line_user_id" placeholder="Uxxxxxxxxxxxxxxxx" required></label>
          <label>用户名<input name="name" placeholder="后台自定义名称" required></label>
          <label>计费套餐<select name="billing_plan" data-billing-plan data-chars-target="create-quota" data-months-target="create-months" data-expiry-target="create-expiry" data-note-target="create-note">${renderBillingPlanOptions("monthly_29_9_100000")}</select></label>
          <label>初始流量<select id="create-quota" name="quota_chars">${renderQuotaOptions(100000)}</select></label>
          <label>状态<select name="status"><option value="active">active</option><option value="paused">paused</option></select></label>
          <input type="hidden" name="mode" value="bilingual">
          <label>默认语言<select name="from_lang">${renderLanguageOptions("zh")}</select></label>
          <label>互译语言<select name="to_lang">${renderLanguageOptions("th")}</select></label>
          <label>有效期<select id="create-months" name="expiry_months" data-expiry-months data-expiry-target="create-expiry">${renderMonthOptions(1)}</select></label>
          <label>有效期至<input id="create-expiry" name="expires_at" type="date" value="${escapeHtml(defaultExpiry)}"></label>
          <input type="hidden" name="used_chars" value="0">
          <div class="full inline-row create-actions">
            <label>备注<input id="create-note" name="notes" placeholder="收款/套餐/客户备注"></label>
            <button type="submit">创建用户</button>
          </div>
        </div>
      </form>
    </section>
    ${renderRenewalPanel({ renewUser, renewUserId, renewUserNotFound, renewalHistory, token })}
    <div class="list-toolbar">
      <h2>用户管理</h2>
      <form method="get" action="/admin" class="search-form">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        ${renewUserId ? `<input type="hidden" name="renew_userid" value="${escapeHtml(renewUserId)}">` : ""}
        ${conversationSearchTerm ? `<input type="hidden" name="conversation_search" value="${escapeHtml(conversationSearchTerm)}">` : ""}
        <label>搜索用户<input name="search" value="${escapeHtml(searchTerm || "")}" placeholder="USERID / 用户名 / 备注"></label>
        <button type="submit" class="secondary">搜索</button>
      </form>
    </div>
    ${renderUserRows(users, token) || '<section class="panel">暂无用户。</section>'}
    <section id="conversations" class="panel">
      <h2>群聊绑定管理</h2>
      <form method="get" action="/admin#conversations" class="search-form">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        ${renewUserId ? `<input type="hidden" name="renew_userid" value="${escapeHtml(renewUserId)}">` : ""}
        ${searchTerm ? `<input type="hidden" name="search" value="${escapeHtml(searchTerm)}">` : ""}
        <label>搜索群聊ID<input name="conversation_search" value="${escapeHtml(conversationSearchTerm || "")}" placeholder="groupId / roomId"></label>
        <button type="submit" class="secondary">搜索</button>
      </form>
      ${renderConversationRows(conversationBindings, token)}
    </section>
  </main>
  <script>
    const expiryBaseDate = "${escapeHtml(getBangkokDateString())}";
    const billingPlans = ${JSON.stringify(BILLING_PLANS.map((plan) => ({
      id: plan.id,
      label: plan.label,
      chars: plan.chars,
      months: plan.months,
    })))};
    function formatBangkokDate(date) {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "${BILLING_TIME_ZONE}", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
      const year = parts.find((part) => part.type === "year")?.value || "";
      const month = parts.find((part) => part.type === "month")?.value || "";
      const day = parts.find((part) => part.type === "day")?.value || "";
      return year && month && day ? year + "-" + month + "-" + day : "";
    }
    function addMonthsToExpiryDate(dateString, months) {
      const base = new Date(dateString + "T12:00:00+07:00");
      const originalDay = base.getDate();
      const next = new Date(base);
      next.setMonth(next.getMonth() + Number.parseInt(months || "12", 10));
      if (next.getDate() !== originalDay) next.setDate(0);
      return formatBangkokDate(next);
    }
    function bindExpiryMonthSelects(root = document) {
      root.querySelectorAll("[data-expiry-months]").forEach((select) => {
        if (select.dataset.boundExpiry === "true") return;
        select.dataset.boundExpiry = "true";
        select.addEventListener("change", () => {
          const target = document.getElementById(select.dataset.expiryTarget || "");
          if (!select.value) return;
          if (target) target.value = addMonthsToExpiryDate(expiryBaseDate, select.value);
        });
      });
    }
    function bindBillingPlanSelects(root = document) {
      root.querySelectorAll("[data-billing-plan]").forEach((select) => {
        if (select.dataset.boundBilling === "true") return;
        select.dataset.boundBilling = "true";
        const applyPlan = () => {
          const plan = billingPlans.find((item) => item.id === select.value);
          if (!plan) return;
          const charsTarget = document.getElementById(select.dataset.charsTarget || "");
          const monthsTarget = document.getElementById(select.dataset.monthsTarget || "");
          const expiryTarget = document.getElementById(select.dataset.expiryTarget || "");
          const noteTarget = document.getElementById(select.dataset.noteTarget || "");
          if (charsTarget) charsTarget.value = String(plan.chars);
          if (monthsTarget) monthsTarget.value = String(plan.months);
          if (expiryTarget) expiryTarget.value = addMonthsToExpiryDate(expiryBaseDate, plan.months);
          if (noteTarget && !noteTarget.value.trim()) noteTarget.value = plan.label;
        };
        select.addEventListener("change", applyPlan);
        applyPlan();
      });
    }
    function bindDatePickers(root = document) {
      root.querySelectorAll('input[type="date"]').forEach((input) => {
        if (input.dataset.boundPicker === "true") return;
        input.dataset.boundPicker = "true";
        const openPicker = () => { if (typeof input.showPicker === "function") input.showPicker(); };
        input.addEventListener("click", openPicker);
        input.addEventListener("focus", openPicker);
      });
    }
    function getAdminToken() {
      return document.querySelector('#quick-manage input[name="token"]')?.value || "";
    }
    function setButtonLoading(button, isLoading, loadingText = "处理中") {
      if (!button) return;
      if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.textContent = loadingText;
        button.disabled = true;
      } else {
        button.textContent = button.dataset.originalText || button.textContent;
        button.disabled = false;
      }
    }
    async function replaceQuickPanel(lineUserId, message = "", messageType = "success") {
      const panel = document.getElementById("quick-manage");
      if (!panel) return;
      const params = new URLSearchParams();
      if (lineUserId) params.set("quick_userid", lineUserId);
      const token = getAdminToken();
      if (token) params.set("token", token);
      if (message) params.set("message", message);
      if (messageType) params.set("message_type", messageType);
      const response = await fetch("/admin/quick?" + params.toString(), {
        headers: { "x-quick-manage": "true" },
        credentials: "same-origin",
      });
      if (response.status === 401) throw new Error("需要重新登录");
      const html = await response.text();
      panel.outerHTML = html;
      const nextPanel = document.getElementById("quick-manage");
      bindAdminEnhancements(nextPanel || document);
    }
    function bindQuickManage(root = document) {
      const panel = root.id === "quick-manage" ? root : root.querySelector?.("#quick-manage");
      if (!panel || panel.dataset.boundQuick === "true") return;
      panel.dataset.boundQuick = "true";
      const lookupForm = panel.querySelector('form[method="get"]');
      lookupForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = lookupForm.querySelector('button[type="submit"]');
        const lineUserId = String(new FormData(lookupForm).get("quick_userid") || "").trim();
        if (!lineUserId) return;
        setButtonLoading(button, true, "查询中");
        try {
          await replaceQuickPanel(lineUserId);
          history.replaceState(null, "", "#quick-manage");
        } catch (error) {
          console.error(error);
          lookupForm.submit();
        } finally {
          setButtonLoading(button, false);
        }
      });
      panel.querySelectorAll('form[method="post"]').forEach((form) => {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const button = form.querySelector('button[type="submit"]');
          setButtonLoading(button, true, "提交中");
          try {
            const body = new URLSearchParams(new FormData(form));
            const response = await fetch(form.action, {
              method: "POST",
              headers: {
                "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
                "accept": "application/json",
                "x-quick-manage": "true",
              },
              body,
              credentials: "same-origin",
            });
            const result = await response.json();
            if (!response.ok || !result.ok) {
              await replaceQuickPanel(result.lineUserId || body.get("quick_userid") || body.get("line_user_id") || "", result.message || "操作失败，请稍后重试。", "error");
              return;
            }
            await replaceQuickPanel(result.lineUserId || body.get("line_user_id") || body.get("quick_userid") || "", result.message || "操作已完成。");
          } catch (error) {
            console.error(error);
            form.submit();
          } finally {
            setButtonLoading(button, false);
          }
        });
      });
    }
    function bindAdminEnhancements(root = document) {
      bindExpiryMonthSelects(root);
      bindBillingPlanSelects(root);
      bindDatePickers(root);
      bindQuickManage(root);
    }
    bindAdminEnhancements(document);
  </script>
</body>
</html>`;
}

function redactWebhookBody(body) {
  const clone = JSON.parse(JSON.stringify(body));
  for (const event of clone.events || []) {
    if (event?.source?.userId) event.source.userId = "[USER_ID]";
  }
  return clone;
}

module.exports = {
  buildAdminRedirect,
  buildAdminRedirectWithOptions,
  buildAdminRedirectWithRenewUser,
  buildAdminRedirectWithQuickUser,
  renderQuotaOptions,
  renderBillingPlanOptions,
  renderBillingRules,
  renderMonthOptions,
  renderLanguageOptions,
  renderOptionalLanguageOptions,
  renderOptionalModeOptions,
  renderReadonlyMetric,
  renderInlineMetric,
  renderAdminLogin,
  renderUserRows,
  renderRenewalHistoryRows,
  renderRenewalPanel,
  renderQuickManagePanel,
  renderConversationRows,
  renderAdminPage,
  redactWebhookBody,
};

const { BOT_USER_ID } = require("./config");
const { normalizeCode, TARGET_LANG_COMMANDS } = require("./lang");
const { logInfo, countChargeableChars } = require("./utils");
const {
  findUserByLineUserId, findConversationBinding, bindConversationToUser,
  unbindConversationIfUser, unbindConversation, setConversationTranslationEnabled,
  setConversationLanguageConfig, touchUser, chargeUserUsage,
} = require("./db");
const { isUserUsable, getRemainingChars, getEffectiveTranslationConfig, getBilingualTargetLang, isSupportedDefaultLang } = require("./user");
const {
  buildDirectedTranslationResult, buildTrilingualTranslationResult, detectLang,
} = require("./translate");
const {
  getConversationBindingKey, clearMemberCheckCache, isLineUserInConversation,
  reply, replyWithNotices, replyMessages, addOriginalQuote, pushConversationText,
} = require("./line");
const {
  getReplyLocale, getReplyLocaleFromLang,
  buildPublicHelpText, buildStatusText, buildUserUsageText, buildUserIdText, buildGroupIdText,
  buildNeedPermissionText, buildUserRejectedText, buildQuotaExceededText,
  buildConversationBoundText, buildConversationUnboundText, buildUserUnboundConversationText,
  buildConversationNotBoundText, buildUnbindPrivateText,
  buildSetToggleFailedText, buildSetToggleSuccessText,
  buildSetTrilingualFailedText, buildSetTrilingualSuccessText,
  buildSetLanguageFailedText, buildSetLanguageSuccessText,
  buildSameLanguageText, buildSameTranslationLanguageText, buildMissingTargetText,
  buildTranslateFailedText, buildSetHelpText, getUnsupportedLanguageTitle, getSetUsageTitle,
} = require("./i18n");
const { supabase } = require("./config");

// ── command detection ─────────────────────────────────────────────────────────

function isUserIdCommand(lower) {
  return lower === "userid" || lower === "/userid" || lower === "user id" || lower === "/user id";
}

function isGroupIdCommand(lower) {
  return lower === "/groupid" || lower === "groupid" || lower === "group id" || lower === "/group id";
}

function isStatusCommand(lower) {
  return lower === "/status" || lower === "/lang" || lower === "/状态";
}

function isUsageCommand(lower) {
  return lower === "/usage" || lower === "/用量";
}

function isUnbindCommand(lower) {
  return lower === "/unbind" || lower === "unbind" || lower === "/解绑" || lower === "解绑" || lower === "/解除绑定" || lower === "解除绑定";
}

function isHelpCommand(lower) {
  return lower === "/help" || lower === "help" || lower === "/帮助" || lower === "帮助";
}

function isSetCommand(lower) {
  return lower.startsWith("set ") || lower === "set";
}

function parseTargetLangCommand(text) {
  const match = text.trim().match(/^\/([a-z]{2})(?:\s+|$)([\s\S]*)$/i);
  if (!match) return null;
  const targetLang = TARGET_LANG_COMMANDS[match[1].toLowerCase()];
  if (!targetLang) return null;
  const body = String(match[2] || "").trim();
  if (!body) return { targetLang, text: "" };
  return { targetLang, text: body };
}

// ── stale binding check ───────────────────────────────────────────────────────

async function removeBindingIfUserLeftConversation(bindingKey, conversationBinding, reason) {
  const boundLineUserId = conversationBinding?.user?.line_user_id;
  if (!bindingKey || !conversationBinding?.userId || !boundLineUserId) return false;
  const isMember = await isLineUserInConversation(bindingKey, boundLineUserId);
  if (isMember) return false;
  return unbindConversationIfUser(bindingKey, conversationBinding.userId, reason, boundLineUserId);
}

// ── set command handler ───────────────────────────────────────────────────────

async function handleSetCommand(event, lower, user, options = {}) {
  const parts = lower.trim().split(/\s+/);
  const sub = parts[1];
  const bindingKey = options.bindingKey || null;
  const isConversationConfig = Boolean(bindingKey);
  const locale = options.locale || getReplyLocale(user);

  async function saveConfig(payload) {
    if (isConversationConfig) {
      return setConversationLanguageConfig(bindingKey, payload);
    }
    const { error } = await supabase
      .from("users")
      .update({ ...payload, updated_at: new Date().toISOString(), last_active_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) {
      console.error("Update user language config failed:", error);
      return false;
    }
    return true;
  }

  if (sub === "3lang") {
    const saved = await saveConfig({ mode: "trilingual", from_lang: "zh", to_lang: "th" });
    if (!saved) return reply(event, buildSetTrilingualFailedText(isConversationConfig, locale));
    await touchUser(user.id);
    return reply(event, buildSetTrilingualSuccessText(isConversationConfig, getReplyLocaleFromLang("zh")));
  }

  if (parts.length === 3) {
    const a = normalizeCode(parts[1]);
    const b = normalizeCode(parts[2]);
    if (!isSupportedDefaultLang(a) || !isSupportedDefaultLang(b)) {
      return reply(event, buildSetHelpText(getUnsupportedLanguageTitle(locale), locale));
    }
    if (a === b) return reply(event, buildSameLanguageText(locale));
    const saved = await saveConfig({ mode: "bilingual", from_lang: a, to_lang: b });
    if (!saved) return reply(event, buildSetLanguageFailedText(isConversationConfig, locale));
    await touchUser(user.id);
    return reply(event, buildSetLanguageSuccessText(isConversationConfig, a, b, getReplyLocaleFromLang(a)));
  }

  await touchUser(user.id);
  return reply(event, buildSetHelpText(getSetUsageTitle(locale), locale));
}

// ── event handlers ────────────────────────────────────────────────────────────

async function handleMemberLeftEvent(event) {
  const bindingKey = getConversationBindingKey(event);
  if (!bindingKey) return null;
  const leftLineUserIds = (event.left?.members || []).map((member) => member?.userId).filter(Boolean);
  if (leftLineUserIds.length === 0) return null;
  const conversationBinding = await findConversationBinding(bindingKey);
  const boundLineUserId = conversationBinding?.user?.line_user_id;
  if (!conversationBinding?.userId || !boundLineUserId) return null;
  if (!leftLineUserIds.includes(boundLineUserId)) return null;
  clearMemberCheckCache(bindingKey, boundLineUserId);
  const unbound = await unbindConversationIfUser(bindingKey, conversationBinding.userId, "bound_user_left_conversation_event", boundLineUserId);
  if (unbound) {
    await pushConversationText(bindingKey, buildConversationUnboundText(getReplyLocale(conversationBinding.user)));
  }
  return null;
}

async function handleEvent(event) {
  console.log("Incoming event:", {
    eventType: event.type,
    messageType: event.message?.type,
    sourceType: event.source?.type,
    groupId: event.source?.groupId,
    roomId: event.source?.roomId,
    userId: event.source?.userId,
    isRedelivery: event.deliveryContext?.isRedelivery,
    time: new Date().toISOString(),
  });

  if (event.type === "memberLeft") return handleMemberLeftEvent(event);
  if (event.type !== "message") return null;
  if (!event.message || event.message.type !== "text") return null;
  if (!["user", "group", "room"].includes(event.source?.type)) return null;
  if (event.deliveryContext?.isRedelivery) return null;

  const lineUserId = event.source?.userId || "";
  if (!lineUserId) return null;

  if (BOT_USER_ID && lineUserId === BOT_USER_ID) {
    console.log("Ignored bot self message:", { sourceType: event.source.type, userId: lineUserId, time: new Date().toISOString() });
    return null;
  }

  const text = event.message.text.trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  const unbindCommand = isUnbindCommand(lower);
  const targetCommand = parseTargetLangCommand(text);
  const actorUser = await findUserByLineUserId(lineUserId);
  const actorUserCheck = actorUser ? isUserUsable(actorUser) : { ok: false, reason: "not_found" };
  const bindingKey = getConversationBindingKey(event);
  const bindingNoticeMessages = [];

  let conversationBinding = bindingKey ? await findConversationBinding(bindingKey) : null;
  let removedStaleBinding = false;

  if (bindingKey && conversationBinding && actorUser?.id !== conversationBinding.userId) {
    removedStaleBinding = await removeBindingIfUserLeftConversation(bindingKey, conversationBinding, "bound_user_left_conversation_check");
    if (removedStaleBinding) conversationBinding = null;
  }

  if (bindingKey && actorUserCheck.ok && !conversationBinding && !unbindCommand) {
    const bindResult = await bindConversationToUser(bindingKey, actorUser.id);
    if (bindResult === "created") {
      bindingNoticeMessages.push({ type: "text", text: buildConversationBoundText(actorUser, removedStaleBinding, getReplyLocale(actorUser)) });
      conversationBinding = await findConversationBinding(bindingKey);
    }
  }

  const conversationTranslationEnabled = conversationBinding?.translationEnabled !== false;
  const user = actorUser || conversationBinding?.user || null;
  const translationConfig = getEffectiveTranslationConfig(user, conversationBinding);
  const replyLocale = getReplyLocale(user);

  if (isHelpCommand(lower)) return replyWithNotices(event, buildPublicHelpText(replyLocale), bindingNoticeMessages);
  if (isUserIdCommand(lower)) return replyWithNotices(event, buildUserIdText(lineUserId, user, replyLocale), bindingNoticeMessages);
  if (isGroupIdCommand(lower)) return replyWithNotices(event, buildGroupIdText(event, lineUserId, replyLocale), bindingNoticeMessages);
  if (isUsageCommand(lower)) return replyWithNotices(event, buildUserUsageText(user, lineUserId, replyLocale), bindingNoticeMessages);

  if (!user) {
    if (event.source?.type === "user") return reply(event, buildNeedPermissionText(lineUserId, replyLocale));
    if (isStatusCommand(lower) || isSetCommand(lower) || unbindCommand || targetCommand) {
      return reply(event, buildNeedPermissionText(lineUserId, replyLocale));
    }
    if (bindingKey) {
      console.log("Ignored group message without conversation binding:", {
        sourceType: bindingKey.sourceType, conversationId: bindingKey.conversationId,
        lineUserId, time: new Date().toISOString(),
      });
    }
    return null;
  }

  if (isStatusCommand(lower)) {
    return replyWithNotices(
      event,
      buildStatusText(event, user, { conversationTranslationEnabled, translationConfig, locale: replyLocale }),
      bindingNoticeMessages
    );
  }

  if (unbindCommand) {
    if (!bindingKey) return reply(event, buildUnbindPrivateText(replyLocale));
    const actorLocale = getReplyLocale(actorUser);
    if (!actorUser) return reply(event, buildNeedPermissionText(lineUserId, actorLocale));
    if (!actorUserCheck.ok) return reply(event, buildUserRejectedText(lineUserId, actorUserCheck.reason, actorUser, actorLocale));
    if (!conversationBinding) return reply(event, buildConversationNotBoundText(actorLocale));
    const unbound = await unbindConversation(bindingKey, "user_command");
    if (!unbound) return reply(event, buildConversationNotBoundText(actorLocale));
    clearMemberCheckCache(bindingKey, conversationBinding.user?.line_user_id || "");
    await touchUser(actorUser.id);
    return reply(event, buildUserUnboundConversationText(actorLocale));
  }

  if (isSetCommand(lower)) {
    const actorLocale = getReplyLocale(actorUser);
    if (!actorUser) return reply(event, buildNeedPermissionText(lineUserId, actorLocale));
    if (!actorUserCheck.ok) return reply(event, buildUserRejectedText(lineUserId, actorUserCheck.reason, actorUser, actorLocale));
    if (bindingKey && (lower === "set on" || lower === "set off")) {
      const enabled = lower === "set on";
      const updated = await setConversationTranslationEnabled(bindingKey, enabled);
      if (!updated) return reply(event, buildSetToggleFailedText(actorLocale));
      await touchUser(actorUser.id);
      return reply(event, buildSetToggleSuccessText(enabled, actorLocale));
    }
    return handleSetCommand(event, lower, actorUser, { bindingKey, locale: actorLocale });
  }

  const userCheck = isUserUsable(user);
  if (!userCheck.ok) {
    if (event.source?.type === "user" || targetCommand) {
      return reply(event, buildUserRejectedText(lineUserId, userCheck.reason, user, replyLocale));
    }
    return null;
  }

  if (text.startsWith("!") || text.startsWith("//")) return null;
  if (targetCommand && !targetCommand.text) return reply(event, buildMissingTargetText(targetCommand.targetLang, replyLocale));
  if (bindingKey && !conversationTranslationEnabled && !targetCommand) return null;

  const textToTranslate = targetCommand?.text || text;
  const mode = translationConfig.mode;
  const fromLang = translationConfig.from_lang;
  const toLang = translationConfig.to_lang;
  const chargeMultiplier = !targetCommand && mode === "trilingual" ? 2 : 1;
  const chargedChars = countChargeableChars(textToTranslate) * chargeMultiplier;

  if (getRemainingChars(user) < chargedChars) {
    return reply(event, buildQuotaExceededText(lineUserId, user, replyLocale));
  }

  const sourceLang = normalizeCode(await detectLang(textToTranslate));
  if (sourceLang === "und") return null;

  const bilingualTargetLang =
    !targetCommand && mode === "bilingual"
      ? getBilingualTargetLang(sourceLang, { from_lang: fromLang, to_lang: toLang })
      : null;

  logInfo("translation_attempt", {
    sourceLang,
    targetLang: targetCommand?.targetLang || "",
    resolvedTargetLang: targetCommand?.targetLang || bilingualTargetLang || "",
    mode,
    sourceType: event.source?.type,
    groupId: event.source?.groupId || "",
    roomId: event.source?.roomId || "",
    lineUserId,
    billingLineUserId: user.line_user_id,
    textLength: textToTranslate.length,
    chargedChars,
    time: new Date().toISOString(),
  });

  const translationResult =
    targetCommand
      ? await buildDirectedTranslationResult(textToTranslate, sourceLang, targetCommand.targetLang)
      : mode === "trilingual"
        ? await buildTrilingualTranslationResult(textToTranslate, sourceLang)
        : await buildDirectedTranslationResult(textToTranslate, sourceLang, bilingualTargetLang);
  const messages = translationResult.messages;

  if (messages.length === 0) {
    logInfo("translation_empty_result", {
      failureReason: translationResult.failureReason,
      sourceLang,
      targetLang: targetCommand?.targetLang || "",
      resolvedTargetLang: targetCommand?.targetLang || bilingualTargetLang || "",
      mode,
      sourceType: event.source?.type,
      groupId: event.source?.groupId || "",
      roomId: event.source?.roomId || "",
      lineUserId,
      billingLineUserId: user.line_user_id,
      textLength: textToTranslate.length,
      time: new Date().toISOString(),
    });
    if (event.source?.type === "user" || targetCommand) {
      if (translationResult.failureReason === "same_source_and_target_language") {
        return reply(event, buildSameTranslationLanguageText(sourceLang, targetCommand?.targetLang || bilingualTargetLang, replyLocale));
      }
      return reply(event, buildTranslateFailedText(replyLocale));
    }
    return null;
  }

  const charged = await chargeUserUsage(user.id, chargedChars);
  if (!charged) return reply(event, buildQuotaExceededText(lineUserId, user, replyLocale));

  await touchUser(user.id);
  return replyMessages(event, [...bindingNoticeMessages, ...addOriginalQuote(event, messages)]);
}

module.exports = {
  isUserIdCommand,
  isGroupIdCommand,
  isStatusCommand,
  isUsageCommand,
  isUnbindCommand,
  isHelpCommand,
  isSetCommand,
  parseTargetLangCommand,
  removeBindingIfUserLeftConversation,
  handleSetCommand,
  handleMemberLeftEvent,
  handleEvent,
};

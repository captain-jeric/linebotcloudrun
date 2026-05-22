const { SYSTEM_DEFAULT_MODE, SYSTEM_DEFAULT_FROM_LANG, SYSTEM_DEFAULT_TO_LANG, ADMIN_LANGUAGE_OPTIONS } = require("./config");
const { normalizeCode } = require("./lang");
const { parseNonNegativeInteger, parsePositiveInteger, normalizeExpiryDate, formatDateInput, resolveExpiryDateFromDuration, defaultExpiryDate } = require("./utils");

function getQuotaChars(user) {
  return Number(user?.quota_chars || 0);
}

function getUsedChars(user) {
  return Number(user?.used_chars || 0);
}

function getStoredRemainingChars(user) {
  return Math.max(0, getQuotaChars(user) - getUsedChars(user));
}

function isUserExpired(user) {
  if (!user?.expires_at) return true;
  return new Date(user.expires_at).getTime() <= Date.now();
}

function getRemainingChars(user) {
  if (!user || isUserExpired(user) || user.status !== "active") return 0;
  return getStoredRemainingChars(user);
}

function isUserUsable(user) {
  if (!user) return { ok: false, reason: "not_found" };
  if (user.status !== "active") return { ok: false, reason: "status" };
  if (isUserExpired(user)) return { ok: false, reason: "expired" };
  if (getRemainingChars(user) <= 0) return { ok: false, reason: "quota" };
  return { ok: true, reason: "" };
}

function hasConversationTranslationConfig(conversationBinding) {
  return Boolean(
    conversationBinding?.mode ||
      conversationBinding?.from_lang ||
      conversationBinding?.to_lang
  );
}

function getEffectiveTranslationConfig(user, conversationBinding) {
  const hasConversationConfig = hasConversationTranslationConfig(conversationBinding);
  const source = hasConversationConfig ? "conversation" : user ? "user" : "system";
  return {
    source,
    mode: conversationBinding?.mode || user?.mode || SYSTEM_DEFAULT_MODE,
    from_lang: normalizeCode(conversationBinding?.from_lang || user?.from_lang || SYSTEM_DEFAULT_FROM_LANG),
    to_lang: normalizeCode(conversationBinding?.to_lang || user?.to_lang || SYSTEM_DEFAULT_TO_LANG),
  };
}

function isChineseCode(code) {
  const normalized = normalizeCode(code);
  return normalized === "zh" || normalized === "zh-TW";
}

function isExplicitChinesePair(a, b) {
  const normalizedA = normalizeCode(a);
  const normalizedB = normalizeCode(b);
  return isChineseCode(normalizedA) && isChineseCode(normalizedB) && normalizedA !== normalizedB;
}

function matchesConfiguredLang(sourceLang, configuredLang, pairedLang) {
  const source = normalizeCode(sourceLang);
  const configured = normalizeCode(configuredLang);
  if (source === configured) return true;
  if (isChineseCode(source) && isChineseCode(configured) && !isExplicitChinesePair(configured, pairedLang)) {
    return true;
  }
  return false;
}

function getBilingualTargetLang(sourceLang, activation) {
  const source = normalizeCode(sourceLang);
  const langFrom = normalizeCode(activation.from_lang || SYSTEM_DEFAULT_FROM_LANG);
  const langTo = normalizeCode(activation.to_lang || SYSTEM_DEFAULT_TO_LANG);
  if (matchesConfiguredLang(source, langFrom, langTo)) return langTo;
  if (matchesConfiguredLang(source, langTo, langFrom)) return langFrom;
  return langFrom;
}

function normalizeUserInput(body, existing = {}) {
  const existingExpiryDate = formatDateInput(existing.expires_at);
  const hasExistingUser = Boolean(existing.id || existing.line_user_id);
  const expiryDate =
    body.expiry_months !== undefined && !hasExistingUser
      ? resolveExpiryDateFromDuration(body, 12)
      : String(body.expires_at || existingExpiryDate || defaultExpiryDate()).trim();

  return {
    line_user_id: String(body.line_user_id || "").trim(),
    name: String(body.name || "").trim(),
    status: String(body.status || "active").trim(),
    mode: String(body.mode || "bilingual").trim(),
    from_lang: normalizeCode(body.from_lang || "zh"),
    to_lang: normalizeCode(body.to_lang || "th"),
    quota_chars:
      body.quota_chars === undefined
        ? parseNonNegativeInteger(existing.quota_chars)
        : parseNonNegativeInteger(body.quota_chars),
    used_chars:
      body.used_chars === undefined
        ? parseNonNegativeInteger(existing.used_chars)
        : parseNonNegativeInteger(body.used_chars),
    expires_at: normalizeExpiryDate(expiryDate),
    notes: String(body.notes || "").trim() || null,
  };
}

function buildUserUpdatePayload(input) {
  return {
    line_user_id: input.line_user_id,
    name: input.name,
    status: input.status,
    mode: input.mode,
    from_lang: input.from_lang,
    to_lang: input.to_lang,
    quota_chars: input.quota_chars,
    used_chars: input.used_chars,
    expires_at: input.expires_at,
    notes: input.notes,
    updated_at: new Date().toISOString(),
  };
}

function validateUserInput(input) {
  const validStatuses = new Set(["active", "paused"]);
  const validModes = new Set(["bilingual", "trilingual"]);
  const validLangs = new Set(ADMIN_LANGUAGE_OPTIONS);

  if (!input.line_user_id) return "USERID 不能为空。";
  if (!input.name) return "用户名不能为空。";
  if (!validStatuses.has(input.status)) return "用户状态不正确。";
  if (!validModes.has(input.mode)) return "翻译模式不正确。";
  if (!validLangs.has(input.from_lang) || !validLangs.has(input.to_lang)) return "默认语言不正确。";
  if (input.mode === "bilingual" && input.from_lang === input.to_lang) return "默认语言和互译语言不能相同。";
  if (!input.expires_at || Number.isNaN(new Date(input.expires_at).getTime())) {
    return "有效期格式不正确，例如：2027-05-15";
  }
  if (input.quota_chars <= 0) return "购买流量必须大于 0。";
  if (input.used_chars > input.quota_chars) return "已用字符不能大于总购买字符。";
  return "";
}

module.exports = {
  getQuotaChars,
  getUsedChars,
  getStoredRemainingChars,
  isUserExpired,
  getRemainingChars,
  isUserUsable,
  hasConversationTranslationConfig,
  getEffectiveTranslationConfig,
  isChineseCode,
  isExplicitChinesePair,
  matchesConfiguredLang,
  getBilingualTargetLang,
  normalizeUserInput,
  buildUserUpdatePayload,
  validateUserInput,
};

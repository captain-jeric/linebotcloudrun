const { translateClient, CACHE_MAX_SIZE, MAX_LINE_TEXT_LENGTH, THREE_LANGS } = require("./config");
const {
  normalizeCode, toGoogleCode, getLangFlag, getLangShortLabel,
  THAI_POLITE_SUFFIX, THAI_POLITE_END_RE, TRAILING_PUNCTUATION_RE, TRADITIONAL_CHINESE_HINT_RE,
} = require("./lang");
const { logError } = require("./utils");

const translationCache = new Map();

function getCached(key) {
  if (!translationCache.has(key)) return null;
  const value = translationCache.get(key);
  translationCache.delete(key);
  translationCache.set(key, value);
  return value;
}

function setCache(key, value) {
  if (translationCache.has(key)) translationCache.delete(key);
  while (translationCache.size >= CACHE_MAX_SIZE) {
    translationCache.delete(translationCache.keys().next().value);
  }
  translationCache.set(key, value);
}

function addThaiPoliteSuffix(text) {
  if (typeof text !== "string") return text;
  const trailingWhitespace = text.match(/\s*$/u)?.[0] || "";
  const body = text.slice(0, text.length - trailingWhitespace.length);
  if (!body) return text;
  const standardized = body.replace(THAI_POLITE_END_RE, `${THAI_POLITE_SUFFIX}$1`);
  if (standardized !== body) return `${standardized}${trailingWhitespace}`;
  const punctuationMatch = body.match(TRAILING_PUNCTUATION_RE);
  if (punctuationMatch) {
    const punctuation = punctuationMatch[0];
    return `${body.slice(0, -punctuation.length)}${THAI_POLITE_SUFFIX}${punctuation}${trailingWhitespace}`;
  }
  return `${body}${THAI_POLITE_SUFFIX}${trailingWhitespace}`;
}

function postProcessTranslationResult(text, targetLang) {
  if (normalizeCode(targetLang) !== "th") return text;
  return addThaiPoliteSuffix(text);
}

async function detectLang(text) {
  if (/[က-႟]/.test(text)) return "my";
  if (/[฀-๿]/.test(text)) return "th";
  if (/[぀-ヿ]/.test(text)) return "ja";
  if (TRADITIONAL_CHINESE_HINT_RE.test(text)) return "zh-TW";
  if (/[一-鿿]/.test(text)) return "zh";
  try {
    const [detection] = await translateClient.detect(text);
    const first = Array.isArray(detection) ? detection[0] : detection;
    return first?.language || "und";
  } catch (error) {
    logError("detect_language_failed", { error: error.message, textLength: text.length, time: new Date().toISOString() });
    return "und";
  }
}

async function callTranslate(text, targetLang, sourceLang) {
  const source = normalizeCode(sourceLang);
  const target = normalizeCode(targetLang);
  const cacheKey = `${source}|${target}|${text}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  try {
    const options = { to: toGoogleCode(target) };
    const googleSource = toGoogleCode(source);
    if (googleSource) options.from = googleSource;
    const [result] = await translateClient.translate(text, options);
    const translated = postProcessTranslationResult(result, target);
    setCache(cacheKey, translated);
    return translated;
  } catch (error) {
    logError("translate_api_failed", {
      error: error.message, source, target, textLength: text.length, time: new Date().toISOString(),
    });
    return null;
  }
}

function buildTranslationPrefix(targetLang) {
  return `${getLangFlag(targetLang)} ${getLangShortLabel(targetLang)}：`;
}

function buildTranslationLine(targetLang, translated, maxLength = MAX_LINE_TEXT_LENGTH) {
  const prefix = buildTranslationPrefix(targetLang);
  const availableLength = maxLength - prefix.length;
  if (availableLength <= 0) return "";
  return `${prefix}${translated.slice(0, availableLength)}`;
}

async function buildDirectedTranslationResult(text, sourceLang, targetLang) {
  const normalizedSource = normalizeCode(sourceLang);
  const normalizedTarget = normalizeCode(targetLang);
  if (!normalizedTarget || normalizedTarget === "und") {
    return { messages: [], failureReason: "missing_target_language" };
  }
  if (normalizedSource === normalizedTarget) {
    return { messages: [], failureReason: "same_source_and_target_language" };
  }
  const translated = await callTranslate(text, normalizedTarget, normalizedSource);
  if (!translated) {
    return { messages: [], failureReason: "translate_api_returned_empty" };
  }
  if (translated.trim() === text) {
    return { messages: [], failureReason: "translated_text_unchanged" };
  }
  return {
    messages: [{ type: "text", text: buildTranslationLine(normalizedTarget, translated) }],
    failureReason: "",
  };
}

async function buildDirectedMessages(text, sourceLang, targetLang) {
  const result = await buildDirectedTranslationResult(text, sourceLang, targetLang);
  return result.messages;
}

async function buildBilingualMessages(text, sourceLang, activation) {
  const { getBilingualTargetLang } = require("./user");
  const targetLang = getBilingualTargetLang(sourceLang, activation);
  if (!targetLang) return [];
  return buildDirectedMessages(text, sourceLang, targetLang);
}

async function buildTrilingualTranslationResult(text, sourceLang) {
  if (!THREE_LANGS.includes(sourceLang)) {
    return { messages: [], failureReason: "unsupported_trilingual_source_language" };
  }
  const targets = THREE_LANGS.filter((lang) => lang !== sourceLang);
  if (targets.length === 0) {
    return { messages: [], failureReason: "missing_trilingual_targets" };
  }
  const results = await Promise.all(
    targets.map(async (targetLang) => ({
      targetLang,
      translated: await callTranslate(text, targetLang, sourceLang),
    }))
  );
  const lines = [];
  const separator = "\n\n";
  let remainingLength = MAX_LINE_TEXT_LENGTH;
  for (const { targetLang, translated } of results) {
    if (!translated || translated.trim() === text) continue;
    const line = buildTranslationLine(
      targetLang,
      translated,
      remainingLength - (lines.length > 0 ? separator.length : 0)
    );
    if (!line) break;
    lines.push(line);
    remainingLength -= line.length + (lines.length > 1 ? separator.length : 0);
  }
  if (lines.length === 0) {
    return { messages: [], failureReason: "all_trilingual_results_empty_or_unchanged" };
  }
  return { messages: [{ type: "text", text: lines.join(separator) }], failureReason: "" };
}

async function buildTrilingualMessages(text, sourceLang) {
  const result = await buildTrilingualTranslationResult(text, sourceLang);
  return result.messages;
}

module.exports = {
  translationCache,
  getCached,
  setCache,
  addThaiPoliteSuffix,
  postProcessTranslationResult,
  detectLang,
  callTranslate,
  buildTranslationPrefix,
  buildTranslationLine,
  buildDirectedTranslationResult,
  buildDirectedMessages,
  buildBilingualMessages,
  buildTrilingualTranslationResult,
  buildTrilingualMessages,
};

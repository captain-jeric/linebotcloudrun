const THREE_LANGS = ["zh", "th", "my"];

const LANG_NAME = {
  zh: "中文",
  "zh-TW": "繁體中文",
  th: "ภาษาไทย",
  my: "မြန်မာဘာသာ",
  en: "English",
  ja: "日本語",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  ru: "Русский",
  ms: "Bahasa Melayu",
  ko: "한국어",
  id: "Bahasa Indonesia",
  vi: "Tiếng Việt",
  hi: "हिन्दी",
  ar: "العربية",
};

const LANG_FLAG = {
  zh: "🇨🇳",
  "zh-TW": "🇹🇼",
  th: "🇹🇭",
  my: "🇲🇲",
  en: "🇬🇧",
  ja: "🇯🇵",
  de: "🇩🇪",
  fr: "🇫🇷",
  es: "🇪🇸",
  ru: "🇷🇺",
  ms: "🇲🇾",
  ko: "🇰🇷",
  id: "🇮🇩",
  vi: "🇻🇳",
  hi: "🇮🇳",
  ar: "🇸🇦",
};

const LANG_SHORT_LABEL = {
  zh: "中/中文",
  "zh-TW": "繁/繁中",
  th: "泰/ไทย",
  my: "缅/မြန်မာ",
  en: "英/EN",
  ja: "日/日本語",
  de: "德/Deutsch",
  fr: "法/Français",
  es: "西/Español",
  ru: "俄/RU",
  ms: "马/MS",
  ko: "韩/KO",
  id: "印尼/ID",
  vi: "越/VI",
  hi: "印地/HI",
  ar: "阿/AR",
};

const TARGET_LANG_COMMANDS = {
  zh: "zh",
  cn: "zh",
  tw: "zh-TW",
  hk: "zh-TW",
  tc: "zh-TW",
  th: "th",
  mm: "my",
  my: "my",
  en: "en",
  jp: "ja",
  ja: "ja",
  de: "de",
  fr: "fr",
  es: "es",
  ru: "ru",
  ms: "ms",
  ko: "ko",
  kr: "ko",
  id: "id",
  in: "id",
  vi: "vi",
  vn: "vi",
  hi: "hi",
  ar: "ar",
};

const ADMIN_LANGUAGE_OPTIONS = [
  "zh", "zh-TW", "th", "my", "en", "ja", "ko", "ms",
  "id", "vi", "hi", "ar", "ru", "de", "fr", "es",
];

const THAI_POLITE_SUFFIX = "ค่ะ";
const THAI_POLITE_END_RE = /\s*(?:ค่ะ|คะ|ครับ|คับ|นะคะ|นะครับ)\s*([.!?。！？…]*)$/u;
const TRAILING_PUNCTUATION_RE = /([.!?。！？…]+)$/u;
const TRADITIONAL_CHINESE_HINT_RE =
  /[個們這裡嗎麼為與對時會說國語學體後發現讓買賣開關東廣門問間電車書長萬無風來過還點應當產業務員實認識聽見網頁電腦機構幫寫讀頭貓鳥魚馬龍雲台灣臺]/;

function normalizeCode(code) {
  if (!code) return "und";
  const value = String(code).trim().toLowerCase().replace("_", "-");
  if (value === "zh-tw" || value === "zh-hk" || value === "zhtw" || value === "zhhk") return "zh-TW";
  if (value === "tw" || value === "hk" || value === "tc") return "zh-TW";
  if (value.startsWith("zh")) return "zh";
  if (value === "jp") return "ja";
  if (value === "mm") return "my";
  if (value === "kr") return "ko";
  return value;
}

function toGoogleCode(code) {
  const normalized = normalizeCode(code);
  if (normalized === "zh") return "zh-CN";
  if (normalized === "zh-TW") return "zh-TW";
  if (normalized === "und") return undefined;
  return normalized;
}

function getLangName(code) {
  const normalized = normalizeCode(code);
  return LANG_NAME[normalized] || normalized.toUpperCase();
}

function getLangFlag(code) {
  const normalized = normalizeCode(code);
  return LANG_FLAG[normalized] || normalized.toUpperCase();
}

function getLangShortLabel(code) {
  const normalized = normalizeCode(code);
  return LANG_SHORT_LABEL[normalized] || getLangName(normalized);
}

function isSupportedDefaultLang(code) {
  return ADMIN_LANGUAGE_OPTIONS.includes(normalizeCode(code));
}

module.exports = {
  THREE_LANGS,
  LANG_NAME,
  LANG_FLAG,
  LANG_SHORT_LABEL,
  TARGET_LANG_COMMANDS,
  ADMIN_LANGUAGE_OPTIONS,
  THAI_POLITE_SUFFIX,
  THAI_POLITE_END_RE,
  TRAILING_PUNCTUATION_RE,
  TRADITIONAL_CHINESE_HINT_RE,
  normalizeCode,
  toGoogleCode,
  getLangName,
  getLangFlag,
  getLangShortLabel,
  isSupportedDefaultLang,
};

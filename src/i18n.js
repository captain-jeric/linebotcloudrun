const { SYSTEM_DEFAULT_FROM_LANG } = require("./config");
const { getLangName, getLangFlag, getLangShortLabel } = require("./lang");
const { formatDate, formatNumber } = require("./utils");
const {
  isUserExpired, getStoredRemainingChars, getQuotaChars, getUsedChars,
  isUserUsable, getEffectiveTranslationConfig,
} = require("./user");

// ── locale helpers ──────────────────────────────────────────────────────────

function getReplyLocaleFromLang(lang) {
  const { normalizeCode } = require("./lang");
  const normalized = normalizeCode(lang);
  if (normalized === "zh" || normalized === "zh-TW") return "zh";
  if (normalized === "th") return "th";
  if (normalized === "ja") return "ja";
  return "en";
}

function getReplyLocale(user) {
  if (!user) return "en";
  return getReplyLocaleFromLang(user.from_lang || SYSTEM_DEFAULT_FROM_LANG);
}

function getLocalizedConversationLabel(event, locale) {
  const sourceType = event.source?.type;
  const labels = {
    zh: { group: "群聊", room: "多人聊天室", user: "私聊", unknown: "未知来源" },
    en: { group: "Group chat", room: "Multi-person chat", user: "Private chat", unknown: "Unknown source" },
    th: { group: "กลุ่ม", room: "ห้องแชทหลายคน", user: "แชทส่วนตัว", unknown: "ไม่ทราบแหล่งที่มา" },
    ja: { group: "グループチャット", room: "複数人チャット", user: "個別チャット", unknown: "不明な送信元" },
  };
  return (labels[locale] || labels.en)[sourceType] || (labels[locale] || labels.en).unknown;
}

function getLocalizedStatusValue(user, locale) {
  if (isUserExpired(user)) {
    return { zh: "已过期", en: "Expired", th: "หมดอายุ", ja: "期限切れ" }[locale] || "Expired";
  }
  if (user?.status === "active") {
    return { zh: "active", en: "active", th: "ใช้งานได้", ja: "有効" }[locale] || "active";
  }
  if (user?.status === "paused") {
    return { zh: "paused", en: "paused", th: "ระงับ", ja: "一時停止" }[locale] || "paused";
  }
  return user?.status || "";
}

function getLocalizedModeName(mode, locale) {
  if (mode === "trilingual") {
    return { zh: "三语模式", en: "Trilingual mode", th: "โหมด 3 ภาษา", ja: "3言語モード" }[locale] || "Trilingual mode";
  }
  return { zh: "双语模式", en: "Bilingual mode", th: "โหมด 2 ภาษา", ja: "2言語モード" }[locale] || "Bilingual mode";
}

function getLocalizedConfigSource(source, locale) {
  const labels = {
    zh: { conversation: "当前群聊", user: "用户默认", system: "系统默认" },
    en: { conversation: "Current chat", user: "User default", system: "System default" },
    th: { conversation: "แชทปัจจุบัน", user: "ค่าเริ่มต้นของผู้ใช้", system: "ค่าเริ่มต้นของระบบ" },
    ja: { conversation: "現在のチャット", user: "ユーザー初期設定", system: "システム初期設定" },
  };
  return (labels[locale] || labels.en)[source] || (labels[locale] || labels.en).system;
}

function getLocalizedYesNo(value, locale) {
  if (value) {
    return { zh: "是", en: "Yes", th: "ใช่", ja: "はい" }[locale] || "Yes";
  }
  return { zh: "否", en: "No", th: "ไม่ใช่", ja: "いいえ" }[locale] || "No";
}

function getLocalizedOnOff(value, locale) {
  if (value) {
    return { zh: "开启", en: "On", th: "เปิด", ja: "オン" }[locale] || "On";
  }
  return { zh: "关闭", en: "Off", th: "ปิด", ja: "オフ" }[locale] || "Off";
}

// ── help text ────────────────────────────────────────────────────────────────

function getDirectTranslationHelpLines(locale) {
  const lines = {
    zh: [
      "/TH 内容    指定翻译成泰文", "/MM 内容    指定翻译成缅文", "/ZH 内容    指定翻译成中文",
      "/TW 内容    指定翻译成繁体中文", "/EN 内容    指定翻译成英文", "/JP 内容    指定翻译成日文",
      "/DE 内容    指定翻译成德文", "/FR 内容    指定翻译成法文", "/ES 内容    指定翻译成西文",
      "/RU 内容    指定翻译成俄文", "/MS 内容    指定翻译成马来文", "/KO 内容    指定翻译成韩文",
      "/ID 内容    指定翻译成印尼文", "/VI 内容    指定翻译成越南文",
      "/HI 内容    指定翻译成印地文", "/AR 内容    指定翻译成阿拉伯文",
    ],
    en: [
      "/TH text    Translate to Thai", "/MM text    Translate to Burmese", "/ZH text    Translate to Chinese",
      "/TW text    Translate to Traditional Chinese", "/EN text    Translate to English", "/JP text    Translate to Japanese",
      "/DE text    Translate to German", "/FR text    Translate to French", "/ES text    Translate to Spanish",
      "/RU text    Translate to Russian", "/MS text    Translate to Malay", "/KO text    Translate to Korean",
      "/ID text    Translate to Indonesian", "/VI text    Translate to Vietnamese",
      "/HI text    Translate to Hindi", "/AR text    Translate to Arabic",
    ],
    th: [
      "/TH ข้อความ    แปลเป็นภาษาไทย", "/MM ข้อความ    แปลเป็นภาษาพม่า", "/ZH ข้อความ    แปลเป็นภาษาจีน",
      "/TW ข้อความ    แปลเป็นจีนตัวเต็ม", "/EN ข้อความ    แปลเป็นภาษาอังกฤษ", "/JP ข้อความ    แปลเป็นภาษาญี่ปุ่น",
      "/DE ข้อความ    แปลเป็นภาษาเยอรมัน", "/FR ข้อความ    แปลเป็นภาษาฝรั่งเศส", "/ES ข้อความ    แปลเป็นภาษาสเปน",
      "/RU ข้อความ    แปลเป็นภาษารัสเซีย", "/MS ข้อความ    แปลเป็นภาษามาเลย์", "/KO ข้อความ    แปลเป็นภาษาเกาหลี",
      "/ID ข้อความ    แปลเป็นภาษาอินโดนีเซีย", "/VI ข้อความ    แปลเป็นภาษาเวียดนาม",
      "/HI ข้อความ    แปลเป็นภาษาฮินดี", "/AR ข้อความ    แปลเป็นภาษาอาหรับ",
    ],
    ja: [
      "/TH テキスト    タイ語に翻訳", "/MM テキスト    ミャンマー語に翻訳", "/ZH テキスト    中国語に翻訳",
      "/TW テキスト    繁体字中国語に翻訳", "/EN テキスト    英語に翻訳", "/JP テキスト    日本語に翻訳",
      "/DE テキスト    ドイツ語に翻訳", "/FR テキスト    フランス語に翻訳", "/ES テキスト    スペイン語に翻訳",
      "/RU テキスト    ロシア語に翻訳", "/MS テキスト    マレー語に翻訳", "/KO テキスト    韓国語に翻訳",
      "/ID テキスト    インドネシア語に翻訳", "/VI テキスト    ベトナム語に翻訳",
      "/HI テキスト    ヒンディー語に翻訳", "/AR テキスト    アラビア語に翻訳",
    ],
  };
  return lines[locale] || lines.en;
}

function getTranslationPairHelpLines(locale) {
  const lines = {
    zh: ["支持任意两种语言组合，例如：", "set zh th    默认中文 ↔ 泰文", "set zh ja    默认中文 ↔ 日文", "set th ja    默认泰文 ↔ 日文"],
    en: ["Any two supported languages can be paired, for example:", "set zh th    Default Chinese ↔ Thai", "set zh ja    Default Chinese ↔ Japanese", "set th ja    Default Thai ↔ Japanese"],
    th: ["สามารถจับคู่ภาษาใดก็ได้ 2 ภาษา เช่น:", "set zh th    ค่าเริ่มต้นภาษาจีน ↔ ภาษาไทย", "set zh ja    ค่าเริ่มต้นภาษาจีน ↔ ภาษาญี่ปุ่น", "set th ja    ค่าเริ่มต้นภาษาไทย ↔ ภาษาญี่ปุ่น"],
    ja: ["対応言語から任意の2言語を組み合わせできます。例：", "set zh th    初期言語 中国語 ↔ タイ語", "set zh ja    初期言語 中国語 ↔ 日本語", "set th ja    初期言語 タイ語 ↔ 日本語"],
  };
  return lines[locale] || lines.en;
}

function buildPublicHelpText(locale = "en") {
  const builders = {
    zh: () => [
      "使用帮助", "直接发送文字，我会按当前语言设置自动翻译。", "",
      "常用操作：", "/status     查看当前翻译状态", "/usage      查看剩余额度",
      "userid       查看你的 USERID", "/groupid    查看当前群聊ID", "",
      "群聊设置：", "set on      开启群聊自动翻译",
      "set off     关闭群聊自动翻译，需要时仍可用 /TH 等命令指定翻译",
      "set 3lang   切换为中文 / 泰文 / 缅文三语互译", "/unbind    解除当前群聊绑定", "",
      "临时指定目标语言：", "例如：/TH 你好  会翻译成泰文",
      ...getDirectTranslationHelpLines(locale), "",
      "设置默认语言：", "私聊中设置你的默认语言；群聊中只设置当前群聊。",
      "可以选择任意两种支持的语言。第一种是默认语言，其他语言会翻译成第一种。",
      ...getTranslationPairHelpLines(locale),
    ],
    en: () => [
      "Help", "Send text directly and I will translate it using the current language settings.", "",
      "Common actions:", "/status     Check current translation settings", "/usage      Check remaining quota",
      "userid       Show your USERID", "/groupid    Show current group ID", "",
      "Group settings:", "set on      Turn on group auto-translation",
      "set off     Turn it off; /TH and other directed commands still work",
      "set 3lang   Switch to Chinese / Thai / Burmese trilingual mode", "/unbind    Unlink this chat", "",
      "Translate to a specific language:", "Example: /TH hello  translates to Thai",
      ...getDirectTranslationHelpLines(locale), "",
      "Set default languages:", "In private chat, this changes your default. In a group, it changes only that group.",
      "Choose any two supported languages. The first one is the default for other languages.",
      ...getTranslationPairHelpLines(locale),
    ],
    th: () => [
      "วิธีใช้งาน", "ส่งข้อความมาได้เลย ระบบจะแปลตามภาษาที่ตั้งไว้ตอนนี้", "",
      "คำสั่งที่ใช้บ่อย:", "/status     ดูสถานะการแปลปัจจุบัน", "/usage      ดูโควตาคงเหลือ",
      "userid       ดู USERID ของคุณ", "/groupid    ดู ID ของกลุ่มปัจจุบัน", "",
      "ตั้งค่าในกลุ่ม:", "set on      เปิดการแปลอัตโนมัติในกลุ่ม",
      "set off     ปิดการแปลอัตโนมัติ แต่ยังใช้ /TH และคำสั่งระบุภาษาได้",
      "set 3lang   เปลี่ยนเป็นโหมดจีน / ไทย / พม่า 3 ภาษา", "/unbind    ยกเลิกการผูกแชทนี้", "",
      "แปลเป็นภาษาที่ระบุ:", "ตัวอย่าง: /TH hello  จะแปลเป็นภาษาไทย",
      ...getDirectTranslationHelpLines(locale), "",
      "ตั้งค่าภาษาเริ่มต้น:", "ในแชทส่วนตัวจะเปลี่ยนค่าของคุณ ในกลุ่มจะเปลี่ยนเฉพาะกลุ่มนั้น",
      "เลือกภาษาที่รองรับได้ 2 ภาษา ภาษาแรกคือภาษาเริ่มต้นสำหรับภาษาอื่น",
      ...getTranslationPairHelpLines(locale),
    ],
    ja: () => [
      "ヘルプ", "テキストをそのまま送ると、現在の言語設定で翻訳します。", "",
      "よく使う操作：", "/status     現在の翻訳設定を確認", "/usage      残量を確認",
      "userid       あなたの USERID を表示", "/groupid    現在のグループIDを表示", "",
      "グループ設定：", "set on      グループ自動翻訳をオン",
      "set off     自動翻訳をオフ。/TH などの指定翻訳は利用できます",
      "set 3lang   中国語 / タイ語 / ミャンマー語の3言語モードに切り替え", "/unbind    このチャットの連携を解除", "",
      "翻訳先を指定する：", "例：/TH こんにちは  タイ語に翻訳します",
      ...getDirectTranslationHelpLines(locale), "",
      "初期言語を設定する：", "個別チャットではあなたの初期設定、グループではそのグループだけを変更します。",
      "対応言語から2つ選べます。1つ目が、その他の言語の翻訳先になります。",
      ...getTranslationPairHelpLines(locale),
    ],
  };
  return (builders[locale] || builders.en)().join("\n");
}

function getUnsupportedLanguageTitle(locale) {
  return { zh: "不支持该语言，可用命令示例：", en: "Unsupported language. Examples:", th: "ไม่รองรับภาษานี้ ตัวอย่างคำสั่ง:", ja: "この言語には対応していません。コマンド例：" }[locale] || "Unsupported language. Examples:";
}

function getSetUsageTitle(locale) {
  return { zh: "set 命令用法：", en: "How to use set:", th: "วิธีใช้คำสั่ง set:", ja: "set コマンドの使い方：" }[locale] || "How to use set:";
}

function buildSetHelpText(title, locale = "en") {
  const builders = {
    zh: () => [
      title, "", ...getDirectTranslationHelpLines(locale), "",
      "可设置的默认翻译语言：", "私聊中设置用户默认；群聊中设置当前群聊。", "支持任意两种语言组合。", "其他语言会翻译成第一种默认语言。",
      ...getTranslationPairHelpLines(locale), "",
      "set on       开启群聊自动翻译", "set off      关闭群聊自动翻译，只保留 /TH 等指定翻译", "/unbind     解除当前群聊绑定", "",
      "/status      查看当前状态", "/usage       查看额度", "/groupid     查看当前群聊ID", "userid       查看 USERID",
    ],
    en: () => [
      title, "", ...getDirectTranslationHelpLines(locale), "",
      "Default translation languages:", "In private chat: sets your default. In group chat: sets this chat only.", "Any two supported languages can be paired.", "Other languages will be translated to the first default language.",
      ...getTranslationPairHelpLines(locale), "",
      "set on       Turn on group auto-translation", "set off      Turn off group auto-translation; /TH and other directed commands still work", "/unbind     Unlink this chat", "",
      "/status      Show current status", "/usage       Check quota", "/groupid     Show current group ID", "userid       Show USERID",
    ],
    th: () => [
      title, "", ...getDirectTranslationHelpLines(locale), "",
      "ภาษาที่ตั้งเป็นค่าเริ่มต้นได้:", "ในแชทส่วนตัว: ตั้งค่าเริ่มต้นของคุณ ในกลุ่ม: ตั้งค่าเฉพาะกลุ่มนี้", "สามารถจับคู่ภาษาใดก็ได้ 2 ภาษา", "ภาษาอื่นจะแปลเป็นภาษาเริ่มต้นภาษาแรก",
      ...getTranslationPairHelpLines(locale), "",
      "set on       เปิดการแปลอัตโนมัติในกลุ่ม", "set off      ปิดการแปลอัตโนมัติในกลุ่ม แต่ /TH และคำสั่งระบุภาษาอื่นยังใช้ได้", "/unbind     ยกเลิกการผูกแชทนี้", "",
      "/status      ดูสถานะปัจจุบัน", "/usage       ตรวจสอบโควตา", "/groupid     ดู ID ของกลุ่มปัจจุบัน", "userid       ดู USERID",
    ],
    ja: () => [
      title, "", ...getDirectTranslationHelpLines(locale), "",
      "設定できる初期翻訳言語：", "個別チャットではユーザー初期設定、グループでは現在のチャットだけを設定します。", "対応言語から任意の2言語を組み合わせできます。", "その他の言語は1つ目の初期言語に翻訳されます。",
      ...getTranslationPairHelpLines(locale), "",
      "set on       グループ自動翻訳をオン", "set off      グループ自動翻訳をオフ。/TH などの指定翻訳は利用できます", "/unbind     このチャットの連携を解除", "",
      "/status      現在の状態を表示", "/usage       残量を確認", "/groupid     現在のグループIDを表示", "userid       USERIDを表示",
    ],
  };
  return (builders[locale] || builders.en)().join("\n");
}

// ── status / usage text ───────────────────────────────────────────────────────

function buildStatusText(event, user, options = {}) {
  const locale = options.locale || "en";
  const userCheck = isUserUsable(user);
  const config = options.translationConfig || getEffectiveTranslationConfig(user, null);

  const text = {
    zh: { title: "当前翻译状态", source: "来源", username: "用户名", valid: "有效", status: "状态", expires: "有效期至", configSource: "配置来源", mode: "模式", languages: "语言", defaultLang: "默认语言", pairedLang: "互译语言", otherLangs: "其他语言：翻译成默认语言", conversationTranslation: "群聊自动翻译", usageHint: "发送 /usage 查看额度。" },
    en: { title: "Current translation status", source: "Source", username: "Name", valid: "Valid", status: "Status", expires: "Valid until", configSource: "Config source", mode: "Mode", languages: "Languages", defaultLang: "Default language", pairedLang: "Paired language", otherLangs: "Other languages: translated to the default language", conversationTranslation: "Group auto-translation", usageHint: "Send /usage to check your quota." },
    th: { title: "สถานะการแปลปัจจุบัน", source: "แหล่งที่มา", username: "ชื่อบัญชี", valid: "ใช้งานได้", status: "สถานะ", expires: "ใช้ได้ถึง", configSource: "แหล่งที่มาของการตั้งค่า", mode: "โหมด", languages: "ภาษา", defaultLang: "ภาษาเริ่มต้น", pairedLang: "ภาษาคู่แปล", otherLangs: "ภาษาอื่นจะแปลเป็นภาษาเริ่มต้น", conversationTranslation: "แปลอัตโนมัติในกลุ่ม", usageHint: "ส่ง /usage เพื่อตรวจสอบโควตา" },
    ja: { title: "現在の翻訳状態", source: "送信元", username: "ユーザー名", valid: "利用可能", status: "状態", expires: "有効期限", configSource: "設定元", mode: "モード", languages: "言語", defaultLang: "初期言語", pairedLang: "相互翻訳言語", otherLangs: "その他の言語：初期言語に翻訳", conversationTranslation: "グループ自動翻訳", usageHint: "/usage を送信すると残量を確認できます。" },
  }[locale] || {};

  const lines = [text.title, ""];
  lines.push(`${text.source}: ${getLocalizedConversationLabel(event, locale)}`);
  lines.push(`USERID: ${event.source?.userId || ""}`);
  lines.push(`${text.username}: ${user.name}`);
  lines.push(`${text.valid}: ${getLocalizedYesNo(userCheck.ok, locale)}`);
  lines.push(`${text.status}: ${getLocalizedStatusValue(user, locale)}`);
  lines.push(`${text.expires}: ${formatDate(user.expires_at)}`);
  lines.push(`${text.configSource}: ${getLocalizedConfigSource(config.source, locale)}`);
  lines.push(`${text.mode}: ${getLocalizedModeName(config.mode, locale)}`);
  if (config.mode === "trilingual") {
    lines.push(`${text.languages}: 中文 / ภาษาไทย / မြန်မာဘာသာ`);
  } else {
    lines.push(`${text.defaultLang}: ${getLangName(config.from_lang)}`);
    lines.push(`${text.pairedLang}: ${getLangName(config.to_lang)}`);
    lines.push(text.otherLangs);
  }
  const { getConversationBindingKey } = require("./line");
  if (getConversationBindingKey(event)) {
    lines.push(`${text.conversationTranslation}: ${getLocalizedOnOff(options.conversationTranslationEnabled !== false, locale)}`);
  }
  lines.push("");
  lines.push(text.usageHint);
  return lines.join("\n");
}

function buildUserUsageText(user, lineUserId, locale = "en") {
  if (!user) return buildInactiveAccountText(lineUserId);
  const remainingChars = getStoredRemainingChars(user);
  const quotaChars = getQuotaChars(user);
  const usedChars = getUsedChars(user);
  const builders = {
    zh: () => ["当前额度", `账号：${user.name}`, `状态：${getLocalizedStatusValue(user, locale)}`, `有效期至：${formatDate(user.expires_at)}`, `总购买字符：${formatNumber(quotaChars)} 字符`, `已用字符：${formatNumber(usedChars)} 字符`, `剩余字符：${formatNumber(remainingChars)} 字符`, user.mode === "trilingual" ? "当前为三语模式，普通消息按输入字符 x 2 扣额度。" : "当前为双语模式，普通消息按输入字符数扣额度。"],
    en: () => ["Current quota", `Account: ${user.name}`, `Status: ${getLocalizedStatusValue(user, locale)}`, `Valid until: ${formatDate(user.expires_at)}`, `Total purchased: ${formatNumber(quotaChars)} chars`, `Used: ${formatNumber(usedChars)} chars`, `Remaining: ${formatNumber(remainingChars)} chars`, user.mode === "trilingual" ? "Current mode: trilingual. Normal messages use input chars x 2." : "Current mode: bilingual. Normal messages use input chars."],
    th: () => ["โควตาปัจจุบัน", `บัญชี: ${user.name}`, `สถานะ: ${getLocalizedStatusValue(user, locale)}`, `ใช้ได้ถึง: ${formatDate(user.expires_at)}`, `จำนวนที่ซื้อทั้งหมด: ${formatNumber(quotaChars)} ตัวอักษร`, `ใช้ไปแล้ว: ${formatNumber(usedChars)} ตัวอักษร`, `คงเหลือ: ${formatNumber(remainingChars)} ตัวอักษร`, user.mode === "trilingual" ? "ขณะนี้เป็นโหมด 3 ภาษา ข้อความทั่วไปคิดโควตาเป็นจำนวนตัวอักษร x 2" : "ขณะนี้เป็นโหมด 2 ภาษา ข้อความทั่วไปคิดโควตาตามจำนวนตัวอักษร"],
    ja: () => ["現在の残量", `アカウント：${user.name}`, `状態：${getLocalizedStatusValue(user, locale)}`, `有効期限：${formatDate(user.expires_at)}`, `購入文字数：${formatNumber(quotaChars)} 文字`, `使用済み：${formatNumber(usedChars)} 文字`, `残り：${formatNumber(remainingChars)} 文字`, user.mode === "trilingual" ? "現在は3言語モードです。通常メッセージは入力文字数 x 2 で消費されます。" : "現在は2言語モードです。通常メッセージは入力文字数で消費されます。"],
  };
  return (builders[locale] || builders.en)().join("\n");
}

// ── user identity text ────────────────────────────────────────────────────────

function buildInactiveAccountText(lineUserId) {
  return [
    "您的账户尚未激活，请添加line群https://line.me/ti/g/JWu55WSem5，并发送您的名字和",
    `userid：${lineUserId}`,
    "联系管理员激活账户",
    "",
    "套餐价格：",
    "9.9 元（49 泰铢）/ 月 / 20,000 字符",
    "19.9 元（99 泰铢）/ 月 / 50,000 字符",
    "29.9 元（149 泰铢）/ 月 / 100,000 字符",
    "",
    "Your account has not been activated yet. Please join the LINE group https://line.me/ti/g/JWu55WSem5 and send your name and",
    `userid: ${lineUserId}`,
    "Contact the administrator to activate your account.",
    "",
    "Plans:",
    "CNY 9.9 (THB 49) / month / 20,000 characters",
    "CNY 19.9 (THB 99) / month / 50,000 characters",
    "CNY 29.9 (THB 149) / month / 100,000 characters",
    "",
    "บัญชีของคุณยังไม่ได้เปิดใช้งาน กรุณาเข้ากลุ่ม LINE https://line.me/ti/g/JWu55WSem5 และส่งชื่อของคุณพร้อม",
    `userid: ${lineUserId}`,
    "ติดต่อผู้ดูแลระบบเพื่อเปิดใช้งานบัญชี",
    "",
    "แพ็กเกจ:",
    "9.9 หยวน (49 บาท) / เดือน / 20,000 ตัวอักษร",
    "19.9 หยวน (99 บาท) / เดือน / 50,000 ตัวอักษร",
    "29.9 หยวน (149 บาท) / เดือน / 100,000 ตัวอักษร",
  ].join("\n");
}

function buildNeedPermissionText(lineUserId) {
  return buildInactiveAccountText(lineUserId);
}

function buildUserIdText(lineUserId, user, locale = "en") {
  if (!user) return buildInactiveAccountText(lineUserId);
  const lines = {
    zh: [`USERID：${lineUserId}`, "发送 /usage 查看额度。"],
    en: [`USERID: ${lineUserId}`, "Send /usage to check your quota."],
    th: [`USERID: ${lineUserId}`, "ส่ง /usage เพื่อตรวจสอบโควตา"],
    ja: [`USERID: ${lineUserId}`, "/usage を送信すると残量を確認できます。"],
  };
  return (lines[locale] || lines.en).join("\n");
}

function buildGroupIdText(event, lineUserId, locale = "en") {
  if (event.source?.type === "group") {
    const lines = {
      zh: [`群聊ID：${event.source.groupId || ""}`, "可复制该 ID 给管理员查询群聊绑定。"],
      en: [`Group ID: ${event.source.groupId || ""}`, "Send this ID to the administrator to check the group binding."],
      th: [`Group ID: ${event.source.groupId || ""}`, "ส่ง ID นี้ให้ผู้ดูแลเพื่อตรวจสอบการผูกกลุ่ม"],
      ja: [`グループID：${event.source.groupId || ""}`, "このIDを管理者に送ると、グループ連携を確認できます。"],
    };
    return (lines[locale] || lines.en).join("\n");
  }
  if (event.source?.type === "room") {
    const lines = {
      zh: [`聊天室ID：${event.source.roomId || ""}`, "可复制该 ID 给管理员查询群聊绑定。"],
      en: [`Chat room ID: ${event.source.roomId || ""}`, "Send this ID to the administrator to check the chat binding."],
      th: [`Chat room ID: ${event.source.roomId || ""}`, "ส่ง ID นี้ให้ผู้ดูแลเพื่อตรวจสอบการผูกห้องแชท"],
      ja: [`チャットルームID：${event.source.roomId || ""}`, "このIDを管理者に送ると、チャット連携を確認できます。"],
    };
    return (lines[locale] || lines.en).join("\n");
  }
  const lines = {
    zh: ["当前是私聊，没有群聊ID。", `USERID：${lineUserId}`],
    en: ["This is a private chat, so there is no group ID.", `USERID: ${lineUserId}`],
    th: ["นี่คือแชทส่วนตัว จึงไม่มี Group ID", `USERID: ${lineUserId}`],
    ja: ["これは個別チャットのため、グループIDはありません。", `USERID: ${lineUserId}`],
  };
  return (lines[locale] || lines.en).join("\n");
}

// ── rejection / quota text ────────────────────────────────────────────────────

function buildQuotaExceededText(lineUserId, user, locale = "en") {
  const remaining = formatNumber(getStoredRemainingChars(user));
  const lines = {
    zh: ["当前字符余额不足，请联系管理员充值流量。", `USERID：${lineUserId}`, `剩余字符：${remaining} 字符`],
    en: ["Not enough character quota. Please contact the administrator to recharge.", `USERID: ${lineUserId}`, `Remaining: ${remaining} chars`],
    th: ["โควตาตัวอักษรไม่เพียงพอ กรุณาติดต่อผู้ดูแลเพื่อเติมโควตา", `USERID: ${lineUserId}`, `คงเหลือ: ${remaining} ตัวอักษร`],
    ja: ["文字数残量が不足しています。管理者に連絡してチャージしてください。", `USERID: ${lineUserId}`, `残り：${remaining} 文字`],
  };
  return (lines[locale] || lines.en).join("\n");
}

function buildUserRejectedText(lineUserId, reason, user, locale = "en") {
  if (reason === "status") {
    const lines = { zh: ["账号已暂停，请联系管理员。", `USERID：${lineUserId}`], en: ["This account is paused. Please contact the administrator.", `USERID: ${lineUserId}`], th: ["บัญชีนี้ถูกระงับ กรุณาติดต่อผู้ดูแล", `USERID: ${lineUserId}`], ja: ["このアカウントは一時停止中です。管理者に連絡してください。", `USERID: ${lineUserId}`] };
    return (lines[locale] || lines.en).join("\n");
  }
  if (reason === "expired") {
    const lines = { zh: ["账号有效期已过，请联系管理员充值流量。", `USERID：${lineUserId}`, `有效期至：${formatDate(user?.expires_at)}`], en: ["This account has expired. Please contact the administrator to recharge.", `USERID: ${lineUserId}`, `Valid until: ${formatDate(user?.expires_at)}`], th: ["บัญชีนี้หมดอายุแล้ว กรุณาติดต่อผู้ดูแลเพื่อเติมโควตา", `USERID: ${lineUserId}`, `ใช้ได้ถึง: ${formatDate(user?.expires_at)}`], ja: ["このアカウントは期限切れです。管理者に連絡してチャージしてください。", `USERID: ${lineUserId}`, `有効期限：${formatDate(user?.expires_at)}`] };
    return (lines[locale] || lines.en).join("\n");
  }
  if (reason === "quota") return buildQuotaExceededText(lineUserId, user, locale);
  return buildNeedPermissionText(lineUserId, locale);
}

// ── binding / conversation text ───────────────────────────────────────────────

function buildConversationBoundText(user, rebound = false, locale = "en") {
  const name = user?.name || user?.line_user_id || "";
  const lines = {
    zh: rebound ? [`群聊扣费账号已切换为：${name}`, "之后会使用该账号的额度。"] : [`当前群聊已绑定到：${name}`, "之后会使用该账号的额度。"],
    en: rebound ? [`This chat is now billed to: ${name}`, "Future translations will use this account's quota."] : [`This chat has been linked to: ${name}`, "Future translations will use this account's quota."],
    th: rebound ? [`แชทนี้เปลี่ยนบัญชีที่ใช้โควตาเป็น: ${name}`, "การแปลต่อจากนี้จะใช้โควตาของบัญชีนี้"] : [`แชทนี้ผูกกับบัญชี: ${name}`, "การแปลต่อจากนี้จะใช้โควตาของบัญชีนี้"],
    ja: rebound ? [`このチャットの課金アカウントを切り替えました：${name}`, "今後の翻訳はこのアカウントの残量を使用します。"] : [`このチャットを次のアカウントに連携しました：${name}`, "今後の翻訳はこのアカウントの残量を使用します。"],
  };
  return (lines[locale] || lines.en).join("\n");
}

function buildConversationUnboundText(locale = "en") {
  const lines = {
    zh: ["原绑定扣费账号已离开群聊，当前群聊绑定已解除。", "请让已开通用户在群里发送一条消息，系统会重新绑定。"],
    en: ["The linked billing account has left this chat, so the chat link was removed.", "Ask an activated user to send a message here to link it again."],
    th: ["บัญชีที่ผูกไว้สำหรับใช้โควตาออกจากกลุ่มแล้ว จึงยกเลิกการผูกแชทนี้", "ให้ผู้ใช้ที่เปิดสิทธิ์แล้วส่งข้อความในกลุ่มเพื่อผูกใหม่"],
    ja: ["連携中の課金アカウントがチャットから退出したため、このチャットの連携を解除しました。", "有効なユーザーがこのチャットでメッセージを送ると再連携できます。"],
  };
  return (lines[locale] || lines.en).join("\n");
}

function buildUserUnboundConversationText(locale = "en") {
  const lines = {
    zh: ["当前群聊绑定已解除。", "之后需要已开通用户在群里发言，系统才会重新绑定并翻译。"],
    en: ["This chat has been unlinked.", "An activated user needs to send a message here before translations can resume."],
    th: ["ยกเลิกการผูกแชทนี้แล้ว", "หลังจากนี้ต้องให้ผู้ใช้ที่เปิดสิทธิ์แล้วส่งข้อความในกลุ่ม ระบบจึงจะผูกใหม่และแปลต่อ"],
    ja: ["このチャットの連携を解除しました。", "翻訳を再開するには、有効なユーザーがこのチャットでメッセージを送る必要があります。"],
  };
  return (lines[locale] || lines.en).join("\n");
}

function buildConversationNotBoundText(locale = "en") {
  const lines = {
    zh: ["当前群聊还没有绑定扣费账号。", "请让已开通用户在群里发送一条消息完成绑定。"],
    en: ["This chat is not linked to a billing account yet.", "Ask an activated user to send a message here to link it."],
    th: ["แชทนี้ยังไม่ได้ผูกกับบัญชีที่ใช้โควตา", "ให้ผู้ใช้ที่เปิดสิทธิ์แล้วส่งข้อความในกลุ่มเพื่อผูกบัญชี"],
    ja: ["このチャットはまだ課金アカウントに連携されていません。", "有効なユーザーがこのチャットでメッセージを送ると連携できます。"],
  };
  return (lines[locale] || lines.en).join("\n");
}

function buildUnbindPrivateText(locale = "en") {
  return { zh: "/unbind 只能在群聊或多人聊天室中使用。", en: "/unbind can only be used in a group or multi-person chat.", th: "ใช้ /unbind ได้เฉพาะในกลุ่มหรือห้องแชทหลายคนเท่านั้น", ja: "/unbind はグループまたは複数人チャットでのみ使用できます。" }[locale] || "/unbind can only be used in a group or multi-person chat.";
}

// ── set command result text ───────────────────────────────────────────────────

function buildSetToggleFailedText(locale = "en") {
  return { zh: "切换群聊翻译开关失败，请稍后再试。", en: "Failed to change the group translation switch. Please try again later.", th: "เปลี่ยนสถานะการแปลในกลุ่มไม่สำเร็จ กรุณาลองใหม่ภายหลัง", ja: "グループ翻訳スイッチの変更に失敗しました。しばらくしてから再試行してください。" }[locale] || "Failed to change the group translation switch. Please try again later.";
}

function buildSetToggleSuccessText(enabled, locale = "en") {
  if (enabled) {
    return { zh: "群聊自动翻译已开启。", en: "Group auto-translation is on.", th: "เปิดการแปลอัตโนมัติในกลุ่มแล้ว", ja: "グループ自動翻訳をオンにしました。" }[locale] || "Group auto-translation is on.";
  }
  return { zh: "群聊自动翻译已关闭。\n之后只有 /TH、/ZH、/MM 等指定翻译命令会触发翻译。", en: "Group auto-translation is off.\nOnly directed commands such as /TH, /ZH, and /MM will trigger translation.", th: "ปิดการแปลอัตโนมัติในกลุ่มแล้ว\nต่อจากนี้เฉพาะคำสั่งระบุภาษา เช่น /TH, /ZH, /MM เท่านั้นที่จะเรียกการแปล", ja: "グループ自動翻訳をオフにしました。\n今後は /TH、/ZH、/MM などの指定翻訳コマンドだけが翻訳を実行します。" }[locale] || "Group auto-translation is off.\nOnly directed commands such as /TH, /ZH, and /MM will trigger translation.";
}

function buildSetTrilingualFailedText(isConversationConfig, locale = "en") {
  const lines = { zh: isConversationConfig ? "切换当前群聊三语模式失败，请稍后再试。" : "切换三语模式失败，请稍后再试。", en: isConversationConfig ? "Failed to switch this chat to trilingual mode. Please try again later." : "Failed to switch to trilingual mode. Please try again later.", th: isConversationConfig ? "เปลี่ยนแชทนี้เป็นโหมด 3 ภาษาไม่สำเร็จ กรุณาลองใหม่ภายหลัง" : "เปลี่ยนเป็นโหมด 3 ภาษาไม่สำเร็จ กรุณาลองใหม่ภายหลัง", ja: isConversationConfig ? "このチャットを3言語モードに切り替えられませんでした。しばらくしてから再試行してください。" : "3言語モードに切り替えられませんでした。しばらくしてから再試行してください。" };
  return lines[locale] || lines.en;
}

function buildSetTrilingualSuccessText(isConversationConfig, locale = "en") {
  const builders = {
    zh: () => [isConversationConfig ? "当前群聊三语模式已开启。" : "三语模式已开启。", "中文 / ภาษาไทย / မြန်မာဘာသာ 三语互译。", "每条消息按 输入字符数 x 2 扣额度。", "", "切回双语：set zh th"],
    en: () => [isConversationConfig ? "This chat is now in trilingual mode." : "Trilingual mode is on.", "Chinese / Thai / Burmese will be translated between each other.", "Each normal message uses input chars x 2.", "", "Switch back to bilingual: set zh th"],
    th: () => [isConversationConfig ? "เปิดโหมด 3 ภาษาในแชทนี้แล้ว" : "เปิดโหมด 3 ภาษาแล้ว", "จีน / ไทย / พม่า จะแปลถึงกัน", "แต่ละข้อความทั่วไปคิดโควตาเป็นจำนวนตัวอักษร x 2", "", "กลับไปโหมด 2 ภาษา: set zh th"],
    ja: () => [isConversationConfig ? "このチャットの3言語モードをオンにしました。" : "3言語モードをオンにしました。", "中国語 / タイ語 / ミャンマー語を相互翻訳します。", "通常メッセージは入力文字数 x 2 で消費されます。", "", "2言語モードに戻す：set zh th"],
  };
  return (builders[locale] || builders.en)().join("\n");
}

function buildSetLanguageFailedText(isConversationConfig, locale = "en") {
  const lines = { zh: isConversationConfig ? "切换当前群聊语言失败，请稍后再试。" : "切换语言失败，请稍后再试。", en: isConversationConfig ? "Failed to change this chat's languages. Please try again later." : "Failed to change languages. Please try again later.", th: isConversationConfig ? "เปลี่ยนภาษาของแชทนี้ไม่สำเร็จ กรุณาลองใหม่ภายหลัง" : "เปลี่ยนภาษาไม่สำเร็จ กรุณาลองใหม่ภายหลัง", ja: isConversationConfig ? "このチャットの言語を切り替えられませんでした。しばらくしてから再試行してください。" : "言語を切り替えられませんでした。しばらくしてから再試行してください。" };
  return lines[locale] || lines.en;
}

function buildSetLanguageSuccessText(isConversationConfig, fromLang, toLang, locale = "en") {
  const builders = {
    zh: () => [`${isConversationConfig ? "当前群聊已切换" : "已切换"}：${getLangName(fromLang)} ↔ ${getLangName(toLang)}`, `默认语言：${getLangName(fromLang)}`, `其他语言会翻译成：${getLangName(fromLang)}`, "", "发送 set 3lang 可切换到三语模式。"],
    en: () => [`${isConversationConfig ? "This chat has been switched" : "Switched"}: ${getLangName(fromLang)} ↔ ${getLangName(toLang)}`, `Default language: ${getLangName(fromLang)}`, `Other languages will be translated to: ${getLangName(fromLang)}`, "", "Send set 3lang to switch to trilingual mode."],
    th: () => [`${isConversationConfig ? "เปลี่ยนภาษาของแชทนี้แล้ว" : "เปลี่ยนภาษาแล้ว"}: ${getLangName(fromLang)} ↔ ${getLangName(toLang)}`, `ภาษาเริ่มต้น: ${getLangName(fromLang)}`, `ภาษาอื่นจะแปลเป็น: ${getLangName(fromLang)}`, "", "ส่ง set 3lang เพื่อเปลี่ยนเป็นโหมด 3 ภาษา"],
    ja: () => [`${isConversationConfig ? "このチャットを切り替えました" : "切り替えました"}：${getLangName(fromLang)} ↔ ${getLangName(toLang)}`, `初期言語：${getLangName(fromLang)}`, `その他の言語は次に翻訳されます：${getLangName(fromLang)}`, "", "set 3lang を送信すると3言語モードに切り替えられます。"],
  };
  return (builders[locale] || builders.en)().join("\n");
}

function buildSameLanguageText(locale = "en") {
  return { zh: "默认语言和互译语言不能相同。", en: "The default language and paired language cannot be the same.", th: "ภาษาเริ่มต้นและภาษาคู่แปลต้องไม่เหมือนกัน", ja: "初期言語と相互翻訳言語を同じにすることはできません。" }[locale] || "The default language and paired language cannot be the same.";
}

function buildSameTranslationLanguageText(sourceLang, targetLang, locale = "en") {
  const sourceName = getLangName(sourceLang);
  const targetName = getLangName(targetLang);
  return { zh: `不能将${sourceName}翻译成${targetName}。`, en: `Cannot translate ${sourceName} into ${targetName}.`, th: `ไม่สามารถแปล${sourceName}เป็น${targetName}ได้`, ja: `${sourceName}を${targetName}に翻訳することはできません。` }[locale] || `Cannot translate ${sourceName} into ${targetName}.`;
}

function buildMissingTargetText(targetLang, locale = "en") {
  const command = `/${targetLang.toUpperCase()}`;
  return { zh: `请输入要翻译的内容，例如：${command} 你好`, en: `Please enter text to translate, for example: ${command} hello`, th: `กรุณาใส่ข้อความที่ต้องการแปล เช่น ${command} สวัสดี`, ja: `翻訳するテキストを入力してください。例：${command} こんにちは` }[locale] || `Please enter text to translate, for example: ${command} hello`;
}

function buildTranslateFailedText(locale = "en") {
  return { zh: "暂时无法完成翻译，请稍后再试或换一种表达。", en: "Translation is temporarily unavailable. Please try again later or rephrase.", th: "ขณะนี้ยังแปลไม่ได้ กรุณาลองใหม่ภายหลังหรือเปลี่ยนวิธีเขียน", ja: "一時的に翻訳できません。しばらくしてから再試行するか、別の表現にしてください。" }[locale] || "Translation is temporarily unavailable. Please try again later or rephrase.";
}

module.exports = {
  getReplyLocaleFromLang,
  getReplyLocale,
  getLocalizedConversationLabel,
  getLocalizedStatusValue,
  getLocalizedModeName,
  getLocalizedConfigSource,
  getLocalizedYesNo,
  getLocalizedOnOff,
  getDirectTranslationHelpLines,
  getTranslationPairHelpLines,
  buildPublicHelpText,
  getUnsupportedLanguageTitle,
  getSetUsageTitle,
  buildSetHelpText,
  buildStatusText,
  buildUserUsageText,
  buildInactiveAccountText,
  buildNeedPermissionText,
  buildUserIdText,
  buildGroupIdText,
  buildQuotaExceededText,
  buildUserRejectedText,
  buildConversationBoundText,
  buildConversationUnboundText,
  buildUserUnboundConversationText,
  buildConversationNotBoundText,
  buildUnbindPrivateText,
  buildSetToggleFailedText,
  buildSetToggleSuccessText,
  buildSetTrilingualFailedText,
  buildSetTrilingualSuccessText,
  buildSetLanguageFailedText,
  buildSetLanguageSuccessText,
  buildSameLanguageText,
  buildSameTranslationLanguageText,
  buildMissingTargetText,
  buildTranslateFailedText,
};

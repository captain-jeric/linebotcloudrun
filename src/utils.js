const { BILLING_TIME_ZONE } = require("./config");

function logInfo(event, data = {}) {
  console.log(JSON.stringify({ level: "info", event, ...data }));
}

function logError(event, data = {}) {
  console.error(JSON.stringify({ level: "error", event, ...data }));
}

function getBangkokDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BILLING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return year && month && day ? `${year}-${month}-${day}` : "";
}

function addMonthsToDateString(dateString, months) {
  const safeMonths = Math.max(1, Number.parseInt(months || "1", 10) || 1);
  const base = /^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ""))
    ? new Date(`${dateString}T12:00:00+07:00`)
    : new Date();
  const originalDay = base.getDate();
  const next = new Date(base);
  next.setMonth(next.getMonth() + safeMonths);
  if (next.getDate() !== originalDay) next.setDate(0);
  return getBangkokDateString(next);
}

function defaultExpiryDate() {
  return addMonthsToDateString(getBangkokDateString(), 12);
}

function parseExpiryMonths(value, fallback = 12) {
  const parsed = Number.parseInt(value || String(fallback), 10);
  return [1, 3, 6, 9, 12].includes(parsed) ? parsed : fallback;
}

function resolveExpiryDateFromDuration(body, fallbackMonths = 12) {
  const months = parseExpiryMonths(body.expiry_months, fallbackMonths);
  const calculatedDate = addMonthsToDateString(getBangkokDateString(), months);
  const customDate = String(body.expires_at || "").trim();
  if (customDate) return customDate;
  return calculatedDate;
}

function formatDate(value) {
  if (!value) return "未设置";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return getBangkokDateString(date);
}

function normalizeExpiryDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return `${text}T23:59:59+07:00`;
  }
  return text;
}

function formatDateInput(value) {
  if (!value) return "";
  return formatDate(value);
}

function parseNonNegativeInteger(value) {
  return Math.max(0, Number.parseInt(value || "0", 10) || 0);
}

function parsePositiveInteger(value, fallback = 1) {
  const parsed = Number.parseInt(value || String(fallback), 10);
  return parsed > 0 ? parsed : fallback;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function countChargeableChars(text) {
  return Array.from(text || "").length;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  logInfo,
  logError,
  getBangkokDateString,
  addMonthsToDateString,
  defaultExpiryDate,
  parseExpiryMonths,
  resolveExpiryDateFromDuration,
  formatDate,
  normalizeExpiryDate,
  formatDateInput,
  parseNonNegativeInteger,
  parsePositiveInteger,
  formatNumber,
  countChargeableChars,
  escapeHtml,
};

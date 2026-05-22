const line = require("@line/bot-sdk");
const { Translate } = require("@google-cloud/translate").v2;
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 8080;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const BOT_USER_ID = process.env.BOT_USER_ID || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const ADMIN_TAILSCALE_ONLY = process.env.ADMIN_TAILSCALE_ONLY === "true";
const ADMIN_ALLOWED_EMAILS = new Set(
  (process.env.ADMIN_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const SESSION_SECRET = process.env.SESSION_SECRET || ADMIN_TOKEN || "";
const LOG_FULL_WEBHOOK_BODY = process.env.LOG_FULL_WEBHOOK_BODY === "true";

const MAX_LINE_TEXT_LENGTH = 4900;
const CACHE_MAX_SIZE = 200;
const MEMBER_CHECK_CACHE_TTL_MS = 10 * 60 * 1000;
const BILLING_TIME_ZONE = "Asia/Bangkok";
const SYSTEM_DEFAULT_MODE = "bilingual";
const SYSTEM_DEFAULT_FROM_LANG = "zh";
const SYSTEM_DEFAULT_TO_LANG = "th";
const ADMIN_SESSION_COOKIE = "linebot_admin_session";
const ADMIN_OAUTH_STATE_COOKIE = "linebot_admin_oauth_state";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

const requiredEnvNames = [
  "LINE_CHANNEL_SECRET",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

for (const envName of requiredEnvNames) {
  if (!process.env[envName]) {
    throw new Error(`Missing required environment variable: ${envName}`);
  }
}

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

function parseJsonEnv(name) {
  const value = process.env[name];
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${name} is not valid JSON: ${error.message}`);
  }
}

function buildTranslateClientOptions() {
  const credentials =
    parseJsonEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON") ||
    parseJsonEnv("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!credentials) return {};
  return { credentials, projectId: credentials.project_id };
}

const translateClient = new Translate(buildTranslateClientOptions());

module.exports = {
  PORT,
  LINE_CHANNEL_ACCESS_TOKEN,
  BOT_USER_ID,
  ADMIN_TOKEN,
  ADMIN_TAILSCALE_ONLY,
  ADMIN_ALLOWED_EMAILS,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  SESSION_SECRET,
  LOG_FULL_WEBHOOK_BODY,
  MAX_LINE_TEXT_LENGTH,
  CACHE_MAX_SIZE,
  MEMBER_CHECK_CACHE_TTL_MS,
  BILLING_TIME_ZONE,
  SYSTEM_DEFAULT_MODE,
  SYSTEM_DEFAULT_FROM_LANG,
  SYSTEM_DEFAULT_TO_LANG,
  ADMIN_SESSION_COOKIE,
  ADMIN_OAUTH_STATE_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  lineClient,
  supabase,
  translateClient,
};

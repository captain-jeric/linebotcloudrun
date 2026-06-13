// Stripe Checkout integration for the subscription plan.
//
// PromptPay (and Alipay, where available) only support one-time payments via
// Checkout — recurring subscription mode is NOT supported — so each purchase is
// a one-time payment that grants one month of quota. Currency MUST be THB and
// amounts are in satang (฿49 = 4900).
//
// Required env vars (all optional at boot; payment is simply disabled until set):
//   STRIPE_SECRET_KEY        sk_live_... / sk_test_...
//   STRIPE_WEBHOOK_SECRET    whsec_...  (from the webhook endpoint in Dashboard)
// Optional:
//   STRIPE_PAYMENT_METHODS   comma list, default "promptpay" (e.g. "promptpay,alipay")
//   PUBLIC_BASE_URL          e.g. https://your-domain — used for success/cancel URLs

const { PLAN } = require("./payment");
const { supabase } = require("./config");
const { findUserByLineUserId } = require("./db");
const { resolveExpiryDateFromDuration, normalizeExpiryDate } = require("./utils");

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");

// PromptPay is always available once a key is set; Alipay only if explicitly enabled.
const PAYMENT_METHODS = (process.env.STRIPE_PAYMENT_METHODS || "promptpay")
  .split(",")
  .map((m) => m.trim().toLowerCase())
  .filter(Boolean);

let stripeClient = null;
if (STRIPE_SECRET_KEY) {
  // eslint-disable-next-line global-require
  stripeClient = require("stripe")(STRIPE_SECRET_KEY);
}

function isStripeConfigured() {
  return Boolean(stripeClient);
}

function getStripeClient() {
  return stripeClient;
}

function getPlanAmountSatang() {
  // PLAN.priceThb is in baht; Stripe expects the smallest unit (satang).
  return Math.round(PLAN.priceThb * 100);
}

function resolveBaseUrl(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  // Fall back to the request's own host (works behind Cloud Run's proxy).
  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  const host = req.get("host");
  return `${proto}://${host}`;
}

// Creates a one-time PromptPay/Alipay Checkout Session for one month of quota.
async function createCheckoutSession(req, { lineUserId }) {
  if (!stripeClient) throw new Error("Stripe is not configured");
  const baseUrl = resolveBaseUrl(req);

  return stripeClient.checkout.sessions.create({
    mode: "payment",
    payment_method_types: PAYMENT_METHODS,
    line_items: [
      {
        price_data: {
          currency: "thb",
          product_data: {
            name: "LINE Translation Bot — 1 month",
            description: `${PLAN.chars.toLocaleString()} characters / month`,
          },
          unit_amount: getPlanAmountSatang(),
        },
        quantity: 1,
      },
    ],
    // line_user_id flows through to the webhook so we know which account to top up.
    metadata: { line_user_id: lineUserId || "" },
    success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/payment/cancel`,
  });
}

// Verifies the Stripe signature and returns the parsed event. Requires the raw
// request body (Buffer), so the route must use express.raw, not express.json.
function constructWebhookEvent(rawBody, signature) {
  if (!stripeClient) throw new Error("Stripe is not configured");
  if (!STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return stripeClient.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
}

// Grants one month of quota to the user named in the session metadata. Called
// from the webhook after a checkout.session.completed event. Idempotency is
// guarded by the caller (we skip events already recorded in user_renewals).
async function fulfillCheckoutSession(session) {
  const lineUserId = String(session?.metadata?.line_user_id || "").trim();
  if (!lineUserId) {
    console.warn("Stripe fulfillment skipped: no line_user_id in metadata", { sessionId: session?.id });
    return { ok: false, reason: "missing_userid" };
  }

  const user = await findUserByLineUserId(lineUserId);
  if (!user) {
    console.warn("Stripe fulfillment: user not found for line_user_id", { lineUserId, sessionId: session?.id });
    return { ok: false, reason: "user_not_found" };
  }

  // Guard against double-processing if Stripe re-delivers the same event.
  const { data: already } = await supabase
    .from("user_renewals")
    .select("id")
    .eq("note", `Stripe ${session.id}`)
    .maybeSingle();
  if (already) {
    return { ok: true, reason: "already_fulfilled" };
  }

  const nextExpiry = resolveExpiryDateFromDuration(
    { expiry_months: PLAN.periodMonths || 1, expires_at: "" },
    1
  );
  const { data: rechargeData, error: rechargeError } = await supabase.rpc("recharge_user_flow", {
    p_user_id: user.id,
    p_chars: PLAN.chars,
    p_expires_at: normalizeExpiryDate(nextExpiry),
  });
  const rechargeResult = Array.isArray(rechargeData) ? rechargeData[0] : null;
  if (rechargeError || !rechargeResult) {
    console.error("Stripe fulfillment recharge failed:", rechargeError);
    return { ok: false, reason: "recharge_failed" };
  }

  const { error: renewalError } = await supabase.from("user_renewals").insert({
    user_id: user.id,
    type: "recharge",
    chars_delta: PLAN.chars,
    expires_at_before: rechargeResult.expires_at_before,
    expires_at_after: rechargeResult.expires_at,
    note: `Stripe ${session.id}`,
  });
  if (renewalError) console.warn("Stripe fulfillment: record renewal failed:", renewalError.message);

  console.log("Stripe fulfillment succeeded:", { lineUserId, sessionId: session.id, chars: PLAN.chars });
  return { ok: true, reason: "fulfilled" };
}

module.exports = {
  isStripeConfigured,
  getStripeClient,
  createCheckoutSession,
  constructWebhookEvent,
  fulfillCheckoutSession,
  getPlanAmountSatang,
  PAYMENT_METHODS,
};

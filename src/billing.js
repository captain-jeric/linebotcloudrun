const BILLING_PLANS = [
  { id: "monthly_9_9_20000", label: "9.9 元 / 2 万字符 / 月", priceCny: 9.9, chars: 20000, months: 1 },
  { id: "monthly_19_9_50000", label: "19.9 元 / 5 万字符 / 月", priceCny: 19.9, chars: 50000, months: 1 },
  { id: "monthly_29_9_100000", label: "29.9 元 / 10 万字符 / 月", priceCny: 29.9, chars: 100000, months: 1 },
];

function getBillingPlan(planId) {
  const id = String(planId || "").trim();
  return BILLING_PLANS.find((plan) => plan.id === id) || null;
}

function buildBillingPlanNote(plan) {
  if (!plan) return "";
  return `${plan.label}`;
}

function applyBillingPlanToBody(body, charsField, monthsField) {
  const plan = getBillingPlan(body?.billing_plan);
  if (!plan) return { body, plan: null };
  return {
    body: {
      ...body,
      [charsField]: String(plan.chars),
      [monthsField]: String(plan.months),
      expires_at: "",
    },
    plan,
  };
}

module.exports = {
  BILLING_PLANS,
  getBillingPlan,
  buildBillingPlanNote,
  applyBillingPlanToBody,
};

// Payment page (Stripe Checkout, PromptPay + Alipay QR only — no card).
// The "Pay" button is a placeholder until the Stripe API is wired up:
// it will POST to /payment/checkout to create a Checkout Session and redirect.

const PLAN = {
  priceThb: 49,
  priceCny: 9.9,
  chars: 30000,
  period: "month",
  periodMonths: 1,
};

const SHARED_HEAD = `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --green: #06c755; --green-dark: #05a847; --green-light: #e8faf0;
      --text: #1a1a1a; --text-muted: #666; --border: #e5e7eb; --radius: 12px;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans Thai', sans-serif;
      color: var(--text); line-height: 1.6;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      min-height: 100vh; display: flex; flex-direction: column;
    }
    .topbar {
      background: rgba(255,255,255,.95); border-bottom: 1px solid var(--border);
      padding: 0 24px; height: 56px; display: flex; align-items: center; justify-content: space-between;
    }
    .topbar a.back { color: var(--text-muted); text-decoration: none; font-size: 14px; }
    .topbar a.back:hover { color: var(--green); }
    .topbar .logo { font-weight: 700; color: var(--green); font-size: 15px; }
    .lang-switcher { display: flex; gap: 4px; }
    .lang-btn {
      border: 1px solid var(--border); background: transparent; padding: 4px 10px;
      border-radius: 16px; font-size: 12px; cursor: pointer; color: var(--text-muted);
    }
    .lang-btn.active { background: var(--green); border-color: var(--green); color: #fff; }
    main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px 20px; }
    .card {
      background: #fff; border-radius: 20px; padding: 40px;
      max-width: 460px; width: 100%; box-shadow: 0 12px 40px rgba(0,0,0,.1);
    }
    .card h1 { font-size: 24px; text-align: center; margin-bottom: 6px; }
    .card .subtitle { text-align: center; color: var(--text-muted); font-size: 14px; margin-bottom: 28px; }
  </style>
`;

const LANG_SWITCHER = `
  <div class="lang-switcher">
    <button class="lang-btn active" data-switch="zh">中</button>
    <button class="lang-btn" data-switch="en">EN</button>
    <button class="lang-btn" data-switch="th">ไทย</button>
  </div>
`;

const LANG_SCRIPT = `
<script>
  (function () {
    function switchLang(lang) {
      document.querySelectorAll('[data-lang]').forEach(function (el) {
        el.style.display = el.getAttribute('data-lang') === lang ? '' : 'none';
      });
      document.querySelectorAll('.lang-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-switch') === lang);
      });
      document.documentElement.lang = lang;
    }
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { switchLang(btn.getAttribute('data-switch')); });
    });
  })();
</script>
`;

function l(zh, en, th) {
  return `<span data-lang="zh">${zh}</span>` +
    `<span data-lang="en" style="display:none">${en}</span>` +
    `<span data-lang="th" style="display:none">${th}</span>`;
}

// ── payment page ────────────────────────────────────────────────────────────────

function renderPaymentPage(options = {}) {
  const enabled = options.enabled === true;
  const pendingBanner = enabled
    ? ""
    : `<div class="pending-banner">
        ${l(
          "在线支付即将上线，目前请先进入售后群联系管理员开通。",
          "Online payment is coming soon. For now, please join the support group to activate via the administrator.",
          "ระบบชำระเงินออนไลน์กำลังจะเปิดให้บริการ ขณะนี้กรุณาเข้ากลุ่มบริการเพื่อให้แอดมินเปิดใช้งาน"
        )}
      </div>`;
  const payBtnAttr = enabled ? "" : "disabled";
  const useridRequired = enabled ? "required" : "";
  return `<!DOCTYPE html>
<html lang="zh">
<head>
  ${SHARED_HEAD}
  <title>订阅 / Subscribe / สมัครใช้งาน — LINE 翻译机器人</title>
  <style>
    .plan-box {
      border: 2px solid var(--green); border-radius: 16px; padding: 24px;
      text-align: center; margin-bottom: 24px; background: var(--green-light);
    }
    .plan-box .price { font-size: 40px; font-weight: 800; color: var(--green-dark); line-height: 1; }
    .plan-box .price small { font-size: 16px; font-weight: 600; }
    .plan-box .price-sub { font-size: 14px; color: var(--text-muted); margin-top: 4px; }
    .plan-box .chars { margin-top: 12px; font-weight: 600; font-size: 15px; }
    .pay-methods { margin-bottom: 24px; }
    .pay-methods .label { font-size: 13px; color: var(--text-muted); margin-bottom: 10px; }
    .method-list { display: flex; gap: 12px; }
    .method {
      flex: 1; border: 1px solid var(--border); border-radius: 12px; padding: 14px;
      display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 13px; font-weight: 600;
    }
    .method .ic { font-size: 24px; }
    .method.promptpay { border-color: #0ea5e9; }
    .method.alipay { border-color: #1677ff; }
    .userid-field { margin-bottom: 20px; }
    .userid-field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
    .userid-field input {
      width: 100%; padding: 12px 14px; border: 1px solid var(--border);
      border-radius: 10px; font-size: 14px;
    }
    .userid-field .hint { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
    .pay-btn {
      width: 100%; background: var(--green); color: #fff; border: none;
      padding: 16px; border-radius: 30px; font-size: 16px; font-weight: 700;
      cursor: pointer; transition: background .2s;
    }
    .pay-btn:hover { background: var(--green-dark); }
    .pay-btn:disabled { background: #cbd5e1; cursor: not-allowed; }
    .notice {
      margin-top: 16px; font-size: 12px; color: var(--text-muted); text-align: center;
    }
    .pending-banner {
      background: #fef3c7; color: #92400e; border-radius: 10px;
      padding: 10px 14px; font-size: 13px; text-align: center; margin-bottom: 20px;
    }
    .secure { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 14px; font-size: 12px; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="topbar">
    <a href="/" class="back">← ${l("返回首页", "Back", "กลับ")}</a>
    <span class="logo">LINE ${l("翻译机器人", "Translation Bot", "บอทแปลภาษา")}</span>
    ${LANG_SWITCHER}
  </div>
  <main>
    <div class="card">
      <h1>${l("订阅套餐", "Subscribe", "สมัครใช้งาน")}</h1>
      <p class="subtitle">${l("使用 PromptPay 或支付宝扫码支付", "Pay by PromptPay or Alipay QR", "ชำระด้วย PromptPay หรือ Alipay")}</p>

      ${pendingBanner}

      <div class="plan-box">
        <div class="price">฿${PLAN.priceThb} <small>/ ${l("月", "month", "เดือน")}</small></div>
        <div class="price-sub">${l(`（约 ${PLAN.priceCny} 元人民币）`, `(approx. CNY ${PLAN.priceCny})`, `(ประมาณ ${PLAN.priceCny} หยวน)`)}</div>
        <div class="chars">${l(`每月 ${PLAN.chars.toLocaleString()} 字符`, `${PLAN.chars.toLocaleString()} characters / month`, `${PLAN.chars.toLocaleString()} ตัวอักษร / เดือน`)}</div>
      </div>

      <div class="pay-methods">
        <div class="label">${l("支持的支付方式", "Supported payment methods", "ช่องทางการชำระเงิน")}</div>
        <div class="method-list">
          <div class="method promptpay"><span class="ic">📱</span>PromptPay</div>
          <div class="method alipay"><span class="ic">🅰️</span>${l("支付宝", "Alipay", "Alipay")}</div>
        </div>
      </div>

      <form id="pay-form" method="POST" action="/payment/checkout">
        <div class="userid-field">
          <label for="userid">${l("你的 USERID", "Your USERID", "USERID ของคุณ")}</label>
          <input type="text" id="userid" name="line_user_id" autocomplete="off" ${useridRequired}
            placeholder="${l("在机器人对话中发送 userid 获取", "Send 'userid' to the bot to get it", "ส่ง 'userid' ให้บอทเพื่อรับค่า")}">
          <div class="hint">${l(
            "用于支付成功后自动为你的账号充值。",
            "Used to automatically top up your account after payment.",
            "ใช้สำหรับเติมเงินเข้าบัญชีของคุณโดยอัตโนมัติหลังชำระเงิน"
          )}</div>
        </div>

        <button type="submit" class="pay-btn" ${payBtnAttr}>
          ${l("立即支付 ฿49", "Pay ฿49 now", "ชำระ ฿49 ทันที")}
        </button>
      </form>

      <div class="secure">🔒 ${l("由 Stripe 安全处理支付", "Payments securely processed by Stripe", "ชำระเงินอย่างปลอดภัยผ่าน Stripe")}</div>

      <p class="notice">${l(
        "点击支付后将跳转到 Stripe 安全收银台扫码完成支付。",
        "After clicking pay, you'll be redirected to Stripe's secure checkout to scan and pay.",
        "หลังคลิกชำระเงิน ระบบจะพาไปยังหน้าชำระเงินที่ปลอดภัยของ Stripe เพื่อสแกนจ่าย"
      )}</p>
    </div>
  </main>
  ${LANG_SCRIPT}
</body>
</html>`;
}

// ── success page ────────────────────────────────────────────────────────────────

function renderPaymentSuccessPage() {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
  ${SHARED_HEAD}
  <title>支付成功 / Payment successful</title>
  <style>
    .result-icon { font-size: 64px; text-align: center; margin-bottom: 12px; }
    .home-btn {
      display: block; text-align: center; background: var(--green); color: #fff;
      padding: 14px; border-radius: 30px; text-decoration: none; font-weight: 700; margin-top: 24px;
    }
    .home-btn:hover { background: var(--green-dark); }
    .body-text { text-align: center; color: var(--text-muted); font-size: 14px; }
  </style>
</head>
<body>
  <div class="topbar">
    <a href="/" class="back">← ${l("返回首页", "Back", "กลับ")}</a>
    <span class="logo">LINE ${l("翻译机器人", "Translation Bot", "บอทแปลภาษา")}</span>
    ${LANG_SWITCHER}
  </div>
  <main>
    <div class="card">
      <div class="result-icon">✅</div>
      <h1>${l("支付成功", "Payment successful", "ชำระเงินสำเร็จ")}</h1>
      <p class="subtitle">${l("感谢订阅！", "Thank you for subscribing!", "ขอบคุณที่สมัครใช้งาน!")}</p>
      <p class="body-text">${l(
        "你的账号额度将在确认收款后自动充值。如未生效，请进入售后群联系管理员并提供你的 USERID。",
        "Your account quota will be topped up automatically once payment is confirmed. If it doesn't apply, please contact the administrator in the support group with your USERID.",
        "โควตาบัญชีของคุณจะถูกเติมโดยอัตโนมัติเมื่อยืนยันการชำระเงิน หากไม่ทำงาน กรุณาติดต่อแอดมินในกลุ่มบริการพร้อมแจ้ง USERID"
      )}</p>
      <a href="/" class="home-btn">${l("返回首页", "Back to home", "กลับหน้าแรก")}</a>
    </div>
  </main>
  ${LANG_SCRIPT}
</body>
</html>`;
}

// ── cancel page ─────────────────────────────────────────────────────────────────

function renderPaymentCancelPage() {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
  ${SHARED_HEAD}
  <title>支付已取消 / Payment cancelled</title>
  <style>
    .result-icon { font-size: 64px; text-align: center; margin-bottom: 12px; }
    .retry-btn {
      display: block; text-align: center; background: var(--green); color: #fff;
      padding: 14px; border-radius: 30px; text-decoration: none; font-weight: 700; margin-top: 24px;
    }
    .retry-btn:hover { background: var(--green-dark); }
    .home-link { display: block; text-align: center; margin-top: 14px; color: var(--text-muted); font-size: 13px; text-decoration: none; }
    .body-text { text-align: center; color: var(--text-muted); font-size: 14px; }
  </style>
</head>
<body>
  <div class="topbar">
    <a href="/" class="back">← ${l("返回首页", "Back", "กลับ")}</a>
    <span class="logo">LINE ${l("翻译机器人", "Translation Bot", "บอทแปลภาษา")}</span>
    ${LANG_SWITCHER}
  </div>
  <main>
    <div class="card">
      <div class="result-icon">⚠️</div>
      <h1>${l("支付已取消", "Payment cancelled", "ยกเลิกการชำระเงิน")}</h1>
      <p class="subtitle">${l("你尚未完成支付。", "Your payment was not completed.", "ยังไม่ได้ชำระเงิน")}</p>
      <p class="body-text">${l(
        "如有疑问，可进入售后群联系管理员。",
        "If you have questions, contact the administrator in the support group.",
        "หากมีคำถาม ติดต่อแอดมินในกลุ่มบริการได้"
      )}</p>
      <a href="/payment" class="retry-btn">${l("重新支付", "Try again", "ลองอีกครั้ง")}</a>
      <a href="/" class="home-link">${l("返回首页", "Back to home", "กลับหน้าแรก")}</a>
    </div>
  </main>
  ${LANG_SCRIPT}
</body>
</html>`;
}

module.exports = {
  PLAN,
  renderPaymentPage,
  renderPaymentSuccessPage,
  renderPaymentCancelPage,
};

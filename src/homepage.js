const TRANSLATIONS = {
  zh: {
    slogan: "LINE 翻译机器人",
    tagline: "助你在泰国自由沟通",
    nav_features: "功能介绍",
    nav_pricing: "套餐价格",
    nav_contact: "联系我们",
    nav_admin: "管理员入口",
    hero_cta: "立即添加机器人",
    features_title: "核心功能",
    features: [
      { icon: "🌐", title: "多语言翻译", desc: "支持中文、泰文、英文、日文等16种语言互译" },
      { icon: "⚡", title: "实时翻译", desc: "群聊消息自动翻译，无需手动操作" },
      { icon: "🎯", title: "三语模式", desc: "中文 / 泰文 / 缅甸文同时互译" },
      { icon: "🔧", title: "灵活配置", desc: "每个群聊独立设置翻译语言和模式" },
    ],
    screenshots_title: "使用截图",
    pricing_title: "套餐价格",
    pricing_price: "49 泰铢",
    pricing_price_sub: "（9.9 元人民币）/ 月",
    pricing_chars: "每月 30,000 字符",
    pricing_features: ["群聊自动翻译", "16 种语言支持", "三语互译模式", "灵活语言设置"],
    pricing_cta: "添加机器人开始使用",
    contact_title: "联系我们",
    contact_desc: "扫描下方二维码加入服务群，发送您的 USERID 联系管理员开通账号。",
    contact_bot: "添加翻译机器人",
    contact_group: "加入服务群",
    footer: "LINE 翻译机器人  · 助你在泰国自由沟通",
  },
  en: {
    slogan: "LINE Translation Bot",
    tagline: "Communicate freely in Thailand",
    nav_features: "Features",
    nav_pricing: "Pricing",
    nav_contact: "Contact",
    nav_admin: "Admin",
    hero_cta: "Add the Bot",
    features_title: "Key Features",
    features: [
      { icon: "🌐", title: "Multi-language", desc: "Supports 16 languages including Chinese, Thai, English, Japanese and more" },
      { icon: "⚡", title: "Real-time", desc: "Auto-translate group messages instantly, no manual steps needed" },
      { icon: "🎯", title: "Trilingual mode", desc: "Simultaneously translate between Chinese, Thai, and Burmese" },
      { icon: "🔧", title: "Flexible setup", desc: "Configure translation language and mode per group chat" },
    ],
    screenshots_title: "Screenshots",
    pricing_title: "Pricing",
    pricing_price: "THB 49",
    pricing_price_sub: "(CNY 9.9) / month",
    pricing_chars: "30,000 characters / month",
    pricing_features: ["Group auto-translation", "16 languages supported", "Trilingual mode", "Flexible language settings"],
    pricing_cta: "Add the bot to get started",
    contact_title: "Contact Us",
    contact_desc: "Scan the QR code below to join our service group, then send your USERID to the administrator to activate your account.",
    contact_bot: "Add Translation Bot",
    contact_group: "Join Service Group",
    footer: "LINE Translation Bot · Communicate freely in Thailand",
  },
  th: {
    slogan: "LINE บอทแปลภาษา",
    tagline: "ช่วยให้คุณสื่อสารได้อย่างอิสระในไทย",
    nav_features: "ฟีเจอร์",
    nav_pricing: "ราคา",
    nav_contact: "ติดต่อ",
    nav_admin: "แอดมิน",
    hero_cta: "เพิ่มบอท",
    features_title: "ฟีเจอร์หลัก",
    features: [
      { icon: "🌐", title: "หลายภาษา", desc: "รองรับ 16 ภาษา รวมถึงจีน ไทย อังกฤษ ญี่ปุ่น และอื่นๆ" },
      { icon: "⚡", title: "แปลแบบเรียลไทม์", desc: "แปลข้อความในกลุ่มอัตโนมัติ ไม่ต้องทำเอง" },
      { icon: "🎯", title: "โหมด 3 ภาษา", desc: "แปลพร้อมกันระหว่างจีน ไทย และพม่า" },
      { icon: "🔧", title: "ตั้งค่าได้ยืดหยุ่น", desc: "ตั้งค่าภาษาและโหมดแปลแยกกันในแต่ละกลุ่ม" },
    ],
    screenshots_title: "ภาพหน้าจอ",
    pricing_title: "ราคา",
    pricing_price: "49 บาท",
    pricing_price_sub: "(9.9 หยวน) / เดือน",
    pricing_chars: "30,000 ตัวอักษร / เดือน",
    pricing_features: ["แปลอัตโนมัติในกลุ่ม", "รองรับ 16 ภาษา", "โหมด 3 ภาษา", "ตั้งค่าภาษาได้ยืดหยุ่น"],
    pricing_cta: "เพิ่มบอทเพื่อเริ่มใช้งาน",
    contact_title: "ติดต่อเรา",
    contact_desc: "สแกน QR code ด้านล่างเพื่อเข้ากลุ่มบริการ จากนั้นส่ง USERID ของคุณให้แอดมินเพื่อเปิดใช้งานบัญชี",
    contact_bot: "เพิ่มบอทแปลภาษา",
    contact_group: "เข้าร่วมกลุ่มบริการ",
    footer: "LINE บอทแปลภาษา · ช่วยให้คุณสื่อสารได้อย่างอิสระในไทย",
  },
};

const SCREENSHOT_FILES = [
  "Screenshot 2026-05-16 at 23.19.43.png",
  "Screenshot 2026-05-16 at 23.20.32.png",
  "Screenshot 2026-05-16 at 23.21.48.png",
  "Screenshot 2026-05-16 at 23.24.42.png",
  "Screenshot 2026-05-16 at 23.29.22.png",
  "Screenshot 2026-05-16 at 23.30.00.png",
  "Screenshot 2026-05-16 at 23.37.56.png",
];

function renderHomePage() {
  const screenshotItems = SCREENSHOT_FILES.map(
    (f) => `<div class="screenshot-item"><img src="/pictures/${encodeURIComponent(f)}" alt="screenshot" loading="lazy"></div>`
  ).join("");

  const featuresZh = TRANSLATIONS.zh.features.map((f) => `<div class="feature-card" data-lang="zh">${f.icon}<h3>${f.title}</h3><p>${f.desc}</p></div>`).join("");
  const featuresEn = TRANSLATIONS.en.features.map((f) => `<div class="feature-card" data-lang="en" style="display:none">${f.icon}<h3>${f.title}</h3><p>${f.desc}</p></div>`).join("");
  const featuresTh = TRANSLATIONS.th.features.map((f) => `<div class="feature-card" data-lang="th" style="display:none">${f.icon}<h3>${f.title}</h3><p>${f.desc}</p></div>`).join("");

  const pricingFeaturesZh = TRANSLATIONS.zh.pricing_features.map((f) => `<li data-lang="zh">✓ ${f}</li>`).join("");
  const pricingFeaturesEn = TRANSLATIONS.en.pricing_features.map((f) => `<li data-lang="en" style="display:none">✓ ${f}</li>`).join("");
  const pricingFeaturesTh = TRANSLATIONS.th.pricing_features.map((f) => `<li data-lang="th" style="display:none">✓ ${f}</li>`).join("");

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LINE 翻译机器人 / LINE Translation Bot / LINE บอทแปลภาษา</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --green: #06c755;
      --green-dark: #05a847;
      --green-light: #e8faf0;
      --text: #1a1a1a;
      --text-muted: #666;
      --bg: #fff;
      --border: #e5e7eb;
      --radius: 12px;
    }
    html { scroll-behavior: smooth; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans Thai', sans-serif; color: var(--text); background: var(--bg); line-height: 1.6; }

    /* nav */
    nav {
      position: sticky; top: 0; z-index: 100;
      background: rgba(255,255,255,0.95); backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; height: 60px;
    }
    .nav-logo { font-weight: 700; font-size: 16px; color: var(--green); white-space: nowrap; }
    .nav-links { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
    .nav-links a { text-decoration: none; color: var(--text-muted); font-size: 14px; transition: color .2s; }
    .nav-links a:hover { color: var(--green); }
    .nav-links a.admin-link {
      background: var(--green); color: #fff; padding: 6px 14px;
      border-radius: 20px; font-size: 13px;
    }
    .nav-links a.admin-link:hover { background: var(--green-dark); color: #fff; }
    .lang-switcher { display: flex; gap: 4px; }
    .lang-btn {
      border: 1px solid var(--border); background: transparent;
      padding: 4px 10px; border-radius: 16px; font-size: 12px;
      cursor: pointer; transition: all .2s; color: var(--text-muted);
    }
    .lang-btn.active { background: var(--green); border-color: var(--green); color: #fff; }

    /* hero */
    .hero {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%);
      padding: 80px 24px 60px;
      text-align: center;
    }
    .hero-badge {
      display: inline-block; background: var(--green); color: #fff;
      font-size: 12px; padding: 4px 14px; border-radius: 20px; margin-bottom: 20px;
    }
    .hero h1 { font-size: clamp(28px, 5vw, 52px); font-weight: 800; color: var(--text); margin-bottom: 12px; }
    .hero .tagline { font-size: clamp(16px, 2.5vw, 22px); color: var(--text-muted); margin-bottom: 32px; }
    .hero-cta {
      display: inline-block; background: var(--green); color: #fff;
      padding: 14px 36px; border-radius: 30px; text-decoration: none;
      font-size: 16px; font-weight: 600; transition: background .2s, transform .15s;
      box-shadow: 0 4px 14px rgba(6,199,85,.35);
    }
    .hero-cta:hover { background: var(--green-dark); transform: translateY(-2px); }

    /* sections */
    section { padding: 64px 24px; max-width: 1100px; margin: 0 auto; }
    .section-title { font-size: clamp(22px, 3vw, 32px); font-weight: 700; text-align: center; margin-bottom: 40px; }

    /* features */
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
    .feature-card {
      background: var(--green-light); border-radius: var(--radius);
      padding: 28px 24px; text-align: center;
    }
    .feature-card .icon { font-size: 36px; margin-bottom: 12px; }
    .feature-card h3 { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
    .feature-card p { font-size: 14px; color: var(--text-muted); }

    /* screenshots */
    .screenshots-section { background: #f9fafb; padding: 64px 24px; }
    .screenshots-inner { max-width: 1100px; margin: 0 auto; }
    .screenshot-track-wrapper { overflow: hidden; position: relative; }
    .screenshot-track {
      display: flex; gap: 16px;
      animation: scroll-track 32s linear infinite;
      width: max-content;
    }
    .screenshot-track:hover { animation-play-state: paused; }
    @keyframes scroll-track {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    .screenshot-item { flex-shrink: 0; width: 220px; }
    .screenshot-item img {
      width: 100%; border-radius: var(--radius);
      border: 1px solid var(--border);
      box-shadow: 0 2px 8px rgba(0,0,0,.08);
    }

    /* pricing */
    .pricing-wrapper { display: flex; justify-content: center; }
    .pricing-card {
      background: linear-gradient(135deg, var(--green) 0%, var(--green-dark) 100%);
      color: #fff; border-radius: 20px; padding: 40px 48px;
      text-align: center; max-width: 380px; width: 100%;
      box-shadow: 0 8px 32px rgba(6,199,85,.3);
    }
    .pricing-card .price { font-size: 48px; font-weight: 800; line-height: 1; margin: 16px 0 4px; }
    .pricing-card .price-sub { font-size: 15px; opacity: .85; margin-bottom: 8px; }
    .pricing-card .chars { font-size: 16px; font-weight: 600; margin-bottom: 24px; opacity: .9; }
    .pricing-card ul { list-style: none; text-align: left; margin-bottom: 28px; }
    .pricing-card ul li { padding: 6px 0; font-size: 15px; opacity: .95; }
    .pricing-cta {
      display: inline-block; background: #fff; color: var(--green);
      padding: 12px 32px; border-radius: 25px; text-decoration: none;
      font-size: 15px; font-weight: 700; transition: transform .15s;
    }
    .pricing-cta:hover { transform: translateY(-2px); }

    /* contact */
    .contact-section { background: #f9fafb; padding: 64px 24px; }
    .contact-inner { max-width: 700px; margin: 0 auto; text-align: center; }
    .contact-desc { color: var(--text-muted); margin-bottom: 36px; font-size: 15px; }
    .qr-grid { display: flex; gap: 40px; justify-content: center; flex-wrap: wrap; }
    .qr-item { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .qr-item img { width: 160px; height: 160px; object-fit: contain; border-radius: var(--radius); border: 1px solid var(--border); padding: 8px; background: #fff; }
    .qr-label { font-size: 14px; font-weight: 600; color: var(--text-muted); }

    /* footer */
    footer {
      background: var(--text); color: #aaa;
      text-align: center; padding: 24px;
      font-size: 13px;
    }

    @media (max-width: 600px) {
      nav { padding: 0 16px; }
      .nav-links { gap: 12px; }
      .pricing-card { padding: 32px 28px; }
    }
  </style>
</head>
<body>

<!-- nav -->
<nav>
  <div class="nav-logo">
    <span data-lang="zh">LINE 翻译机器人</span>
    <span data-lang="en" style="display:none">LINE Translation Bot</span>
    <span data-lang="th" style="display:none">LINE บอทแปลภาษา</span>
  </div>
  <div class="nav-links">
    <a href="#features" data-i18n="nav_features">功能介绍</a>
    <a href="#pricing" data-i18n="nav_pricing">套餐价格</a>
    <a href="#contact" data-i18n="nav_contact">联系我们</a>
    <a href="/admin" class="admin-link" data-i18n="nav_admin">管理员入口</a>
    <div class="lang-switcher">
      <button class="lang-btn active" data-switch="zh">中</button>
      <button class="lang-btn" data-switch="en">EN</button>
      <button class="lang-btn" data-switch="th">ไทย</button>
    </div>
  </div>
</nav>

<!-- hero -->
<div class="hero">
  <div class="hero-badge">LINE Bot</div>
  <h1>
    <span data-lang="zh">LINE 翻译机器人</span>
    <span data-lang="en" style="display:none">LINE Translation Bot</span>
    <span data-lang="th" style="display:none">LINE บอทแปลภาษา</span>
  </h1>
  <p class="tagline">
    <span data-lang="zh">助你在泰国自由沟通</span>
    <span data-lang="en" style="display:none">Communicate freely in Thailand</span>
    <span data-lang="th" style="display:none">ช่วยให้คุณสื่อสารได้อย่างอิสระในไทย</span>
  </p>
  <a href="#contact" class="hero-cta">
    <span data-lang="zh">立即添加机器人</span>
    <span data-lang="en" style="display:none">Add the Bot</span>
    <span data-lang="th" style="display:none">เพิ่มบอท</span>
  </a>
</div>

<!-- features -->
<section id="features">
  <h2 class="section-title">
    <span data-lang="zh">核心功能</span>
    <span data-lang="en" style="display:none">Key Features</span>
    <span data-lang="th" style="display:none">ฟีเจอร์หลัก</span>
  </h2>
  <div class="features-grid">
    ${featuresZh}${featuresEn}${featuresTh}
  </div>
</section>

<!-- screenshots -->
<div class="screenshots-section" id="screenshots">
  <div class="screenshots-inner">
    <h2 class="section-title">
      <span data-lang="zh">使用截图</span>
      <span data-lang="en" style="display:none">Screenshots</span>
      <span data-lang="th" style="display:none">ภาพหน้าจอ</span>
    </h2>
    <div class="screenshot-track-wrapper">
      <div class="screenshot-track">
        ${screenshotItems}${screenshotItems}
      </div>
    </div>
  </div>
</div>

<!-- pricing -->
<section id="pricing">
  <h2 class="section-title">
    <span data-lang="zh">套餐价格</span>
    <span data-lang="en" style="display:none">Pricing</span>
    <span data-lang="th" style="display:none">ราคา</span>
  </h2>
  <div class="pricing-wrapper">
    <div class="pricing-card">
      <div class="price">
        <span data-lang="zh">49 THB</span>
        <span data-lang="en" style="display:none">THB 49</span>
        <span data-lang="th" style="display:none">49 บาท</span>
      </div>
      <div class="price-sub">
        <span data-lang="zh">（9.9 元人民币）/ 月</span>
        <span data-lang="en" style="display:none">(CNY 9.9) / month</span>
        <span data-lang="th" style="display:none">(9.9 หยวน) / เดือน</span>
      </div>
      <div class="chars">
        <span data-lang="zh">每月 30,000 字符</span>
        <span data-lang="en" style="display:none">30,000 characters / month</span>
        <span data-lang="th" style="display:none">30,000 ตัวอักษร / เดือน</span>
      </div>
      <ul>
        ${pricingFeaturesZh}${pricingFeaturesEn}${pricingFeaturesTh}
      </ul>
      <a href="#contact" class="pricing-cta">
        <span data-lang="zh">添加机器人开始使用</span>
        <span data-lang="en" style="display:none">Add the bot to get started</span>
        <span data-lang="th" style="display:none">เพิ่มบอทเพื่อเริ่มใช้งาน</span>
      </a>
    </div>
  </div>
</section>

<!-- contact -->
<div class="contact-section" id="contact">
  <div class="contact-inner">
    <h2 class="section-title">
      <span data-lang="zh">联系我们</span>
      <span data-lang="en" style="display:none">Contact Us</span>
      <span data-lang="th" style="display:none">ติดต่อเรา</span>
    </h2>
    <p class="contact-desc">
      <span data-lang="zh">扫描下方二维码加入服务群，发送您的 USERID 联系管理员开通账号。</span>
      <span data-lang="en" style="display:none">Scan the QR code below to join our service group, then send your USERID to the administrator to activate your account.</span>
      <span data-lang="th" style="display:none">สแกน QR code ด้านล่างเพื่อเข้ากลุ่มบริการ จากนั้นส่ง USERID ของคุณให้แอดมินเพื่อเปิดใช้งานบัญชี</span>
    </p>
    <div class="qr-grid">
      <div class="qr-item">
        <img src="/pictures/linbot_qrcode.png" alt="LINE Bot QR Code">
        <div class="qr-label">
          <span data-lang="zh">添加翻译机器人</span>
          <span data-lang="en" style="display:none">Add Translation Bot</span>
          <span data-lang="th" style="display:none">เพิ่มบอทแปลภาษา</span>
        </div>
      </div>
      <div class="qr-item">
        <img src="/pictures/IMG_8564176DD566-1.jpeg" alt="LINE Service Group QR Code">
        <div class="qr-label">
          <span data-lang="zh">加入服务群</span>
          <span data-lang="en" style="display:none">Join Service Group</span>
          <span data-lang="th" style="display:none">เข้าร่วมกลุ่มบริการ</span>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- footer -->
<footer>
  <span data-lang="zh">LINE 翻译机器人 · 助你在泰国自由沟通</span>
  <span data-lang="en" style="display:none">LINE Translation Bot · Communicate freely in Thailand</span>
  <span data-lang="th" style="display:none">LINE บอทแปลภาษา · ช่วยให้คุณสื่อสารได้อย่างอิสระในไทย</span>
</footer>

<script>
  (function () {
    var current = 'zh';

    function switchLang(lang) {
      current = lang;
      document.querySelectorAll('[data-lang]').forEach(function (el) {
        el.style.display = el.getAttribute('data-lang') === lang ? '' : 'none';
      });
      document.querySelectorAll('.lang-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-switch') === lang);
      });
      document.documentElement.lang = lang;
    }

    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchLang(btn.getAttribute('data-switch'));
      });
    });
  })();
</script>
</body>
</html>`;
}

module.exports = { renderHomePage };

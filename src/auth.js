const crypto = require("crypto");
const {
  ADMIN_TOKEN, ADMIN_ALLOWED_EMAILS, SESSION_SECRET,
  ADMIN_SESSION_COOKIE, ADMIN_OAUTH_STATE_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS,
  ADMIN_TAILSCALE_ONLY,
} = require("./config");

function getCookie(req, name) {
  const cookies = String(req.get("cookie") || "").split(";");
  for (const cookie of cookies) {
    const [rawKey, ...rawValue] = cookie.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return "";
}

function buildCookie(name, value, maxAgeSeconds) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/admin",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ];
  if (maxAgeSeconds === 0) {
    parts.push("Max-Age=0");
  } else if (maxAgeSeconds) {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  }
  return parts.join("; ");
}

function signValue(value) {
  if (!SESSION_SECRET) return "";
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createSignedCookieValue(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signValue(encoded)}`;
}

function readSignedCookieValue(value) {
  if (!value || !SESSION_SECRET) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  const expected = signValue(encoded);
  const valid =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch (_error) {
    return null;
  }
}

function createAdminSession(email) {
  return createSignedCookieValue({
    email: String(email || "").toLowerCase(),
    exp: Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  });
}

function getAdminSession(req) {
  const payload = readSignedCookieValue(getCookie(req, ADMIN_SESSION_COOKIE));
  if (!payload?.email || !payload?.exp || payload.exp < Date.now()) return null;
  if (!ADMIN_ALLOWED_EMAILS.has(String(payload.email).toLowerCase())) return null;
  return payload;
}

function isGoogleAdminConfigured() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = require("./config");
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && SESSION_SECRET && ADMIN_ALLOWED_EMAILS.size > 0);
}

function getExternalBaseUrl(req) {
  const proto = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0];
  return `${proto}://${req.get("host")}`;
}

function getGoogleRedirectUri(req) {
  return `${getExternalBaseUrl(req)}/admin/auth/google/callback`;
}

function getRemoteAddress(req) {
  return String(req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
}

function getRequestHost(req) {
  return String(req.get("host") || "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(":")[0];
}

function isLocalOrTailscaleAddress(address) {
  if (!address) return false;
  if (address === "127.0.0.1" || address === "::1" || address === "localhost") return true;
  if (address.startsWith("fd7a:115c:a1e0:")) return true;
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  return parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127;
}

function adminTokenFromRequest(req) {
  return req.query.token || req.body?.token || req.get("x-admin-token") || "";
}

function requireAdmin(req, res, next) {
  const remoteAddress = getRemoteAddress(req);
  const requestHost = getRequestHost(req);
  const isPrivateAdminRequest =
    isLocalOrTailscaleAddress(remoteAddress) || isLocalOrTailscaleAddress(requestHost);

  if (ADMIN_TAILSCALE_ONLY && !isPrivateAdminRequest) {
    res.status(403).send("Admin page is only available from localhost or Tailscale.");
    return;
  }

  const session = getAdminSession(req);
  if (session) {
    req.adminEmail = session.email;
    next();
    return;
  }

  if (ADMIN_TOKEN && adminTokenFromRequest(req) === ADMIN_TOKEN) {
    req.adminEmail = "ADMIN_TOKEN";
    next();
    return;
  }

  const { renderAdminLogin } = require("./admin-ui");
  res.status(401).send(renderAdminLogin(req.query.error || ""));
}

module.exports = {
  getCookie,
  buildCookie,
  signValue,
  createSignedCookieValue,
  readSignedCookieValue,
  createAdminSession,
  getAdminSession,
  isGoogleAdminConfigured,
  getExternalBaseUrl,
  getGoogleRedirectUri,
  getRemoteAddress,
  getRequestHost,
  isLocalOrTailscaleAddress,
  adminTokenFromRequest,
  requireAdmin,
};

const crypto = require('crypto');
const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canCreateActivity } = require('./roles');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const QR_PREFIX = 'football-signup-web-admin-login';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function nowDate(now) {
  if (typeof now === 'function') {
    const value = now();
    return value instanceof Date ? value : new Date(value);
  }

  if (now) {
    return now instanceof Date ? now : new Date(now);
  }

  return new Date();
}

function randomToken(deps = {}) {
  if (typeof deps.randomToken === 'function') {
    return deps.randomToken();
  }

  return crypto.randomBytes(32).toString('base64url');
}

function parseQrPayload(payload) {
  const text = String(payload || '').trim();
  const parts = text.split(':');
  if (parts.length !== 3 || parts[0] !== QR_PREFIX || !parts[1] || !parts[2]) {
    throw businessError('Invalid web admin login code');
  }

  return {
    loginId: parts[1],
    confirmToken: parts[2]
  };
}

function isExpired(value, now) {
  const expiresAt = Date.parse(value || '');
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime();
}

async function loadUser(db, openid) {
  const res = await db.collection(COLLECTIONS.USERS).doc(openid).get();
  return res && res.data ? res.data : null;
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const payload = event || {};
  const db = deps.db || cloud.database();
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
  const now = nowDate(deps.now);
  const user = await loadUser(db, openid);

  if (!canCreateActivity(user)) {
    throw businessError('Only organizers or admins can confirm web admin login');
  }

  const { loginId, confirmToken } = parseQrPayload(payload.qrPayload || payload.loginCode);
  const ref = db.collection(COLLECTIONS.WEB_ADMIN_SESSIONS).doc(loginId);
  const res = await ref.get();
  const session = res && res.data ? res.data : null;

  if (!session || session.confirmToken !== confirmToken) {
    throw businessError('Invalid web admin login code');
  }

  if (session.status !== 'pending') {
    throw businessError('Web admin login code has already been used');
  }

  if (isExpired(session.expiresAt, now)) {
    throw businessError('Web admin login code expired');
  }

  const sessionToken = randomToken(deps);
  const sessionExpiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  await ref.update({
    data: {
      status: 'confirmed',
      confirmedOpenId: openid,
      confirmedAt: now.toISOString(),
      sessionToken,
      sessionExpiresAt
    }
  });

  return {
    ok: true,
    status: 'confirmed'
  };
}

module.exports = {
  QR_PREFIX,
  SESSION_TTL_MS,
  main,
  parseQrPayload
};

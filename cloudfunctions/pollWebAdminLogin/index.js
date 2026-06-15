const cloud = require('wx-server-sdk');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { getRoles } = require('./roles');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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

function isExpired(value, now) {
  const expiresAt = Date.parse(value || '');
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime();
}

async function loadUser(db, openid) {
  const res = await db.collection(COLLECTIONS.USERS).doc(openid).get();
  return res && res.data ? res.data : null;
}

function toSafeUser(openid, user) {
  return {
    _id: openid,
    preferredName: user.preferredName || '',
    displayName: user.displayName || '',
    nickName: user.nickName || user.nickname || '',
    avatarUrl: user.avatarUrl || '',
    roles: getRoles(user)
  };
}

async function main(event, context = {}, deps = {}) {
  const payload = event || {};
  const db = deps.db || cloud.database();
  const loginId = String(payload.loginId || '').trim();
  const pollToken = String(payload.pollToken || '').trim();
  const now = nowDate(deps.now);

  if (!loginId || !pollToken) {
    throw businessError('loginId and pollToken are required');
  }

  const res = await db.collection(COLLECTIONS.WEB_ADMIN_SESSIONS).doc(loginId).get();
  const session = res && res.data ? res.data : null;

  if (!session || session.pollToken !== pollToken) {
    throw businessError('Invalid web admin login poll token');
  }

  if (session.status === 'pending') {
    if (isExpired(session.expiresAt, now)) {
      return { status: 'expired' };
    }

    return { status: 'pending' };
  }

  if (
    session.status !== 'confirmed' ||
    !session.confirmedOpenId ||
    !session.sessionToken ||
    isExpired(session.sessionExpiresAt, now)
  ) {
    return { status: 'expired' };
  }

  const user = await loadUser(db, session.confirmedOpenId);

  return {
    status: 'confirmed',
    webAdminSessionToken: session.sessionToken,
    expiresAt: session.sessionExpiresAt,
    user: toSafeUser(session.confirmedOpenId, user || {})
  };
}

module.exports = { main };

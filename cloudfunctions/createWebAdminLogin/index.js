const crypto = require('crypto');
const cloud = require('wx-server-sdk');
const { COLLECTIONS } = require('./collections');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const LOGIN_TTL_MS = 5 * 60 * 1000;
const QR_PREFIX = 'football-signup-web-admin-login';

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

  return crypto.randomBytes(24).toString('base64url');
}

async function main(event, context = {}, deps = {}) {
  const db = deps.db || cloud.database();
  const createdAtDate = nowDate(deps.now);
  const expiresAtDate = new Date(createdAtDate.getTime() + LOGIN_TTL_MS);
  const loginId = randomToken(deps);
  const confirmToken = randomToken(deps);
  const pollToken = randomToken(deps);
  const qrPayload = `${QR_PREFIX}:${loginId}:${confirmToken}`;

  await db.collection(COLLECTIONS.WEB_ADMIN_SESSIONS).doc(loginId).set({
    data: {
      status: 'pending',
      confirmToken,
      pollToken,
      createdAt: createdAtDate.toISOString(),
      expiresAt: expiresAtDate.toISOString()
    }
  });

  return {
    loginId,
    pollToken,
    qrPayload,
    status: 'pending',
    expiresAt: expiresAtDate.toISOString()
  };
}

module.exports = {
  LOGIN_TTL_MS,
  QR_PREFIX,
  main
};

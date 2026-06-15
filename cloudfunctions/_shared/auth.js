function resolveOpenId(context, getWXContext) {
  const wxContext = typeof getWXContext === 'function' ? getWXContext() : {};
  const openid = readString(context, ['OPENID', 'openid']) || readString(wxContext, ['OPENID', 'openid']);

  if (openid) {
    return openid;
  }

  throw new Error('OPENID is required');
}

async function resolveOpenIdFromEvent(event, context, db, deps = {}) {
  try {
    return resolveOpenId(context, deps.getWXContext);
  } catch (error) {
    const token = readString(event, ['webAdminSessionToken', 'sessionToken']);
    if (!token) {
      throw error;
    }

    return resolveWebAdminSessionToken(db, token, deps);
  }
}

function readString(source, keys) {
  if (!source) {
    return '';
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getNowMs(now) {
  if (typeof now === 'function') {
    const value = now();
    return value instanceof Date ? value.getTime() : Date.parse(value);
  }

  if (now instanceof Date) {
    return now.getTime();
  }

  if (now) {
    return Date.parse(now);
  }

  return Date.now();
}

function isExpired(value, now) {
  const expiresAt = Date.parse(value || '');
  const nowMs = getNowMs(now);
  return Number.isFinite(expiresAt) && Number.isFinite(nowMs) && expiresAt <= nowMs;
}

async function resolveWebAdminSessionToken(db, token, deps = {}) {
  if (db && typeof db._resolveWebAdminSessionToken === 'function') {
    const openid = await db._resolveWebAdminSessionToken(token);
    if (openid) {
      return openid;
    }
  }

  if (!db || typeof db.collection !== 'function') {
    throw new Error('OPENID is required');
  }

  const res = await db
    .collection('web_admin_sessions')
    .where({
      sessionToken: token,
      status: 'confirmed'
    })
    .limit(1)
    .get();
  const session = res && Array.isArray(res.data) ? res.data[0] : null;

  if (!session || !session.confirmedOpenId || isExpired(session.sessionExpiresAt, deps.now)) {
    throw new Error('OPENID is required');
  }

  return session.confirmedOpenId;
}

module.exports = {
  resolveOpenId,
  resolveOpenIdFromEvent,
  resolveWebAdminSessionToken
};

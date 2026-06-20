const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { getRoles, hasRole, isAdmin } = require('./roles');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function normalizeLimit(value) {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(limit), MAX_LIMIT);
}

function normalizeSkip(value) {
  const skip = Number(value);
  if (!Number.isFinite(skip) || skip <= 0) {
    return 0;
  }

  return Math.floor(skip);
}

async function loadUser(db, openid) {
  const res = await db.collection(COLLECTIONS.USERS).doc(openid).get();
  return res && res.data ? res.data : null;
}

function pickAvatarUrl(user, registrationAvatarUrl) {
  return (
    user.avatarUrl ||
    user.avatarURL ||
    user.avatar ||
    user.photoUrl ||
    user.photoURL ||
    registrationAvatarUrl ||
    ''
  );
}

function getRegistrationAvatarTimestamp(registration) {
  return String(
    registration.updatedAt ||
    registration.joinedAt ||
    registration.createdAt ||
    ''
  );
}

async function loadRegistrationAvatarUrlsByUser(db) {
  try {
    const res = await db.collection(COLLECTIONS.REGISTRATIONS).get();
    const registrations = Array.isArray(res.data) ? res.data : [];
    return registrations.reduce((acc, registration) => {
      const userOpenId = String(registration.userOpenId || '').trim();
      const avatarUrl = String(registration.avatarUrl || '').trim();
      if (!userOpenId || !avatarUrl || registration.proxyRegistration) {
        return acc;
      }

      const timestamp = getRegistrationAvatarTimestamp(registration);
      const current = acc[userOpenId];
      if (!current || timestamp >= current.timestamp) {
        acc[userOpenId] = { avatarUrl, timestamp };
      }

      return acc;
    }, {});
  } catch (error) {
    return {};
  }
}

function userMatchesKeyword(user, keyword) {
  if (!keyword) {
    return true;
  }

  return [
    user._id,
    user.preferredName,
    user.displayName,
    user.nickName,
    user.nickname,
    user.managerAlias
  ]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(keyword));
}

function toSafeUser(user, registrationAvatarsByUser = {}) {
  const registrationAvatar = registrationAvatarsByUser[user._id] || {};

  return {
    _id: user._id || '',
    preferredName: user.preferredName || '',
    displayName: user.displayName || '',
    nickName: user.nickName || user.nickname || '',
    avatarUrl: pickAvatarUrl(user, registrationAvatar.avatarUrl),
    managerAlias: user.managerAlias || '',
    roles: getRoles(user),
    createdAt: user.createdAt || '',
    lastActiveAt: user.lastActiveAt || ''
  };
}

function compareUsers(left, right) {
  const createdCompare = String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
  if (createdCompare !== 0) {
    return createdCompare;
  }

  return String(left.lastActiveAt || '').localeCompare(String(right.lastActiveAt || ''));
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const payload = event || {};
  const db = deps.db || cloud.database();
  const openid = await resolveOpenIdFromEvent(
    event,
    context,
    db,
    { ...deps, getWXContext: deps.getWXContext || (() => cloud.getWXContext()) }
  );
  const caller = await loadUser(db, openid);

  if (!isAdmin(caller)) {
    throw businessError('Only admins can list users');
  }

  const keyword = String(payload.keyword || '').trim().toLowerCase();
  const role = String(payload.role || '').trim();
  const skip = normalizeSkip(payload.skip);
  const limit = normalizeLimit(payload.limit);
  const res = await db.collection(COLLECTIONS.USERS).get();
  const users = Array.isArray(res.data) ? res.data : [];
  const registrationAvatarsByUser = await loadRegistrationAvatarUrlsByUser(db);
  const filtered = users
    .map(user => toSafeUser(user, registrationAvatarsByUser))
    .filter(user => userMatchesKeyword(user, keyword))
    .filter(user => (role ? hasRole(user, role) : true))
    .sort(compareUsers);

  return {
    items: filtered.slice(skip, skip + limit),
    hasMore: filtered.length > skip + limit
  };
}

module.exports = { main };

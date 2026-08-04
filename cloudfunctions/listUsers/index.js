const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { getRoles, hasRole, isAdmin } = require('./roles');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const COLLECTION_BATCH_SIZE = 100;

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

async function loadCollection(db, command, collectionName, criteria = {}) {
  const items = [];
  let lastId = '';

  while (true) {
    const pageCriteria = lastId ? { ...criteria, _id: command.gt(lastId) } : criteria;
    const result = await db
      .collection(collectionName)
      .where(pageCriteria)
      .orderBy('_id', 'asc')
      .limit(COLLECTION_BATCH_SIZE)
      .get();
    const batch = Array.isArray(result.data) ? result.data : [];
    items.push(...batch);

    if (batch.length < COLLECTION_BATCH_SIZE) {
      return Array.from(new Map(items.map(item => [item._id, item])).values());
    }

    lastId = batch[batch.length - 1]._id;
    if (!lastId) {
      throw new Error(`${collectionName} cursor pagination requires document _id`);
    }
  }
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

async function loadRegistrationAvatarUrlsByUser(db, command, userOpenIds) {
  const normalizedOpenIds = Array.from(new Set(userOpenIds.filter(Boolean)));
  if (normalizedOpenIds.length === 0) {
    return {};
  }

  try {
    const registrations = await loadCollection(db, command, COLLECTIONS.REGISTRATIONS, {
      userOpenId: command.in(normalizedOpenIds)
    });
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

  const activeCompare = String(left.lastActiveAt || '').localeCompare(String(right.lastActiveAt || ''));
  if (activeCompare !== 0) {
    return activeCompare;
  }

  return String(left._id || '').localeCompare(String(right._id || ''));
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
  const command = deps.command || db.command;
  const users = await loadCollection(
    db,
    command,
    COLLECTIONS.USERS,
    role ? { roles: role } : {}
  );
  const filtered = users
    .map(user => toSafeUser(user))
    .filter(user => userMatchesKeyword(user, keyword))
    .filter(user => (role ? hasRole(user, role) : true))
    .sort(compareUsers);
  const pageUsers = filtered.slice(skip, skip + limit);
  const fallbackAvatarOpenIds = pageUsers
    .filter(user => !user.avatarUrl)
    .map(user => user._id);
  const registrationAvatarsByUser = await loadRegistrationAvatarUrlsByUser(
    db,
    command,
    fallbackAvatarOpenIds
  );

  return {
    items: pageUsers.map(user => toSafeUser(user, registrationAvatarsByUser)),
    total: filtered.length,
    limit,
    skip,
    hasMore: filtered.length > skip + limit
  };
}

module.exports = { main };

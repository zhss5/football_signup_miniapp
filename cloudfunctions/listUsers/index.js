const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
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

function userMatchesKeyword(user, keyword) {
  if (!keyword) {
    return true;
  }

  return [
    user._id,
    user.preferredName,
    user.displayName,
    user.nickName,
    user.nickname
  ]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(keyword));
}

function toSafeUser(user) {
  return {
    _id: user._id || '',
    preferredName: user.preferredName || '',
    displayName: user.displayName || '',
    nickName: user.nickName || user.nickname || '',
    avatarUrl: user.avatarUrl || '',
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
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
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
  const filtered = users
    .map(toSafeUser)
    .filter(user => userMatchesKeyword(user, keyword))
    .filter(user => (role ? hasRole(user, role) : true))
    .sort(compareUsers);

  return {
    items: filtered.slice(skip, skip + limit),
    hasMore: filtered.length > skip + limit
  };
}

module.exports = { main };

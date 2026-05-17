const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');

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

function sortActivitiesByStartDesc(items) {
  return items.slice().sort((left, right) => {
    const startCompare = String(right.startAt || '').localeCompare(String(left.startAt || ''));
    if (startCompare !== 0) {
      return startCompare;
    }

    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
  });
}

function pageActivities(items, event) {
  const skip = normalizeSkip(event.skip);
  const limit = normalizeLimit(event.limit);
  return sortActivitiesByStartDesc(items).slice(skip, skip + limit);
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const payload = event || {};
  const db = deps.db || cloud.database();
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
  const limit = normalizeLimit(payload.limit);
  const skip = normalizeSkip(payload.skip);

  if (payload.scope === 'home') {
    const res = await db.collection('activities').where({
      status: db.command.in(['published', 'cancelled'])
    }).orderBy('startAt', 'desc').skip(skip).limit(limit).get();
    return { items: res.data };
  }

  if (payload.scope === 'created') {
    const res = await db.collection('activities')
      .where({ organizerOpenId: openid })
      .orderBy('startAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get();
    return { items: res.data };
  }

  if (payload.scope === 'joined') {
    const regRes = await db.collection('registrations').where({ userOpenId: openid, status: 'joined' }).get();
    const activityIds = regRes.data.map(item => item.activityId);
    if (activityIds.length === 0) {
      return { items: [] };
    }

    const activityRes = await db.collection('activities').where({
      _id: db.command.in(activityIds)
    }).get();

    return {
      items: pageActivities(activityRes.data.filter(item => item.status !== 'deleted'), payload)
    };
  }

  const res = await db.collection('activities')
    .where({ status: payload.status || 'published' })
    .orderBy('startAt', 'desc')
    .skip(skip)
    .limit(limit)
    .get();
  return { items: res.data };
}

module.exports = { main };

const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const db = cloud.database();
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));

  if (event.scope === 'home') {
    const res = await db.collection('activities').where({
      status: db.command.in(['published', 'cancelled'])
    }).get();
    return { items: res.data };
  }

  if (event.scope === 'created') {
    const res = await db.collection('activities').where({ organizerOpenId: openid }).get();
    return { items: res.data };
  }

  if (event.scope === 'joined') {
    const regRes = await db.collection('registrations').where({ userOpenId: openid, status: 'joined' }).get();
    const activityIds = regRes.data.map(item => item.activityId);
    if (activityIds.length === 0) {
      return { items: [] };
    }

    const activityRes = await db.collection('activities').where({
      _id: db.command.in(activityIds)
    }).get();

    return {
      items: activityRes.data.filter(item => item.status !== 'deleted')
    };
  }

  const res = await db.collection('activities').where({ status: event.status || 'published' }).get();
  return { items: res.data };
}

module.exports = { main };

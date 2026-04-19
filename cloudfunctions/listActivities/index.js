const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext()) {
  const db = cloud.database();

  if (event.scope === 'home') {
    const res = await db.collection('activities').where({
      status: db.command.in(['published', 'cancelled'])
    }).get();
    return { items: res.data };
  }

  if (event.scope === 'created') {
    const res = await db.collection('activities').where({ organizerOpenId: context.OPENID }).get();
    return { items: res.data };
  }

  if (event.scope === 'joined') {
    const regRes = await db.collection('registrations').where({ userOpenId: context.OPENID, status: 'joined' }).get();
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

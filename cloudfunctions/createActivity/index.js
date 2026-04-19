const cloud = require('wx-server-sdk');
const { nowIso } = require('../_shared/time');
const { validateActivityDraft } = require('../_shared/validators');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const db = deps.db || cloud.database();
  validateActivityDraft(event);

  const stamp = nowIso(deps.now);
  const activityData = {
    title: event.title.trim(),
    organizerOpenId: context.OPENID,
    startAt: event.startAt,
    endAt: event.endAt,
    addressText: event.addressText.trim(),
    description: event.description || '',
    coverImage: event.coverImage || '',
    signupLimitTotal: event.signupLimitTotal,
    joinedCount: 0,
    requirePhone: Boolean(event.requirePhone),
    inviteCode: event.inviteCode || '',
    feeMode: 'free',
    status: 'published',
    createdAt: stamp,
    updatedAt: stamp
  };

  const activityRes = await db.collection('activities').add({ data: activityData });

  for (let index = 0; index < event.teams.length; index += 1) {
    await db.collection('activity_teams').add({
      data: {
        activityId: activityRes._id,
        teamName: event.teams[index].teamName.trim(),
        sort: index,
        maxMembers: event.teams[index].maxMembers,
        joinedCount: 0,
        status: 'active',
        createdAt: stamp
      }
    });
  }

  return { activityId: activityRes._id };
}

module.exports = { main };

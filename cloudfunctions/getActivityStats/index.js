const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { businessError } = require('./errors');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLLECTION_BATCH_SIZE = 100;

async function loadCollection(db, command, collectionName, criteria) {
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

    lastId = batch[batch.length - 1] && batch[batch.length - 1]._id;
    if (!lastId) {
      throw new Error(`${collectionName} cursor pagination requires document _id`);
    }
  }
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));

  if (deps.loadActivity) {
    const activity = await deps.loadActivity(event.activityId);
    if (activity.organizerOpenId !== openid) {
      throw businessError('Not allowed to view activity stats');
    }

    return deps.loadStats ? deps.loadStats(event.activityId) : { activityId: event.activityId, teams: [] };
  }

  const db = deps.db || cloud.database();
  const command = deps.command || db.command;
  const activityRes = await db.collection('activities').doc(event.activityId).get();

  if (activityRes.data.organizerOpenId !== openid) {
    throw businessError('Not allowed to view activity stats');
  }

  const [teams, registrations] = await Promise.all([
    loadCollection(db, command, 'activity_teams', { activityId: event.activityId }),
    loadCollection(db, command, 'registrations', { activityId: event.activityId })
  ]);

  return {
    activityId: event.activityId,
    totalJoined: registrations.filter(item => item.status === 'joined').length,
    totalCancelled: registrations.filter(item => item.status === 'cancelled').length,
    teams: teams.map(team => ({
      teamId: team._id,
      teamName: team.teamName,
      joinedCount: team.joinedCount,
      maxMembers: team.maxMembers
    }))
  };
}

module.exports = { main };

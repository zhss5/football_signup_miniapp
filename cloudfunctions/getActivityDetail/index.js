const cloud = require('wx-server-sdk');
const { COLLECTIONS } = require('./_shared/collections');
const { businessError } = require('./_shared/errors');
const { nowIso } = require('./_shared/time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

async function main(event, context = cloud.getWXContext(), deps = {}) {
  if (deps.loadActivityDetail) {
    return deps.loadActivityDetail(event.activityId, context.OPENID);
  }

  const db = deps.db || cloud.database();
  const command = deps.command || db.command;
  const activity = await db.collection(COLLECTIONS.ACTIVITIES).doc(event.activityId).get();

  if (!activity || !activity.data) {
    throw businessError('Activity not found');
  }

  if (activity.data.status === 'deleted' && activity.data.organizerOpenId !== context.OPENID) {
    throw businessError('Activity not found');
  }

  const teamsRes = await db
    .collection(COLLECTIONS.ACTIVITY_TEAMS)
    .where({ activityId: event.activityId })
    .get();
  const joinedRes = await db
    .collection(COLLECTIONS.REGISTRATIONS)
    .where({ activityId: event.activityId, status: 'joined' })
    .get();
  const registrationId = `${event.activityId}_${context.OPENID}`;
  const myRegistration = await db
    .collection(COLLECTIONS.REGISTRATIONS)
    .doc(registrationId)
    .get()
    .catch(() => ({ data: null }));
  const stamp = nowIso(deps.now);
  const deadline = Date.parse(activity.data.signupDeadlineAt || '');
  const canCancelSignup = Boolean(
    myRegistration.data &&
      myRegistration.data.status === 'joined' &&
      activity.data.status === 'published' &&
      (!Number.isFinite(deadline) || Date.parse(stamp) <= deadline)
  );

  const userOpenIds = Array.from(new Set(joinedRes.data.map(item => item.userOpenId)));
  let usersById = {};

  if (userOpenIds.length > 0 && command && typeof command.in === 'function') {
    const usersRes = await db
      .collection(COLLECTIONS.USERS)
      .where({ _id: command.in(userOpenIds) })
      .get();

    usersById = usersRes.data.reduce((acc, user) => {
      acc[user._id] = user;
      return acc;
    }, {});
  }

  const membersByTeam = joinedRes.data
    .sort((left, right) => String(left.joinedAt).localeCompare(String(right.joinedAt)))
    .reduce((acc, registration) => {
      if (!acc[registration.teamId]) {
        acc[registration.teamId] = [];
      }

      const user = usersById[registration.userOpenId] || {};
      acc[registration.teamId].push({
        userOpenId: registration.userOpenId,
        signupName: registration.signupName,
        avatarUrl: user.avatarUrl || ''
      });
      return acc;
    }, {});

  return {
    activity: activity.data,
    teams: teamsRes.data
      .sort((left, right) => left.sort - right.sort)
      .map(team => ({
        ...team,
        members: membersByTeam[team._id] || []
      })),
    myRegistration: myRegistration.data,
    viewer: {
      isOrganizer: activity.data.organizerOpenId === context.OPENID,
      canCancelActivity:
        activity.data.organizerOpenId === context.OPENID && activity.data.status === 'published',
      canDeleteActivity:
        activity.data.organizerOpenId === context.OPENID && Number(activity.data.joinedCount) === 0,
      canCancelSignup
    }
  };
}

module.exports = { main };

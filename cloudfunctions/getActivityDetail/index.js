const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { nowIso } = require('./time');
const { normalizeActivityType } = require('./validators');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY = 'manager_registration_notice';

async function getCurrentUser(db, openid) {
  const result = await db
    .collection(COLLECTIONS.USERS)
    .doc(openid)
    .get()
    .catch(() => ({ data: null }));

  return result.data || null;
}

async function getRegistrationNotificationSubscriptionState(db, activityId, openid) {
  const result = await db
    .collection(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS)
    .where({
      activityId,
      userOpenId: openid,
      templateKey: MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY,
      status: 'accepted'
    })
    .get()
    .catch(() => ({ data: [] }));
  const subscription = result.data && result.data[0];

  return {
    subscribed: Boolean(subscription),
    templateId: subscription && subscription.templateId ? String(subscription.templateId) : ''
  };
}

function pickAvatarUrl(registration = {}, user = {}) {
  return (
    registration.avatarUrl ||
    registration.avatarURL ||
    registration.avatar ||
    user.avatarUrl ||
    user.avatarURL ||
    user.avatar ||
    user.photoUrl ||
    user.photoURL ||
    ''
  );
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const db = deps.db || cloud.database();
  const openid = await resolveOpenIdFromEvent(
    event,
    context,
    db,
    { ...deps, getWXContext: deps.getWXContext || (() => cloud.getWXContext()) }
  );

  if (deps.loadActivityDetail) {
    return deps.loadActivityDetail(event.activityId, openid);
  }

  const command = deps.command || db.command;
  const activity = await db.collection(COLLECTIONS.ACTIVITIES).doc(event.activityId).get();

  if (!activity || !activity.data) {
    throw businessError('Activity not found');
  }

  if (activity.data.status === 'deleted' && activity.data.organizerOpenId !== openid) {
    throw businessError('Activity not found');
  }

  const viewerUser = await getCurrentUser(db, openid);

  const teamsRes = await db
    .collection(COLLECTIONS.ACTIVITY_TEAMS)
    .where({ activityId: event.activityId })
    .get();
  const joinedRes = await db
    .collection(COLLECTIONS.REGISTRATIONS)
    .where({ activityId: event.activityId, status: 'joined' })
    .get();
  const registrationId = `${event.activityId}_${openid}`;
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
  const canManageRegistrations = canEditActivity(activity.data, viewerUser, openid);
  const activityPayload = {
    ...activity.data,
    activityType: normalizeActivityType(activity.data.activityType)
  };
  if (!canManageRegistrations) {
    delete activityPayload.activitySummary;
    delete activityPayload.activitySummaryUpdatedAt;
    delete activityPayload.activitySummaryUpdatedBy;
  }
  const registrationNotificationSubscription = canManageRegistrations
    ? await getRegistrationNotificationSubscriptionState(db, event.activityId, openid)
    : {
        subscribed: false,
        templateId: ''
      };

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
      const member = {
        userOpenId: registration.userOpenId,
        signupName: registration.signupName,
        avatarUrl: pickAvatarUrl(registration, user),
        preferredPositions: Array.isArray(registration.preferredPositions)
          ? registration.preferredPositions.filter(Boolean)
          : []
      };

      if (canManageRegistrations) {
        member.registrationId = registration._id || '';
        member.proxyRegistration = Boolean(registration.proxyRegistration);
        member.attendanceStatus = registration.attendanceStatus || 'present';
        member.attendanceMarkedAt = registration.attendanceMarkedAt || '';
        member.attendanceMarkedBy = registration.attendanceMarkedBy || '';
        member.performanceDescription = String(registration.performanceDescription || '').trim();

        if (!registration.proxyRegistration) {
          member.managerAlias = String(user.managerAlias || '').trim();
        }
      }

      acc[registration.teamId].push(member);
      return acc;
    }, {});

  return {
    activity: activityPayload,
    teams: teamsRes.data
      .filter(team => team.status !== 'inactive')
      .sort((left, right) => left.sort - right.sort)
      .map(team => ({
        ...team,
        members: membersByTeam[team._id] || []
      })),
    myRegistration: myRegistration.data,
    viewer: {
      isOrganizer: activity.data.organizerOpenId === openid,
      canEditActivity: canManageRegistrations,
      canManageRegistrations,
      canCancelActivity: canManageRegistrations && activity.data.status === 'published',
      canDeleteActivity:
        activity.data.organizerOpenId === openid && Number(activity.data.joinedCount) === 0,
      canCancelSignup,
      registrationNotificationSubscribed: registrationNotificationSubscription.subscribed,
      registrationNotificationSubscriptionTemplateId:
        registrationNotificationSubscription.templateId
    }
  };
}

module.exports = { main };

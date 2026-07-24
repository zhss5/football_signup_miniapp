const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { nowIso } = require('./time');
const { normalizeActivityType } = require('./validators');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY = 'manager_registration_notice';
const MANAGER_LATE_CANCELLATION_NOTICE_TEMPLATE_KEY =
  'manager_late_cancellation_notice';
const COLLECTION_BATCH_SIZE = 100;
const USER_PROFILE_BATCH_SIZE = COLLECTION_BATCH_SIZE - 1;

async function loadCollection(db, command, collectionName, criteria = null) {
  const items = [];
  let lastId = '';

  while (true) {
    const pageCriteria = { ...(criteria || {}) };
    if (lastId) {
      pageCriteria._id = command.gt(lastId);
    }

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

function groupValues(values, size) {
  const groups = [];

  for (let index = 0; index < values.length; index += size) {
    groups.push(values.slice(index, index + size));
  }

  return groups;
}

async function loadRosterUsers(db, command, registrations) {
  const userOpenIds = Array.from(
    new Set(
      registrations
        .filter(registration => !registration.proxyRegistration)
        .map(registration => registration.userOpenId)
        .filter(Boolean)
    )
  );

  if (userOpenIds.length === 0 || !command || typeof command.in !== 'function') {
    return {};
  }

  const userGroups = groupValues(userOpenIds, USER_PROFILE_BATCH_SIZE);
  const userBatches = await Promise.all(
    userGroups.map(userOpenIds =>
      loadCollection(db, command, COLLECTIONS.USERS, { _id: command.in(userOpenIds) })
    )
  );

  return userBatches.flat().reduce((acc, user) => {
    acc[user._id] = user;
    return acc;
  }, {});
}

async function getCurrentUser(db, openid) {
  const result = await db
    .collection(COLLECTIONS.USERS)
    .doc(openid)
    .get()
    .catch(() => ({ data: null }));

  return result.data || null;
}

async function getNotificationSubscriptionState(db, activityId, openid, templateKey) {
  const result = await db
    .collection(COLLECTIONS.NOTIFICATION_SUBSCRIPTIONS)
    .where({
      activityId,
      userOpenId: openid,
      templateKey,
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

  const [teams, joinedRegistrations] = await Promise.all([
    loadCollection(db, command, COLLECTIONS.ACTIVITY_TEAMS, { activityId: event.activityId }),
    loadCollection(db, command, COLLECTIONS.REGISTRATIONS, {
      activityId: event.activityId,
      status: 'joined'
    })
  ]);
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
  const emptyNotificationSubscription = {
    subscribed: false,
    templateId: ''
  };
  const [
    registrationNotificationSubscription,
    lateCancellationNotificationSubscription
  ] = canManageRegistrations
    ? await Promise.all([
        getNotificationSubscriptionState(
          db,
          event.activityId,
          openid,
          MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY
        ),
        getNotificationSubscriptionState(
          db,
          event.activityId,
          openid,
          MANAGER_LATE_CANCELLATION_NOTICE_TEMPLATE_KEY
        )
      ])
    : [emptyNotificationSubscription, emptyNotificationSubscription];

  const usersById = await loadRosterUsers(db, command, joinedRegistrations);

  const membersByTeam = joinedRegistrations
    .sort((left, right) => {
      const joinedAtCompare = String(left.joinedAt).localeCompare(String(right.joinedAt));
      if (joinedAtCompare !== 0) {
        return joinedAtCompare;
      }

      return String(left._id).localeCompare(String(right._id));
    })
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
    teams: teams
      .filter(team => team.status !== 'inactive' || (membersByTeam[team._id] || []).length > 0)
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
        registrationNotificationSubscription.templateId,
      lateCancellationNotificationSubscribed:
        lateCancellationNotificationSubscription.subscribed,
      lateCancellationNotificationSubscriptionTemplateId:
        lateCancellationNotificationSubscription.templateId
    }
  };
}

module.exports = { main };

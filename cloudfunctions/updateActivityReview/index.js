const cloud = require('wx-server-sdk');
const { resolveOpenIdFromEvent } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const MAX_ACTIVITY_SUMMARY_LENGTH = 2000;
const MAX_PERFORMANCE_DESCRIPTION_LENGTH = 500;

async function loadDoc(db, collectionName, id) {
  const res = await db.collection(collectionName).doc(id).get();
  return res && res.data ? res.data : null;
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function normalizeLimitedText(value, fieldName, maxLength) {
  const text = String(value || '').trim();

  if (Array.from(text).length > maxLength) {
    throw businessError(`${fieldName} cannot exceed ${maxLength} characters`);
  }

  return text;
}

async function addActivityLog(db, data) {
  await db.collection(COLLECTIONS.ACTIVITY_LOGS).add({ data });
}

async function updateActivitySummary(db, payload, activity, openid, stamp) {
  if (!hasOwn(payload, 'activitySummary')) {
    return null;
  }

  const activitySummary = normalizeLimitedText(
    payload.activitySummary,
    'activitySummary',
    MAX_ACTIVITY_SUMMARY_LENGTH
  );
  const beforeSummary = String(activity.activitySummary || '').trim();
  const updateData = {
    activitySummary,
    activitySummaryUpdatedAt: stamp,
    activitySummaryUpdatedBy: openid,
    updatedAt: stamp
  };

  await db.collection(COLLECTIONS.ACTIVITIES).doc(activity._id || payload.activityId).update({
    data: updateData
  });

  if (beforeSummary !== activitySummary) {
    await addActivityLog(db, {
      activityId: payload.activityId,
      action: 'activity_summary_update',
      operatorOpenId: openid,
      before: {
        activitySummary: beforeSummary
      },
      after: {
        activitySummary
      },
      createdAt: stamp
    });
  }

  return {
    activityId: payload.activityId,
    ...updateData
  };
}

async function updatePerformanceDescription(db, payload, openid, stamp) {
  if (!hasOwn(payload, 'performanceDescription')) {
    return null;
  }

  const registrationId = String(payload.registrationId || '').trim();
  if (!registrationId) {
    throw businessError('registrationId is required');
  }

  const registration = await loadDoc(db, COLLECTIONS.REGISTRATIONS, registrationId);
  if (
    !registration ||
    registration.activityId !== payload.activityId ||
    registration.status !== 'joined'
  ) {
    throw businessError('Registration not found');
  }

  const performanceDescription = normalizeLimitedText(
    payload.performanceDescription,
    'performanceDescription',
    MAX_PERFORMANCE_DESCRIPTION_LENGTH
  );
  const beforeDescription = String(registration.performanceDescription || '').trim();
  const updateData = {
    performanceDescription,
    performanceDescriptionUpdatedAt: stamp,
    performanceDescriptionUpdatedBy: openid
  };

  await db.collection(COLLECTIONS.REGISTRATIONS).doc(registrationId).update({
    data: updateData
  });

  if (beforeDescription !== performanceDescription) {
    await addActivityLog(db, {
      activityId: payload.activityId,
      action: 'performance_description_update',
      operatorOpenId: openid,
      registrationId,
      userOpenId: registration.userOpenId || '',
      before: {
        performanceDescription: beforeDescription
      },
      after: {
        performanceDescription
      },
      createdAt: stamp
    });
  }

  return {
    registrationId,
    ...registration,
    ...updateData
  };
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const payload = event || {};
  const activityId = String(payload.activityId || '').trim();

  if (!activityId) {
    throw businessError('activityId is required');
  }

  if (!hasOwn(payload, 'activitySummary') && !hasOwn(payload, 'performanceDescription')) {
    throw businessError('No review field to update');
  }

  const db = deps.db || cloud.database();
  const openid = await resolveOpenIdFromEvent(
    event,
    context,
    db,
    { ...deps, getWXContext: deps.getWXContext || (() => cloud.getWXContext()) }
  );
  const [activity, actor] = await Promise.all([
    loadDoc(db, COLLECTIONS.ACTIVITIES, activityId),
    loadDoc(db, COLLECTIONS.USERS, openid)
  ]);

  if (!activity) {
    throw businessError('Activity not found');
  }

  if (!canEditActivity(activity, actor, openid)) {
    throw businessError('Only the organizer or an admin can update activity review fields');
  }

  const stamp = nowIso(deps.now);
  const activityResult = await updateActivitySummary(db, payload, activity, openid, stamp);
  const registrationResult = await updatePerformanceDescription(db, payload, openid, stamp);

  return {
    activity: activityResult,
    registration: registrationResult
  };
}

module.exports = { main };

const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const VALID_ATTENDANCE_STATUSES = ['present', 'absent'];

async function loadDoc(db, collectionName, id) {
  const res = await db.collection(collectionName).doc(id).get();
  return res && res.data ? res.data : null;
}

function normalizeAttendanceStatus(value) {
  return String(value || '').trim();
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const payload = event || {};
  const db = deps.db || cloud.database();
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));
  const activityId = String(payload.activityId || '').trim();
  const registrationId = String(payload.registrationId || '').trim();
  const attendanceStatus = normalizeAttendanceStatus(payload.attendanceStatus);
  const stamp = nowIso(deps.now);

  if (!activityId) {
    throw businessError('activityId is required');
  }

  if (!registrationId) {
    throw businessError('registrationId is required');
  }

  if (!VALID_ATTENDANCE_STATUSES.includes(attendanceStatus)) {
    throw businessError('Invalid attendance status');
  }

  const [activity, actor, registration] = await Promise.all([
    loadDoc(db, COLLECTIONS.ACTIVITIES, activityId),
    loadDoc(db, COLLECTIONS.USERS, openid),
    loadDoc(db, COLLECTIONS.REGISTRATIONS, registrationId)
  ]);

  if (!activity) {
    throw businessError('Activity not found');
  }

  if (!canEditActivity(activity, actor, openid)) {
    throw businessError('Only the organizer or an admin can update attendance');
  }

  if (activity.confirmStatus !== 'confirmed') {
    throw businessError('Attendance can only be updated after activity is confirmed');
  }

  if (!registration || registration.activityId !== activityId || registration.status !== 'joined') {
    throw businessError('Registration not found');
  }

  const updateData = {
    attendanceStatus,
    attendanceMarkedAt: stamp,
    attendanceMarkedBy: openid
  };

  await db.collection(COLLECTIONS.REGISTRATIONS).doc(registrationId).update({
    data: updateData
  });

  await db.collection(COLLECTIONS.ACTIVITY_LOGS).add({
    data: {
      activityId,
      action: 'attendance_update',
      operatorOpenId: openid,
      registrationId,
      userOpenId: registration.userOpenId || '',
      attendanceStatus,
      createdAt: stamp
    }
  });

  return {
    registration: {
      ...registration,
      ...updateData
    }
  };
}

module.exports = { main };

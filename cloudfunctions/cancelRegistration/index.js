const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { businessError } = require('./errors');
const { notifyActivityManagers } = require('./manager-notifications');
const { canEditActivity } = require('./roles');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function normalizeCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

async function readTransactionDocument(transaction, collectionName, documentId) {
  try {
    return await transaction.collection(collectionName).doc(documentId).get();
  } catch (error) {
    return { data: null };
  }
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));

  if (deps.runCancel) {
    return deps.runCancel(event, openid);
  }

  const db = cloud.database();
  const registrationId = `${event.activityId}_${openid}`;
  const stamp = nowIso(deps.now);

  const transactionResult = await db.runTransaction(async transaction => {
    const registrationRes = await transaction.collection('registrations').doc(registrationId).get();

    if (!registrationRes.data || registrationRes.data.status !== 'joined') {
      throw businessError('No active registration to cancel');
    }

    const activityRes = await transaction.collection('activities').doc(event.activityId).get();
    const teamRes = await transaction.collection('activity_teams').doc(registrationRes.data.teamId).get();
    const userRes = await readTransactionDocument(transaction, 'users', openid);
    const actorCanEditActivity = canEditActivity(activityRes.data, userRes.data, openid);

    if (activityRes.data.status !== 'published') {
      throw businessError('Signup can no longer be cancelled');
    }

    const deadline = Date.parse(activityRes.data.signupDeadlineAt || '');
    if (Number.isFinite(deadline) && Date.parse(stamp) > deadline) {
      throw businessError('Signup can no longer be cancelled');
    }

    await transaction.collection('registrations').doc(registrationId).update({
      data: {
        status: 'cancelled',
        cancelledAt: stamp,
        cancelCount: normalizeCount(registrationRes.data.cancelCount) + 1,
        updatedAt: stamp
      }
    });

    await transaction.collection('activities').doc(event.activityId).update({
      data: {
        joinedCount: Math.max(activityRes.data.joinedCount - 1, 0),
        updatedAt: stamp
      }
    });

    await transaction.collection('activity_teams').doc(registrationRes.data.teamId).update({
      data: {
        joinedCount: Math.max(teamRes.data.joinedCount - 1, 0)
      }
    });

    return {
      registrationId,
      status: 'cancelled',
      managerNotification: actorCanEditActivity
        ? null
        : {
            activity: {
              ...activityRes.data,
              _id: event.activityId
            },
            actorOpenId: openid,
            actorName: registrationRes.data.signupName,
            changeType: 'registration_cancelled',
            stamp
          }
    };
  });

  const { managerNotification, ...response } = transactionResult;

  if (managerNotification) {
    const notify = deps.notifyActivityManagers || notifyActivityManagers;
    await notify(db, managerNotification, { ...deps, cloud }).catch(() => null);
  }

  return response;
}

module.exports = { main };

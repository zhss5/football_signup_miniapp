const cloud = require('wx-server-sdk');
const { resolveOpenId } = require('./auth');
const { COLLECTIONS } = require('./collections');
const { businessError } = require('./errors');
const { canEditActivity } = require('./roles');
const { nowIso } = require('./time');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function normalizeCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function isBenchTeam(team) {
  return team && team.teamType === 'bench';
}

function isActiveBenchTeam(team) {
  return isBenchTeam(team) && team.status !== 'inactive' && normalizeCount(team.maxMembers) > 0;
}

function getRegistrationDocumentId(registration) {
  if (registration && registration._id) {
    return registration._id;
  }

  if (registration && registration.activityId && registration.userOpenId) {
    return `${registration.activityId}_${registration.userOpenId}`;
  }

  return '';
}

function compareBenchQueue(left, right) {
  const leftJoinedAt = String(left && left.joinedAt ? left.joinedAt : '');
  const rightJoinedAt = String(right && right.joinedAt ? right.joinedAt : '');

  if (leftJoinedAt !== rightJoinedAt) {
    return leftJoinedAt.localeCompare(rightJoinedAt);
  }

  return getRegistrationDocumentId(left).localeCompare(getRegistrationDocumentId(right));
}

async function queryTransactionCollection(transaction, collectionName, query) {
  const collection = transaction.collection(collectionName);

  if (!collection || typeof collection.where !== 'function') {
    return { data: [] };
  }

  return collection.where(query).get();
}

async function findBenchPromotionCandidate(transaction, activityId) {
  const teamsRes = await queryTransactionCollection(
    transaction,
    COLLECTIONS.ACTIVITY_TEAMS,
    { activityId }
  );
  const benchTeamById = (teamsRes.data || [])
    .filter(isActiveBenchTeam)
    .reduce((map, team) => {
      if (team && team._id) {
        map.set(team._id, team);
      }
      return map;
    }, new Map());

  if (benchTeamById.size === 0) {
    return null;
  }

  const registrationsRes = await queryTransactionCollection(
    transaction,
    COLLECTIONS.REGISTRATIONS,
    { activityId, status: 'joined' }
  );
  const registration = (registrationsRes.data || [])
    .filter(item => benchTeamById.has(item.teamId))
    .sort(compareBenchQueue)[0] || null;
  const registrationId = getRegistrationDocumentId(registration);

  if (!registration || !registrationId) {
    return null;
  }

  return {
    registration,
    registrationId,
    fromTeam: benchTeamById.get(registration.teamId)
  };
}

async function writeActivityLog(transaction, data) {
  await transaction.collection(COLLECTIONS.ACTIVITY_LOGS).add({ data });
}

function validatePayload(event = {}) {
  if (!event.activityId) {
    throw new Error('activityId is required');
  }

  if (!event.userOpenId) {
    throw new Error('userOpenId is required');
  }
}

async function main(event, context = cloud.getWXContext(), deps = {}) {
  validatePayload(event);
  const openid = resolveOpenId(context, deps.getWXContext || (() => cloud.getWXContext()));

  if (deps.runRemove) {
    return deps.runRemove(event, openid);
  }

  const db = deps.db || cloud.database();
  const stamp = nowIso(deps.now);
  const registrationId = `${event.activityId}_${event.userOpenId}`;

  return db.runTransaction(async transaction => {
    const activityRes = await transaction
      .collection(COLLECTIONS.ACTIVITIES)
      .doc(event.activityId)
      .get();
    const activity = activityRes.data;

    if (!activity || activity.status === 'deleted') {
      throw businessError('Activity not found');
    }

    const actorRes = await transaction
      .collection(COLLECTIONS.USERS)
      .doc(openid)
      .get()
      .catch(() => ({ data: null }));
    const actor = actorRes.data || null;

    if (!canEditActivity(activity, actor, openid)) {
      throw businessError('Only the organizer or an admin can remove registrations');
    }

    const registrationRes = await transaction
      .collection(COLLECTIONS.REGISTRATIONS)
      .doc(registrationId)
      .get()
      .catch(() => ({ data: null }));
    const registration = registrationRes.data;

    if (!registration || registration.status !== 'joined') {
      throw businessError('No active registration to remove');
    }

    const teamRes = await transaction
      .collection(COLLECTIONS.ACTIVITY_TEAMS)
      .doc(registration.teamId)
      .get();
    const team = teamRes.data || {};
    const promotion = !isBenchTeam(team)
      ? await findBenchPromotionCandidate(transaction, event.activityId)
      : null;

    await transaction.collection(COLLECTIONS.REGISTRATIONS).doc(registrationId).update({
      data: {
        status: 'cancelled',
        cancelledAt: stamp,
        removedByOpenId: openid,
        removedAt: stamp,
        removedCount: normalizeCount(registration.removedCount) + 1,
        updatedAt: stamp
      }
    });

    await transaction.collection(COLLECTIONS.ACTIVITIES).doc(event.activityId).update({
      data: {
        joinedCount: Math.max(Number(activity.joinedCount || 0) - 1, 0),
        updatedAt: stamp
      }
    });

    if (promotion) {
      await transaction.collection(COLLECTIONS.REGISTRATIONS).doc(promotion.registrationId).update({
        data: {
          teamId: registration.teamId,
          updatedAt: stamp
        }
      });

      await transaction
        .collection(COLLECTIONS.ACTIVITY_TEAMS)
        .doc(promotion.registration.teamId)
        .update({
          data: {
            joinedCount: Math.max(normalizeCount(promotion.fromTeam.joinedCount) - 1, 0)
          }
        });
    } else {
      await transaction.collection(COLLECTIONS.ACTIVITY_TEAMS).doc(registration.teamId).update({
        data: {
          joinedCount: Math.max(Number(team.joinedCount || 0) - 1, 0)
        }
      });
    }

    const removedCount = normalizeCount(registration.removedCount) + 1;
    await writeActivityLog(transaction, {
      activityId: event.activityId,
      action: 'registration_removed',
      operatorOpenId: openid,
      targetOpenId: event.userOpenId,
      registrationId,
      teamId: registration.teamId || '',
      before: {
        status: 'joined',
        teamId: registration.teamId || ''
      },
      after: {
        status: 'cancelled',
        removedCount
      },
      createdAt: stamp
    });

    if (promotion) {
      await writeActivityLog(transaction, {
        activityId: event.activityId,
        action: 'registration_auto_promoted',
        operatorOpenId: openid,
        targetOpenId: promotion.registration.userOpenId || '',
        registrationId: promotion.registrationId,
        teamId: registration.teamId || '',
        fromTeamId: promotion.registration.teamId || '',
        toTeamId: registration.teamId || '',
        before: {
          status: 'joined',
          teamId: promotion.registration.teamId || ''
        },
        after: {
          status: 'joined',
          teamId: registration.teamId || '',
          cancelledRegistrationId: registrationId,
          queueOrder: 1
        },
        createdAt: stamp
      });
    }

    return {
      registrationId,
      activityId: event.activityId,
      userOpenId: event.userOpenId,
      teamId: registration.teamId,
      status: 'cancelled',
      removed: true,
      promotedRegistrationId: promotion ? promotion.registrationId : '',
      promotedTeamId: promotion ? registration.teamId || '' : '',
      promotedFromTeamId: promotion ? promotion.registration.teamId || '' : ''
    };
  });
}

module.exports = { main };

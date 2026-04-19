const { validateActivityDraft } = require('../utils/validators');
const { validateSignupPayload } = require('../../cloudfunctions/_shared/validators');

function createDefaultState() {
  return {
    sequence: 1,
    users: {},
    activities: {},
    teams: {},
    registrations: {},
    activityLogs: []
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildStorageAdapter(localStorageKey) {
  return {
    getItem(key) {
      try {
        return wx.getStorageSync(key) || null;
      } catch (error) {
        return null;
      }
    },
    setItem(key, value) {
      wx.setStorageSync(key, value);
    },
    removeItem(key) {
      wx.removeStorageSync(key);
    },
    key: localStorageKey
  };
}

function createLocalCloudClient(options = {}) {
  const storage = options.storage;
  const storageKey = options.storageKey || 'football-signup-local-cloud-v1';
  const now = options.now || (() => new Date().toISOString());
  const getOpenId = options.openid
    ? () => options.openid
    : () => {
        const cached = storage.getItem(`${storageKey}:openid`);
        if (cached) {
          return cached;
        }

        const created = `mock_openid_${Date.now()}`;
        storage.setItem(`${storageKey}:openid`, created);
        return created;
      };

  function readState() {
    const current = storage.getItem(storageKey);
    return current ? clone(current) : createDefaultState();
  }

  function writeState(state) {
    storage.setItem(storageKey, clone(state));
  }

  function nextId(state, prefix) {
    const id = `${prefix}_${state.sequence}`;
    state.sequence += 1;
    return id;
  }

  function ensureUserProfile() {
    const state = readState();
    const openid = getOpenId();
    const stamp = now();
    const current = state.users[openid];

    if (current) {
      current.lastActiveAt = stamp;
      writeState(state);
      return { user: clone(current) };
    }

    const user = {
      _id: openid,
      preferredName: '',
      roles: ['user'],
      createdAt: stamp,
      lastActiveAt: stamp
    };

    state.users[openid] = user;
    writeState(state);
    return { user: clone(user) };
  }

  function createActivity(payload) {
    validateActivityDraft(payload);
    const state = readState();
    const stamp = now();
    const openid = getOpenId();
    const activityId = nextId(state, 'activity');

    state.activities[activityId] = {
      _id: activityId,
      title: payload.title.trim(),
      organizerOpenId: openid,
      startAt: payload.startAt,
      endAt: payload.endAt,
      addressText: payload.addressText.trim(),
      description: payload.description || '',
      coverImage: payload.coverImage || '',
      signupLimitTotal: Number(payload.signupLimitTotal) || 0,
      joinedCount: 0,
      requirePhone: Boolean(payload.requirePhone),
      inviteCode: payload.inviteCode || '',
      feeMode: 'free',
      status: 'published',
      createdAt: stamp,
      updatedAt: stamp
    };

    payload.teams.forEach((team, index) => {
      const teamId = nextId(state, 'team');
      state.teams[teamId] = {
        _id: teamId,
        activityId,
        teamName: team.teamName.trim(),
        sort: index,
        maxMembers: Number(team.maxMembers) || 0,
        joinedCount: 0,
        status: 'active',
        createdAt: stamp
      };
    });

    state.activityLogs[nextId(state, 'log')] = {
      activityId,
      operatorOpenId: openid,
      action: 'create_activity',
      createdAt: stamp
    };

    writeState(state);
    return { activityId };
  }

  function listActivities(payload) {
    const state = readState();
    const openid = getOpenId();
    const activities = Object.values(state.activities);

    if (payload.scope === 'created') {
      return {
        items: clone(activities.filter(item => item.organizerOpenId === openid))
      };
    }

    if (payload.scope === 'joined') {
      const joinedIds = new Set(
        Object.values(state.registrations)
          .filter(item => item.userOpenId === openid && item.status === 'joined')
          .map(item => item.activityId)
      );

      return {
        items: clone(activities.filter(item => joinedIds.has(item._id)))
      };
    }

    return {
      items: clone(
        activities.filter(item => item.status === (payload.status || 'published'))
      )
    };
  }

  function getActivityDetail(payload) {
    const state = readState();
    const openid = getOpenId();
    const activity = state.activities[payload.activityId];
    const teams = Object.values(state.teams)
      .filter(team => team.activityId === payload.activityId)
      .sort((left, right) => left.sort - right.sort)
      .map(team => {
        const members = Object.values(state.registrations)
          .filter(item => item.activityId === payload.activityId && item.teamId === team._id && item.status === 'joined')
          .map(item => ({
            userOpenId: item.userOpenId,
            signupName: item.signupName
          }));

        return {
          ...team,
          members
        };
      });

    return {
      activity: clone(activity),
      teams: clone(teams),
      myRegistration: clone(state.registrations[`${payload.activityId}_${openid}`] || null)
    };
  }

  function joinActivity(payload) {
    validateSignupPayload(payload);
    const state = readState();
    const openid = getOpenId();
    const stamp = now();
    const activity = state.activities[payload.activityId];
    const team = state.teams[payload.teamId];
    const registrationId = `${payload.activityId}_${openid}`;
    const current = state.registrations[registrationId];

    if (!activity || activity.status !== 'published') {
      throw new Error('Activity is not open for signup');
    }

    if (!team) {
      throw new Error('Team not found');
    }

    if (activity.joinedCount >= activity.signupLimitTotal) {
      throw new Error('Activity is full');
    }

    if (team.joinedCount >= team.maxMembers) {
      throw new Error('Team is full');
    }

    if (current && current.status === 'joined') {
      throw new Error('You already joined this activity');
    }

    state.registrations[registrationId] = {
      _id: registrationId,
      activityId: payload.activityId,
      teamId: payload.teamId,
      userOpenId: openid,
      status: 'joined',
      signupName: payload.signupName.trim(),
      phoneSnapshot: payload.phone || '',
      source: payload.source || 'direct',
      joinedAt: stamp,
      cancelledAt: current ? current.cancelledAt || '' : '',
      updatedAt: stamp
    };

    activity.joinedCount += 1;
    activity.updatedAt = stamp;
    team.joinedCount += 1;
    writeState(state);

    return {
      registrationId,
      teamId: payload.teamId,
      status: 'joined'
    };
  }

  function cancelRegistration(payload) {
    const state = readState();
    const openid = getOpenId();
    const stamp = now();
    const registrationId = `${payload.activityId}_${openid}`;
    const current = state.registrations[registrationId];

    if (!current || current.status !== 'joined') {
      throw new Error('No active registration to cancel');
    }

    const activity = state.activities[payload.activityId];
    const team = state.teams[current.teamId];

    current.status = 'cancelled';
    current.cancelledAt = stamp;
    current.updatedAt = stamp;
    activity.joinedCount = Math.max(activity.joinedCount - 1, 0);
    activity.updatedAt = stamp;
    team.joinedCount = Math.max(team.joinedCount - 1, 0);

    writeState(state);
    return {
      registrationId,
      status: 'cancelled'
    };
  }

  function getActivityStats(payload) {
    const state = readState();
    const openid = getOpenId();
    const activity = state.activities[payload.activityId];

    if (!activity || activity.organizerOpenId !== openid) {
      throw new Error('Not allowed to view activity stats');
    }

    const registrations = Object.values(state.registrations).filter(
      item => item.activityId === payload.activityId
    );
    const teams = Object.values(state.teams)
      .filter(team => team.activityId === payload.activityId)
      .sort((left, right) => left.sort - right.sort);

    return {
      activityId: payload.activityId,
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

  const handlers = {
    ensureUserProfile,
    createActivity,
    listActivities,
    getActivityDetail,
    joinActivity,
    cancelRegistration,
    getActivityStats
  };

  return {
    call(name, payload = {}) {
      const handler = handlers[name];
      if (!handler) {
        throw new Error(`Unknown local cloud function: ${name}`);
      }

      return Promise.resolve(handler(payload));
    }
  };
}

module.exports = {
  buildStorageAdapter,
  createLocalCloudClient
};

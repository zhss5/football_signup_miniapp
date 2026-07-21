const { BENCH_TEAM_NAME } = require('../utils/constants');
const {
  MAX_PREFERRED_POSITIONS,
  POSITION_VALUES,
  normalizePreferredPositions
} = require('../utils/positions');
const { canCreateActivity, canEditActivity } = require('../utils/roles');
const { normalizeSignupName } = require('../utils/signup-name');
const { isTeamColorKey, normalizeTeamColorKey } = require('../utils/team-colors');
const { validateActivityDraft } = require('../utils/validators');

const MAX_REPEAT_EXIT_COUNT = 3;
const REPEAT_SIGNUP_LIMIT_MESSAGE = 'Too many repeat signups. Please contact the organizer';
const ACTIVITY_NOTICE_TEMPLATE_KEY = 'activity_notice';
const MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY = 'manager_registration_notice';
const DEFAULT_ACTIVITY_LIST_LIMIT = 20;
const MAX_ACTIVITY_LIST_LIMIT = 50;

function validateSignupPayload(payload) {
  if (!payload.activityId) {
    throw new Error('activityId is required');
  }

  if (!payload.teamId) {
    throw new Error('teamId is required');
  }

  if (!normalizeSignupName(payload.signupName)) {
    throw new Error('signupName is required');
  }

  return true;
}

function normalizeSource(value) {
  return value === 'wechat' ? 'wechat' : 'manual';
}

function normalizeCount(value) {
  const count = Number(value || 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function hasExplicitBenchCapacity(payload) {
  return Object.prototype.hasOwnProperty.call(payload || {}, 'benchCapacity');
}

function sumRegularTeamCapacity(teams = []) {
  return teams.reduce((sum, team) => sum + (Number(team.maxMembers) || 0), 0);
}

function resolveSignupLimitTotal(payload, regularTeams) {
  if (!hasExplicitBenchCapacity(payload)) {
    return Number(payload.signupLimitTotal) || 0;
  }

  return sumRegularTeamCapacity(regularTeams) + (Number(payload.benchCapacity) || 0);
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

function findBenchPromotionCandidate(state, activityId) {
  const benchTeamById = Object.values(state.teams)
    .filter(
      team =>
        team.activityId === activityId &&
        team.teamType === 'bench' &&
        team.status !== 'inactive' &&
        normalizeCount(team.maxMembers) > 0
    )
    .reduce((map, team) => map.set(team._id, team), new Map());

  if (benchTeamById.size === 0) {
    return null;
  }

  const registration = Object.values(state.registrations)
    .filter(
      item =>
        item.activityId === activityId &&
        item.status === 'joined' &&
        benchTeamById.has(item.teamId)
    )
    .sort(compareBenchQueue)[0] || null;

  return registration
    ? {
        registration,
        registrationId: getRegistrationDocumentId(registration),
        fromTeam: benchTeamById.get(registration.teamId)
      }
    : null;
}

function normalizeListLimit(value) {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_ACTIVITY_LIST_LIMIT;
  }

  return Math.min(Math.floor(limit), MAX_ACTIVITY_LIST_LIMIT);
}

function normalizeListSkip(value) {
  const skip = Number(value);
  if (!Number.isFinite(skip) || skip <= 0) {
    return 0;
  }

  return Math.floor(skip);
}

function sortActivitiesByStartDesc(items) {
  return items.slice().sort((left, right) => {
    const startCompare = String(right.startAt || '').localeCompare(String(left.startAt || ''));
    if (startCompare !== 0) {
      return startCompare;
    }

    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
  });
}

function pageActivityList(items, payload) {
  const skip = normalizeListSkip(payload && payload.skip);
  const limit = normalizeListLimit(payload && payload.limit);
  return sortActivitiesByStartDesc(items).slice(skip, skip + limit);
}

function getDefaultRegistrationNoticeThreshold(signupLimitTotal) {
  const total = normalizeCount(signupLimitTotal);
  return total > 0 ? Math.ceil(total * 0.8) : 0;
}

function normalizeRegistrationNoticeThreshold(value, signupLimitTotal) {
  const threshold = normalizeCount(value);
  const total = normalizeCount(signupLimitTotal);
  if (threshold > 0 && threshold <= total) {
    return threshold;
  }

  return getDefaultRegistrationNoticeThreshold(total);
}

function getRegistrationNoticeThreshold(activity) {
  return normalizeRegistrationNoticeThreshold(
    activity && activity.registrationNoticeThreshold,
    activity && activity.signupLimitTotal
  );
}

function shouldNotifyManagersForJoin(activity, joinedCountAfter) {
  const threshold = getRegistrationNoticeThreshold(activity);
  return threshold > 0 && normalizeCount(joinedCountAfter) >= threshold;
}

function getRepeatExitCount(registration) {
  if (!registration) {
    return 0;
  }

  return normalizeCount(registration.cancelCount) + normalizeCount(registration.removedCount);
}

function validatePreferredPositions(value) {
  const input = Array.isArray(value) ? value : [];
  const normalized = normalizePreferredPositions(input);

  if (normalized.length > MAX_PREFERRED_POSITIONS) {
    throw new Error('At most two preferred positions are allowed');
  }

  if (input.some(item => !POSITION_VALUES.includes(String(item || '').trim()))) {
    throw new Error('Unsupported preferred position');
  }

  return normalized;
}

function createDefaultState() {
  return {
    sequence: 1,
    users: {},
    activities: {},
    teams: {},
    registrations: {},
    activityLogs: [],
    notificationSubscriptions: {},
    notificationLogs: []
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
  const defaultRoles = Array.isArray(options.defaultRoles)
    ? options.defaultRoles.slice()
    : ['user', 'organizer'];
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

  function buildDefaultUser(openid, stamp) {
    return {
      _id: openid,
      preferredName: '',
      avatarUrl: '',
      preferredPositions: [],
      roles: defaultRoles.slice(),
      createdAt: stamp,
      lastActiveAt: stamp
    };
  }

  function ensureUserInState(state, openid, stamp) {
    if (!state.users[openid]) {
      state.users[openid] = buildDefaultUser(openid, stamp);
    }

    return state.users[openid];
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

    const user = buildDefaultUser(openid, stamp);

    state.users[openid] = user;
    writeState(state);
    return { user: clone(user) };
  }

  function createActivity(payload) {
    const state = readState();
    const stamp = now();
    const openid = getOpenId();
    const user = ensureUserInState(state, openid, stamp);

    if (!canCreateActivity(user)) {
      throw new Error('Only organizers can create activities');
    }

    const activityId = nextId(state, 'activity');
    const regularTeams = payload.teams.map((team, index) => ({
      teamName: team.teamName.trim(),
      sort: index,
      maxMembers: Number(team.maxMembers) || 0,
      colorKey: normalizeTeamColorKey(team.colorKey, index),
      teamType: 'regular',
      autoGenerated: false
    }));
    const regularTeamSlots = sumRegularTeamCapacity(regularTeams);
    const signupLimitTotal = resolveSignupLimitTotal(payload, regularTeams);
    validateActivityDraft({
      ...payload,
      signupLimitTotal
    });
    const benchSlots = Math.max(signupLimitTotal - regularTeamSlots, 0);
    const imageList = Array.isArray(payload.imageList)
      ? payload.imageList.filter(Boolean)
      : payload.coverImage
        ? [payload.coverImage]
        : [];
    const detailImages = Array.isArray(payload.detailImages)
      ? payload.detailImages.filter(Boolean)
      : [];

    if (benchSlots > 0) {
      regularTeams.push({
        teamName: '替补',
        sort: regularTeams.length,
        maxMembers: benchSlots,
        colorKey: 'neutral',
        teamType: 'bench',
        autoGenerated: true
      });
    }

    const teamsForStorage = regularTeams.map(team =>
      team.teamType === 'bench' ? { ...team, teamName: BENCH_TEAM_NAME } : team
    );

    state.activities[activityId] = {
      _id: activityId,
      title: payload.title.trim(),
      organizerOpenId: openid,
      startAt: payload.startAt,
      endAt: payload.endAt,
      signupDeadlineAt: payload.signupDeadlineAt,
      addressText: payload.addressText.trim(),
      addressName: payload.addressName || payload.addressText.trim(),
      location: payload.location || null,
      description: payload.description || '',
      insuranceLink: String(payload.insuranceLink || '').trim(),
      notificationHint: String(payload.notificationHint || '').trim(),
      coverImage: imageList[0] || payload.coverImage || '',
      coverThumbImage: payload.coverThumbImage || '',
      shareImage: payload.shareImage || '',
      imageList,
      detailImages,
      signupLimitTotal,
      registrationNoticeThreshold: normalizeRegistrationNoticeThreshold(
        payload.registrationNoticeThreshold,
        signupLimitTotal
      ),
      joinedCount: 0,
      requirePhone: false,
      inviteCode: payload.inviteCode || '',
      feeMode: 'free',
      status: 'published',
      confirmStatus: 'pending',
      confirmedAt: '',
      confirmedByOpenId: '',
      createdAt: stamp,
      updatedAt: stamp
    };

    teamsForStorage.forEach((team, index) => {
      const teamId = nextId(state, 'team');
      state.teams[teamId] = {
        _id: teamId,
        activityId,
        teamName: team.teamName,
        sort: index,
        maxMembers: team.maxMembers,
        colorKey: team.colorKey,
        joinedCount: 0,
        teamType: team.teamType,
        autoGenerated: team.autoGenerated,
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

  function getRegularTeamsForActivity(state, activityId) {
    return Object.values(state.teams)
      .filter(team => team.activityId === activityId && team.status !== 'inactive' && team.teamType !== 'bench')
      .sort((left, right) => left.sort - right.sort);
  }

  function buildRegularTeamDrafts(payload, existingRegularTeams) {
    const sourceTeams = Array.isArray(payload.teams) ? payload.teams : existingRegularTeams;

    return sourceTeams.map((team, index) => ({
      _id: String(team._id || '').trim(),
      teamName: String(team.teamName || '').trim(),
      sort: index,
      maxMembers: Number(team.maxMembers) || 0,
      colorKey: normalizeTeamColorKey(team.colorKey, index),
      teamType: 'regular',
      autoGenerated: false
    }));
  }

  function assertRegularTeamUpdatesAllowed(existingRegularTeams, regularTeamDrafts) {
    const existingById = new Map(existingRegularTeams.map(team => [team._id, team]));
    const keptIds = new Set();

    regularTeamDrafts.forEach(team => {
      if (!team._id) {
        return;
      }

      if (keptIds.has(team._id)) {
        throw new Error('Duplicate team id');
      }

      keptIds.add(team._id);
      const existing = existingById.get(team._id);

      if (!existing) {
        throw new Error('Team not found');
      }

      if (Number(team.maxMembers || 0) < Number(existing.joinedCount || 0)) {
        throw new Error('Team capacity cannot be lower than joined members');
      }
    });

    existingRegularTeams.forEach(team => {
      if (keptIds.has(team._id)) {
        return;
      }

      if (Number(team.joinedCount || 0) > 0) {
        throw new Error('Teams with joined members cannot be removed');
      }
    });
  }

  function hasRegularTeamChanged(existing, draft) {
    return (
      String(existing.teamName || '') !== draft.teamName ||
      Number(existing.maxMembers || 0) !== Number(draft.maxMembers || 0) ||
      String(existing.colorKey || '') !== draft.colorKey ||
      Number(existing.sort || 0) !== Number(draft.sort || 0) ||
      existing.status === 'inactive'
    );
  }

  function syncRegularTeams(state, activityId, existingRegularTeams, regularTeamDrafts, stamp) {
    const existingById = new Map(existingRegularTeams.map(team => [team._id, team]));
    const keptIds = new Set();
    let changed = false;

    regularTeamDrafts.forEach((draft, index) => {
      if (draft._id) {
        const existing = existingById.get(draft._id);
        keptIds.add(draft._id);

        if (hasRegularTeamChanged(existing, draft)) {
          changed = true;
          Object.assign(existing, {
            teamName: draft.teamName,
            sort: draft.sort,
            maxMembers: draft.maxMembers,
            colorKey: draft.colorKey,
            teamType: 'regular',
            autoGenerated: false,
            status: 'active',
            updatedAt: stamp
          });
        }
        return;
      }

      changed = true;
      const teamId = nextId(state, 'team');
      state.teams[teamId] = {
        _id: teamId,
        activityId,
        teamName: draft.teamName,
        sort: index,
        maxMembers: draft.maxMembers,
        colorKey: draft.colorKey,
        joinedCount: 0,
        teamType: 'regular',
        autoGenerated: false,
        status: 'active',
        createdAt: stamp
      };
    });

    existingRegularTeams.forEach(team => {
      if (keptIds.has(team._id)) {
        return;
      }

      changed = true;
      team.status = 'inactive';
      team.updatedAt = stamp;
    });

    return changed;
  }

  function syncBenchTeam(state, activityId, regularTeams, totalSignupLimit, stamp) {
    const regularSlots = regularTeams.reduce((sum, team) => sum + (Number(team.maxMembers) || 0), 0);
    const benchSlots = Math.max((Number(totalSignupLimit) || 0) - regularSlots, 0);
    const benchTeam = Object.values(state.teams).find(
      team => team.activityId === activityId && team.teamType === 'bench'
    );

    if (benchTeam && benchSlots < Number(benchTeam.joinedCount || 0)) {
      throw new Error('Total signup limit cannot be lower than joined players');
    }

    if (benchTeam) {
      benchTeam.maxMembers = benchSlots;
      benchTeam.status = benchSlots > 0 || Number(benchTeam.joinedCount || 0) > 0
        ? 'active'
        : 'inactive';
      benchTeam.updatedAt = stamp;
      return;
    }

    if (benchSlots > 0) {
      const teamId = nextId(state, 'team');
      state.teams[teamId] = {
        _id: teamId,
        activityId,
        teamName: BENCH_TEAM_NAME,
        sort: regularTeams.length,
        maxMembers: benchSlots,
        colorKey: 'neutral',
        joinedCount: 0,
        teamType: 'bench',
        autoGenerated: true,
        status: 'active',
        createdAt: stamp
      };
    }
  }

  function updateActivity(payload) {
    if (!payload.activityId) {
      throw new Error('activityId is required');
    }

    const state = readState();
    const stamp = now();
    const openid = getOpenId();
    const activity = state.activities[payload.activityId];
    const user = state.users[openid] || buildDefaultUser(openid, stamp);

    if (!activity) {
      throw new Error('Activity not found');
    }

    if (activity.status === 'deleted') {
      throw new Error('Deleted activities cannot be edited');
    }

    if (!canEditActivity(activity, user, openid)) {
      throw new Error('Only the organizer or an admin can edit this activity');
    }

    const existingRegularTeams = getRegularTeamsForActivity(state, payload.activityId);
    const regularTeamDrafts = buildRegularTeamDrafts(payload, existingRegularTeams);
    const signupLimitTotal = resolveSignupLimitTotal(payload, regularTeamDrafts);

    if (signupLimitTotal < Number(activity.joinedCount || 0)) {
      throw new Error('Total signup limit cannot be lower than joined players');
    }

    validateActivityDraft({
      ...payload,
      signupLimitTotal,
      teams: regularTeamDrafts.map(team => ({
        teamName: team.teamName,
        maxMembers: Number(team.maxMembers) || 0
      }))
    });
    assertRegularTeamUpdatesAllowed(existingRegularTeams, regularTeamDrafts);

    const imageList = Array.isArray(payload.imageList)
      ? payload.imageList.filter(Boolean)
      : payload.coverImage
        ? [payload.coverImage]
        : [];
    const detailImages = Array.isArray(payload.detailImages)
      ? payload.detailImages.filter(Boolean)
      : [];
    const title = String(payload.title || '').trim();
    const addressText = String(payload.addressText || '').trim();
    const addressName = String(payload.addressName || '').trim();
    const previousAddressName = String(activity.addressName || '').trim();
    const previousAddressText = String(activity.addressText || '').trim();
    const staleAddressName =
      addressText !== previousAddressText &&
      addressName &&
      addressName === previousAddressName &&
      !payload.location;

    Object.assign(activity, {
      title,
      startAt: payload.startAt,
      endAt: payload.endAt,
      signupDeadlineAt: payload.signupDeadlineAt,
      addressText,
      addressName: staleAddressName ? addressText : addressName || addressText,
      location: payload.location || null,
      description: payload.description || '',
      insuranceLink: String(payload.insuranceLink || '').trim(),
      notificationHint: String(payload.notificationHint || '').trim(),
      coverImage: imageList[0] || payload.coverImage || '',
      coverThumbImage: payload.coverThumbImage || '',
      shareImage: payload.shareImage || '',
      imageList,
      detailImages,
      signupLimitTotal,
      registrationNoticeThreshold: normalizeRegistrationNoticeThreshold(
        payload.registrationNoticeThreshold,
        signupLimitTotal
      ),
      requirePhone: false,
      inviteCode: payload.inviteCode || '',
      updatedAt: stamp
    });

    syncBenchTeam(state, payload.activityId, regularTeamDrafts, activity.signupLimitTotal, stamp);
    syncRegularTeams(state, payload.activityId, existingRegularTeams, regularTeamDrafts, stamp);
    state.activityLogs.push({
      activityId: payload.activityId,
      operatorOpenId: openid,
      action: 'update_activity',
      createdAt: stamp
    });

    writeState(state);
    return {
      activityId: payload.activityId,
      updated: true
    };
  }

  function updateTeamColor(payload) {
    const state = readState();
    const stamp = now();
    const openid = getOpenId();
    const activity = state.activities[payload.activityId];
    const team = state.teams[payload.teamId];
    const user = state.users[openid] || buildDefaultUser(openid, stamp);
    const colorKey = String(payload.colorKey || '').trim();

    if (!activity) {
      throw new Error('Activity not found');
    }

    if (!canEditActivity(activity, user, openid)) {
      throw new Error('Only the organizer or an admin can update team colors');
    }

    if (!team || team.activityId !== payload.activityId || team.status === 'inactive') {
      throw new Error('Team not found');
    }

    if (!isTeamColorKey(colorKey)) {
      throw new Error('Unsupported team color');
    }

    team.colorKey = colorKey;
    team.updatedAt = stamp;
    writeState(state);

    return {
      activityId: payload.activityId,
      teamId: payload.teamId,
      colorKey: team.colorKey,
      updated: true
    };
  }

  function listActivities(payload) {
    const state = readState();
    const openid = getOpenId();
    const activities = Object.values(state.activities);
    const request = payload || {};

    if (request.scope === 'home') {
      return {
        items: clone(
          pageActivityList(
            activities.filter(item => item.status === 'published' || item.status === 'cancelled'),
            request
          )
        )
      };
    }

    if (request.scope === 'created') {
      return {
        items: clone(pageActivityList(activities.filter(item => item.organizerOpenId === openid), request))
      };
    }

    if (request.scope === 'joined') {
      const joinedIds = new Set(
        Object.values(state.registrations)
          .filter(item => item.userOpenId === openid && item.status === 'joined')
          .map(item => item.activityId)
      );

      return {
        items: clone(pageActivityList(
          activities.filter(item => joinedIds.has(item._id) && item.status !== 'deleted'),
          request
        ))
      };
    }

    return {
      items: clone(pageActivityList(
        activities.filter(item => item.status === (request.status || 'published')),
        request
      ))
    };
  }

  function getActivityDetail(payload) {
    const state = readState();
    const openid = getOpenId();
    const activity = state.activities[payload.activityId];

    if (!activity) {
      throw new Error('Activity not found');
    }

    if (activity.status === 'deleted' && activity.organizerOpenId !== openid) {
      throw new Error('Activity not found');
    }

    const viewerUser = state.users[openid] || buildDefaultUser(openid, now());
    const canManageRegistrations = canEditActivity(activity, viewerUser, openid);
    const teams = Object.values(state.teams)
      .filter(team => team.activityId === payload.activityId && team.status !== 'inactive')
      .sort((left, right) => left.sort - right.sort)
      .map(team => {
        const members = Object.values(state.registrations)
          .filter(item => item.activityId === payload.activityId && item.teamId === team._id && item.status === 'joined')
          .sort((left, right) => String(left.joinedAt).localeCompare(String(right.joinedAt)))
          .map(item => {
            const member = {
              userOpenId: item.userOpenId,
              signupName: item.signupName,
              avatarUrl:
                item.avatarUrl ||
                (state.users[item.userOpenId] && state.users[item.userOpenId].avatarUrl) ||
                '',
              preferredPositions: Array.isArray(item.preferredPositions)
                ? item.preferredPositions.filter(Boolean)
                : []
            };

            if (canManageRegistrations) {
              member.proxyRegistration = Boolean(item.proxyRegistration);
            }

            return member;
          });

        return {
          ...team,
          members
        };
      });
    const current = state.registrations[`${payload.activityId}_${openid}`] || null;
    const deadline = Date.parse(activity.signupDeadlineAt || '');
    const canCancelSignup = Boolean(
      current &&
        current.status === 'joined' &&
        activity.status === 'published' &&
        (!Number.isFinite(deadline) || Date.parse(now()) <= deadline)
    );
    const registrationNotificationSubscribed = canManageRegistrations
      ? Object.values(state.notificationSubscriptions).some(
          item =>
            item.activityId === payload.activityId &&
            item.userOpenId === openid &&
            item.templateKey === MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY &&
            item.status === 'accepted'
        )
      : false;

    return {
      activity: clone(activity),
      teams: clone(teams),
      myRegistration: clone(current),
      viewer: {
        isOrganizer: activity.organizerOpenId === openid,
        canEditActivity: canManageRegistrations,
        canManageRegistrations,
        canCancelActivity: canManageRegistrations && activity.status === 'published',
        canDeleteActivity: activity.organizerOpenId === openid && Number(activity.joinedCount) === 0,
        canCancelSignup,
        registrationNotificationSubscribed
      }
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
    const signupName = normalizeSignupName(payload.signupName);
    const phone = String(payload.phone || '').trim();
    const phoneSource = phone ? normalizeSource(payload.phoneSource) : '';
    const avatarUrl = String(payload.avatarUrl || '').trim();
    const profileSource = avatarUrl ? normalizeSource(payload.profileSource) : 'manual';
    const preferredPositions = validatePreferredPositions(payload.preferredPositions);

    if (!activity || activity.status !== 'published') {
      throw new Error('Activity is not open for signup');
    }

    const deadline = Date.parse(activity.signupDeadlineAt || '');
    if (Number.isFinite(deadline) && Date.parse(stamp) > deadline) {
      throw new Error('Signup is closed');
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

    if (
      !canEditActivity(activity, state.users[openid], openid) &&
      getRepeatExitCount(current) >= MAX_REPEAT_EXIT_COUNT
    ) {
      throw new Error(REPEAT_SIGNUP_LIMIT_MESSAGE);
    }

    const user = ensureUserInState(state, openid, stamp);
    user.preferredName = signupName;
    if (avatarUrl) {
      user.avatarUrl = avatarUrl;
    }
    if (phone) {
      user.phoneNumber = phone;
      user.phoneSource = phoneSource;
    }
    user.profileSource = profileSource;
    user.preferredPositions = preferredPositions;
    user.lastActiveAt = stamp;
    user.updatedAt = stamp;

    const registrationData = {
      _id: registrationId,
      activityId: payload.activityId,
      teamId: payload.teamId,
      userOpenId: openid,
      status: 'joined',
      signupName,
      avatarUrl,
      profileSource,
      preferredPositions,
      source: payload.source || 'direct',
      joinedAt: stamp,
      cancelledAt: current ? current.cancelledAt || '' : '',
      cancelCount: normalizeCount(current && current.cancelCount),
      removedCount: normalizeCount(current && current.removedCount),
      updatedAt: stamp
    };

    if (phone) {
      registrationData.phoneSnapshot = phone;
      registrationData.phoneSource = phoneSource;
    }

    state.registrations[registrationId] = registrationData;

    activity.joinedCount += 1;
    activity.updatedAt = stamp;
    team.joinedCount += 1;

    if (
      !canEditActivity(activity, user, openid) &&
      shouldNotifyManagersForJoin(activity, activity.joinedCount)
    ) {
      recordManagerRegistrationNotifications(
        state,
        activity,
        openid,
        signupName,
        'registration_joined',
        stamp
      );
    }

    writeState(state);

    return {
      registrationId,
      teamId: payload.teamId,
      status: 'joined'
    };
  }

  function addProxyRegistration(payload) {
    validateSignupPayload(payload);
    const preferredPositions = validatePreferredPositions(payload.preferredPositions);
    const state = readState();
    const openid = getOpenId();
    const stamp = now();
    const activity = state.activities[payload.activityId];
    const team = state.teams[payload.teamId];
    const signupName = normalizeSignupName(payload.signupName);

    if (!activity || activity.status === 'deleted') {
      throw new Error('Activity not found');
    }

    const actor = ensureUserInState(state, openid, stamp);
    if (!canEditActivity(activity, actor, openid)) {
      throw new Error('Only the organizer or an admin can add participants');
    }

    if (activity.status !== 'published') {
      throw new Error('Activity is not open for signup');
    }

    const deadline = Date.parse(activity.signupDeadlineAt || '');
    if (Number.isFinite(deadline) && Date.parse(stamp) > deadline) {
      throw new Error('Signup is closed');
    }

    if (!team || team.activityId !== payload.activityId || team.status === 'inactive') {
      throw new Error('Team not found');
    }

    if (activity.joinedCount >= activity.signupLimitTotal) {
      throw new Error('Activity is full');
    }

    if (team.joinedCount >= team.maxMembers) {
      throw new Error('Team is full');
    }

    const proxyUserOpenId = nextId(state, 'proxy');
    const registrationId = `${payload.activityId}_${proxyUserOpenId}`;
    const registrationData = {
      _id: registrationId,
      activityId: payload.activityId,
      teamId: payload.teamId,
      userOpenId: proxyUserOpenId,
      status: 'joined',
      signupName,
      avatarUrl: '',
      profileSource: 'proxy',
      preferredPositions,
      source: 'proxy',
      proxyRegistration: true,
      createdByOpenId: openid,
      joinedAt: stamp,
      cancelledAt: '',
      updatedAt: stamp
    };

    state.registrations[registrationId] = registrationData;
    activity.joinedCount += 1;
    activity.updatedAt = stamp;
    team.joinedCount += 1;
    writeState(state);

    return {
      registrationId,
      teamId: payload.teamId,
      userOpenId: proxyUserOpenId,
      status: 'joined',
      proxyRegistration: true
    };
  }

  function resolvePhoneNumber(payload) {
    if (!payload.code) {
      throw new Error('Phone authorization code is required');
    }

    const phoneNumber = String(payload.phoneNumber || '13800000000').trim();
    return {
      phoneNumber,
      purePhoneNumber: phoneNumber,
      countryCode: '86',
      phoneSource: 'wechat'
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

    if (activity.status !== 'published') {
      throw new Error('Signup can no longer be cancelled');
    }

    const deadline = Date.parse(activity.signupDeadlineAt || '');
    if (Number.isFinite(deadline) && Date.parse(stamp) > deadline) {
      throw new Error('Signup can no longer be cancelled');
    }

    current.status = 'cancelled';
    current.cancelledAt = stamp;
    current.cancelCount = normalizeCount(current.cancelCount) + 1;
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

  function removeRegistration(payload) {
    if (!payload.activityId) {
      throw new Error('activityId is required');
    }

    if (!payload.userOpenId) {
      throw new Error('userOpenId is required');
    }

    const state = readState();
    const openid = getOpenId();
    const stamp = now();
    const activity = state.activities[payload.activityId];
    const actor = state.users[openid] || buildDefaultUser(openid, stamp);

    if (!activity || activity.status === 'deleted') {
      throw new Error('Activity not found');
    }

    if (!canEditActivity(activity, actor, openid)) {
      throw new Error('Only the organizer or an admin can remove registrations');
    }

    const registrationId = `${payload.activityId}_${payload.userOpenId}`;
    const current = state.registrations[registrationId];

    if (!current || current.status !== 'joined') {
      throw new Error('No active registration to remove');
    }

    const team = state.teams[current.teamId];
    const promotion = team && team.teamType !== 'bench'
      ? findBenchPromotionCandidate(state, payload.activityId)
      : null;

    current.status = 'cancelled';
    current.cancelledAt = stamp;
    current.removedByOpenId = openid;
    current.removedAt = stamp;
    current.removedCount = normalizeCount(current.removedCount) + 1;
    current.updatedAt = stamp;

    activity.joinedCount = Math.max(Number(activity.joinedCount || 0) - 1, 0);
    activity.updatedAt = stamp;

    if (promotion) {
      promotion.registration.teamId = current.teamId;
      promotion.registration.updatedAt = stamp;
      promotion.fromTeam.joinedCount = Math.max(
        Number(promotion.fromTeam.joinedCount || 0) - 1,
        0
      );
    } else if (team) {
      team.joinedCount = Math.max(Number(team.joinedCount || 0) - 1, 0);
    }

    writeState(state);
    return {
      registrationId,
      activityId: payload.activityId,
      userOpenId: payload.userOpenId,
      teamId: current.teamId,
      status: 'cancelled',
      removed: true,
      promotedRegistrationId: promotion ? promotion.registrationId : '',
      promotedTeamId: promotion ? current.teamId : '',
      promotedFromTeamId: promotion ? promotion.fromTeam._id : ''
    };
  }

  function moveRegistration(payload) {
    if (!payload.activityId) {
      throw new Error('activityId is required');
    }

    if (!payload.userOpenId) {
      throw new Error('userOpenId is required');
    }

    if (!payload.targetTeamId) {
      throw new Error('targetTeamId is required');
    }

    const state = readState();
    const openid = getOpenId();
    const stamp = now();
    const activity = state.activities[payload.activityId];
    const actor = state.users[openid] || buildDefaultUser(openid, stamp);

    if (!activity || activity.status === 'deleted') {
      throw new Error('Activity not found');
    }

    if (!canEditActivity(activity, actor, openid)) {
      throw new Error('Only the organizer or an admin can move registrations');
    }

    if (activity.status !== 'published') {
      throw new Error('Activity is not open for roster changes');
    }

    const registrationId = `${payload.activityId}_${payload.userOpenId}`;
    const current = state.registrations[registrationId];

    if (!current || current.status !== 'joined') {
      throw new Error('No active registration to move');
    }

    if (current.teamId === payload.targetTeamId) {
      throw new Error('Already in target team');
    }

    const targetTeam = state.teams[payload.targetTeamId];
    if (!targetTeam || targetTeam.activityId !== payload.activityId || targetTeam.status === 'inactive') {
      throw new Error('Team not found');
    }

    const sourceTeam = state.teams[current.teamId];
    if (
      (sourceTeam && sourceTeam.teamType === 'bench') ||
      targetTeam.teamType === 'bench'
    ) {
      throw new Error('Bench registrations are managed automatically');
    }

    if (Number(targetTeam.joinedCount || 0) >= Number(targetTeam.maxMembers || 0)) {
      throw new Error('Team is full');
    }

    const fromTeamId = current.teamId;

    current.teamId = payload.targetTeamId;
    current.movedByOpenId = openid;
    current.movedAt = stamp;
    current.updatedAt = stamp;

    if (sourceTeam) {
      sourceTeam.joinedCount = Math.max(Number(sourceTeam.joinedCount || 0) - 1, 0);
    }

    targetTeam.joinedCount = Number(targetTeam.joinedCount || 0) + 1;
    activity.updatedAt = stamp;

    writeState(state);
    return {
      registrationId,
      activityId: payload.activityId,
      userOpenId: payload.userOpenId,
      fromTeamId,
      teamId: payload.targetTeamId,
      status: 'joined',
      moved: true
    };
  }

  function cancelActivity(payload) {
    const state = readState();
    const openid = getOpenId();
    const stamp = now();
    const activity = state.activities[payload.activityId];

    if (!activity) {
      throw new Error('Activity not found');
    }

    if (!canEditActivity(activity, state.users[openid], openid)) {
      throw new Error('Only the organizer or an admin can cancel this activity');
    }

    activity.status = 'cancelled';
    activity.updatedAt = stamp;
    writeState(state);

    return {
      activityId: payload.activityId,
      status: 'cancelled'
    };
  }

  function normalizeSubscriptionStatus(value) {
    return value === 'accept' || value === 'accepted' ? 'accepted' : 'declined';
  }

  function recordNotificationSubscription(payload) {
    if (!payload.activityId) {
      throw new Error('activityId is required');
    }

    if (!payload.templateId) {
      throw new Error('templateId is required');
    }

    const state = readState();
    const openid = getOpenId();
    const stamp = now();
    const templateKey =
      String(payload.templateKey || ACTIVITY_NOTICE_TEMPLATE_KEY).trim() ||
      ACTIVITY_NOTICE_TEMPLATE_KEY;
    const status = normalizeSubscriptionStatus(payload.status);
    const subscriptionId = `${payload.activityId}_${openid}_${templateKey}`;

    state.notificationSubscriptions[subscriptionId] = {
      _id: subscriptionId,
      activityId: payload.activityId,
      userOpenId: openid,
      templateKey,
      templateId: String(payload.templateId).trim(),
      status,
      subscribed: status === 'accepted',
      updatedAt: stamp
    };

    writeState(state);
    return {
      activityId: payload.activityId,
      templateKey,
      status,
      subscribed: status === 'accepted'
    };
  }

  function confirmWebAdminLogin(payload) {
    if (!payload.qrPayload) {
      throw new Error('qrPayload is required');
    }

    const state = readState();
    const openid = getOpenId();
    const stamp = now();
    const user = ensureUserInState(state, openid, stamp);

    if (!canCreateActivity(user)) {
      throw new Error('Only organizers or admins can confirm web admin login');
    }

    user.lastActiveAt = stamp;
    writeState(state);

    return {
      ok: true,
      status: 'confirmed'
    };
  }

  function hasNotificationLog(state, activityId, notificationType, userOpenId) {
    return state.notificationLogs.some(
      item =>
        item.activityId === activityId &&
        item.notificationType === notificationType &&
        item.recipientOpenId === userOpenId &&
        item.status === 'sent'
    );
  }

  function getAcceptedManagerSubscriptions(state, activity, actorOpenId) {
    return Object.values(state.notificationSubscriptions).filter(item => {
      if (
        item.activityId !== activity._id ||
        item.templateKey !== MANAGER_REGISTRATION_NOTICE_TEMPLATE_KEY ||
        item.status !== 'accepted' ||
        !item.userOpenId ||
        !item.templateId ||
        item.userOpenId === actorOpenId
      ) {
        return false;
      }

      return canEditActivity(activity, state.users[item.userOpenId], item.userOpenId);
    });
  }

  function recordManagerRegistrationNotifications(
    state,
    activity,
    actorOpenId,
    actorName,
    notificationType,
    stamp
  ) {
    getAcceptedManagerSubscriptions(state, activity, actorOpenId).forEach(subscription => {
      state.notificationLogs.push({
        _id: nextId(state, 'notification_log'),
        activityId: activity._id,
        actorOpenId,
        actorName: actorName || '',
        recipientOpenId: subscription.userOpenId,
        notificationType,
        templateId: subscription.templateId,
        status: 'sent',
        createdAt: stamp
      });
      subscription.status = 'consumed';
      subscription.subscribed = false;
      subscription.consumedAt = stamp;
      subscription.updatedAt = stamp;
      subscription.lastSendStatus = 'sent';
    });
  }

  function notifyActivityParticipants(payload) {
    if (!payload.activityId) {
      throw new Error('activityId is required');
    }

    if (!['proceeding', 'cancelled'].includes(payload.notificationType)) {
      throw new Error('Unsupported notification type');
    }

    const state = readState();
    const openid = getOpenId();
    const stamp = now();
    const activity = state.activities[payload.activityId];
    const actor = state.users[openid] || buildDefaultUser(openid, stamp);

    if (!activity) {
      throw new Error('Activity not found');
    }

    if (!canEditActivity(activity, actor, openid)) {
      throw new Error('Only the organizer or an admin can notify participants');
    }

    if (payload.notificationType === 'proceeding') {
      if (activity.status !== 'published') {
        throw new Error('Only published activities can be confirmed');
      }

      activity.confirmStatus = 'confirmed';
      activity.confirmedAt = stamp;
      activity.confirmedByOpenId = openid;
      activity.updatedAt = stamp;
    } else {
      activity.status = 'cancelled';
      activity.cancelledAt = stamp;
      activity.cancelledByOpenId = openid;
      activity.updatedAt = stamp;
    }

    const joinedOpenIds = new Set(
      Object.values(state.registrations)
        .filter(item => item.activityId === payload.activityId && item.status === 'joined')
        .map(item => item.userOpenId)
    );
    const subscriptions = Object.values(state.notificationSubscriptions).filter(
      item =>
        item.activityId === payload.activityId &&
        item.templateKey === ACTIVITY_NOTICE_TEMPLATE_KEY &&
        item.status === 'accepted' &&
        joinedOpenIds.has(item.userOpenId)
    );
    const startAt = Date.parse(activity.startAt || '');
    const stampAt = Date.parse(stamp);
    const alreadyStarted = Number.isFinite(startAt) && Number.isFinite(stampAt) && stampAt >= startAt;
    let sent = 0;
    let skipped = 0;

    subscriptions.forEach(subscription => {
      if (alreadyStarted) {
        state.notificationLogs.push({
          _id: nextId(state, 'notification_log'),
          activityId: payload.activityId,
          recipientOpenId: subscription.userOpenId,
          notificationType: payload.notificationType,
          templateId: subscription.templateId,
          status: 'skipped',
          reason: 'activity-already-started',
          createdAt: stamp
        });
        skipped += 1;
        return;
      }

      if (
        hasNotificationLog(
          state,
          payload.activityId,
          payload.notificationType,
          subscription.userOpenId
        )
      ) {
        skipped += 1;
        return;
      }

      state.notificationLogs.push({
        _id: nextId(state, 'notification_log'),
        activityId: payload.activityId,
        recipientOpenId: subscription.userOpenId,
        notificationType: payload.notificationType,
        templateId: subscription.templateId,
        status: 'sent',
        createdAt: stamp
      });
      sent += 1;
    });

    writeState(state);
    return {
      activityId: payload.activityId,
      notificationType: payload.notificationType,
      confirmed: payload.notificationType === 'proceeding',
      cancelled: payload.notificationType === 'cancelled',
      totalRecipients: subscriptions.length,
      sent,
      failed: 0,
      skipped
    };
  }

  function deleteActivity(payload) {
    const state = readState();
    const openid = getOpenId();
    const stamp = now();
    const activity = state.activities[payload.activityId];

    if (!activity) {
      throw new Error('Activity not found');
    }

    if (activity.organizerOpenId !== openid) {
      throw new Error('Only the organizer can delete this activity');
    }

    if (Number(activity.joinedCount) > 0) {
      throw new Error('Only activities without joined players can be deleted');
    }

    activity.status = 'deleted';
    activity.updatedAt = stamp;

    writeState(state);
    return {
      activityId: payload.activityId,
      status: 'deleted'
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
    updateActivity,
    updateTeamColor,
    listActivities,
    getActivityDetail,
    joinActivity,
    addProxyRegistration,
    resolvePhoneNumber,
    cancelRegistration,
    removeRegistration,
    moveRegistration,
    recordNotificationSubscription,
    confirmWebAdminLogin,
    notifyActivityParticipants,
    cancelActivity,
    deleteActivity,
    getActivityStats
  };

  return {
    call(name, payload = {}) {
      const handler = handlers[name];
      if (!handler) {
        return Promise.reject(new Error(`Unknown local cloud function: ${name}`));
      }

      try {
        return Promise.resolve(handler(payload));
      } catch (error) {
        return Promise.reject(error);
      }
    }
  };
}

module.exports = {
  buildStorageAdapter,
  createLocalCloudClient
};

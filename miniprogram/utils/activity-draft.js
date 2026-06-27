const { MAX_ACTIVITY_IMAGES, MAX_DETAIL_IMAGES } = require('./constants');
const { normalizeTeamColorKey } = require('./team-colors');

const MAX_NOTIFICATION_HINT_LENGTH = 20;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]+/g;
const ACTIVITY_TYPE_INTERNAL = 'internal';
const ACTIVITY_TYPE_EXTERNAL = 'external';
const ACTIVITY_TYPE_VALUES = [ACTIVITY_TYPE_INTERNAL, ACTIVITY_TYPE_EXTERNAL];

function limitTextLength(value, maxLength) {
  return Array.from(String(value || '')).slice(0, maxLength).join('');
}

function normalizeNotificationHint(value) {
  const text = String(value || '').replace(CONTROL_CHARACTER_PATTERN, ' ').trim();
  return limitTextLength(text, MAX_NOTIFICATION_HINT_LENGTH);
}

function normalizeActivityType(value) {
  const type = String(value || '').trim();

  if (!type) {
    return ACTIVITY_TYPE_INTERNAL;
  }

  return ACTIVITY_TYPE_VALUES.includes(type) ? type : ACTIVITY_TYPE_INTERNAL;
}

function resolveNow(nowOption) {
  return typeof nowOption === 'function' ? nowOption() : new Date();
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatTimeInputValue(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function parseDateInput(isoValue) {
  const date = new Date(isoValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTomorrowDateInputValue(nowOption) {
  const tomorrow = new Date(resolveNow(nowOption).getTime());
  tomorrow.setDate(tomorrow.getDate() + 1);

  return formatDateInputValue(tomorrow);
}

function getDefaultRegistrationNoticeThreshold(signupLimitTotal) {
  const total = Number(signupLimitTotal) || 0;
  return total > 0 ? Math.ceil(total * 0.8) : 0;
}

function normalizeRegistrationNoticeThreshold(value, signupLimitTotal) {
  const threshold = Number(value || 0);

  if (Number.isFinite(threshold) && threshold > 0) {
    return Math.floor(threshold);
  }

  return getDefaultRegistrationNoticeThreshold(signupLimitTotal);
}

function createDefaultActivityForm(options = {}) {
  const defaultTeams = Array.isArray(options.defaultTeams) && options.defaultTeams.length
    ? options.defaultTeams
    : [
        { teamName: '队伍1', maxMembers: 12 }
      ];
  const teams = defaultTeams.map((team, index) => ({
    ...team,
    colorKey: normalizeTeamColorKey(team.colorKey, index)
  }));
  const defaultDate = getTomorrowDateInputValue(options.now);

  return {
    title: '',
    activityType: ACTIVITY_TYPE_INTERNAL,
    activityDate: defaultDate,
    startTime: '20:00',
    endTime: '22:00',
    signupDeadlineDate: defaultDate,
    signupDeadlineTime: '20:00',
    addressText: '',
    addressName: '',
    location: null,
    description: '',
    insuranceLink: '',
    notificationHint: '',
    coverImage: '',
    coverThumbImage: '',
    shareImage: '',
    imageList: [],
    detailImages: [],
    signupLimitTotal: 12,
    registrationNoticeThreshold: getDefaultRegistrationNoticeThreshold(12),
    inviteCode: '',
    teams
  };
}

function summarizeTeamSlots(form) {
  const namedTeamSlots = form.teams.reduce((sum, team) => sum + (Number(team.maxMembers) || 0), 0);
  const totalSignupLimit = Number(form.signupLimitTotal) || 0;

  return {
    namedTeamSlots,
    benchSlots: Math.max(totalSignupLimit - namedTeamSlots, 0),
    overCapacity: totalSignupLimit < namedTeamSlots
  };
}

function combineDateAndTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return '';
  }

  return new Date(`${dateValue}T${timeValue}:00`).toISOString();
}

function normalizeImageList(form) {
  const images = Array.isArray(form.imageList) ? form.imageList.filter(Boolean) : [];

  if (images.length > 0) {
    return images.slice(0, MAX_ACTIVITY_IMAGES);
  }

  return form.coverImage ? [form.coverImage] : [];
}

function normalizeDetailImages(form) {
  const images = Array.isArray(form.detailImages) ? form.detailImages.filter(Boolean) : [];
  return images.slice(0, MAX_DETAIL_IMAGES);
}

function buildActivityPayload(form) {
  const { requirePhone, ...payloadBase } = form;
  const imageList = normalizeImageList(form);
  const detailImages = normalizeDetailImages(form);
  const coverImage = imageList[0] || form.coverImage || '';
  const coverThumbImage = coverImage ? form.coverThumbImage || '' : '';
  const teams = (Array.isArray(form.teams) ? form.teams : []).map((team, index) => ({
    ...team,
    teamName: String(team.teamName || '').trim(),
    maxMembers: Number(team.maxMembers) || 0,
    colorKey: normalizeTeamColorKey(team.colorKey, index)
  }));

  return {
    ...payloadBase,
    activityType: normalizeActivityType(form.activityType),
    teams,
    startAt: combineDateAndTime(form.activityDate, form.startTime),
    endAt: combineDateAndTime(form.activityDate, form.endTime),
    signupDeadlineAt: combineDateAndTime(form.signupDeadlineDate, form.signupDeadlineTime),
    insuranceLink: String(form.insuranceLink || '').trim(),
    notificationHint: normalizeNotificationHint(form.notificationHint),
    registrationNoticeThreshold: normalizeRegistrationNoticeThreshold(
      form.registrationNoticeThreshold,
      form.signupLimitTotal
    ),
    coverImage,
    coverThumbImage,
    shareImage: coverImage ? form.shareImage || '' : '',
    imageList,
    detailImages
  };
}

function buildActivityEditForm(activity = {}, teams = []) {
  const startAt = parseDateInput(activity.startAt);
  const endAt = parseDateInput(activity.endAt);
  const signupDeadlineAt = parseDateInput(activity.signupDeadlineAt);
  const imageList = Array.isArray(activity.imageList)
    ? activity.imageList.filter(Boolean).slice(0, MAX_ACTIVITY_IMAGES)
    : activity.coverImage
      ? [activity.coverImage]
      : [];
  const detailImages = Array.isArray(activity.detailImages)
    ? activity.detailImages.filter(Boolean).slice(0, MAX_DETAIL_IMAGES)
    : [];
  const editableTeams = teams
    .filter(team => team.status !== 'inactive' && team.teamType !== 'bench')
    .map((team, index) => ({
      _id: team._id || '',
      teamName: team.teamName,
      maxMembers: Number(team.maxMembers) || 0,
      joinedCount: Number(team.joinedCount) || 0,
      colorKey: normalizeTeamColorKey(team.colorKey, index)
    }));

  return {
    title: activity.title || '',
    activityType: normalizeActivityType(activity.activityType),
    activityDate: startAt ? formatDateInputValue(startAt) : '',
    startTime: startAt ? formatTimeInputValue(startAt) : '',
    endTime: endAt ? formatTimeInputValue(endAt) : '',
    signupDeadlineDate: signupDeadlineAt ? formatDateInputValue(signupDeadlineAt) : '',
    signupDeadlineTime: signupDeadlineAt ? formatTimeInputValue(signupDeadlineAt) : '',
    addressText: activity.addressText || '',
    addressName: activity.addressName || activity.addressText || '',
    location: activity.location || null,
    description: activity.description || '',
    insuranceLink: activity.insuranceLink || '',
    notificationHint: normalizeNotificationHint(activity.notificationHint),
    coverImage: imageList[0] || activity.coverImage || '',
    coverThumbImage: activity.coverThumbImage || '',
    shareImage: activity.shareImage || '',
    imageList,
    detailImages,
    signupLimitTotal: Number(activity.signupLimitTotal) || 0,
    registrationNoticeThreshold: normalizeRegistrationNoticeThreshold(
      activity.registrationNoticeThreshold,
      Number(activity.signupLimitTotal) || 0
    ),
    inviteCode: activity.inviteCode || '',
    teams: editableTeams
  };
}

function buildActivityCopyForm(draft = {}) {
  const sourceStartAt = parseDateInput(draft.sourceStartAt || draft.startAt);
  const sourceEndAt = parseDateInput(draft.sourceEndAt || draft.endAt);
  const sourceSignupDeadlineAt = parseDateInput(
    draft.sourceSignupDeadlineAt || draft.signupDeadlineAt
  );
  const imageList = Array.isArray(draft.imageList)
    ? draft.imageList.filter(Boolean).slice(0, MAX_ACTIVITY_IMAGES)
    : draft.coverImage
      ? [draft.coverImage]
      : [];
  const detailImages = Array.isArray(draft.detailImages)
    ? draft.detailImages.filter(Boolean).slice(0, MAX_DETAIL_IMAGES)
    : [];
  const reusableTeams = Array.isArray(draft.teams)
    ? draft.teams.map((team, index) => ({
        teamName: String(team.teamName || '').trim(),
        maxMembers: Number(team.maxMembers) || 0,
        colorKey: normalizeTeamColorKey(team.colorKey, index)
      }))
    : [];

  return {
    title: draft.title || '',
    activityType: normalizeActivityType(draft.activityType),
    activityDate: '',
    startTime: sourceStartAt ? formatTimeInputValue(sourceStartAt) : '',
    endTime: sourceEndAt ? formatTimeInputValue(sourceEndAt) : '',
    signupDeadlineDate: '',
    signupDeadlineTime: sourceSignupDeadlineAt ? formatTimeInputValue(sourceSignupDeadlineAt) : '',
    addressText: draft.addressText || '',
    addressName: draft.addressName || draft.addressText || '',
    location: draft.location || null,
    description: draft.description || '',
    insuranceLink: draft.insuranceLink || '',
    notificationHint: normalizeNotificationHint(draft.notificationHint),
    coverImage: imageList[0] || draft.coverImage || '',
    coverThumbImage: draft.coverThumbImage || '',
    shareImage: draft.shareImage || '',
    imageList,
    detailImages,
    signupLimitTotal: Number(draft.signupLimitTotal) || 0,
    registrationNoticeThreshold: normalizeRegistrationNoticeThreshold(
      draft.registrationNoticeThreshold,
      Number(draft.signupLimitTotal) || 0
    ),
    inviteCode: '',
    teams: reusableTeams
  };
}

module.exports = {
  ACTIVITY_TYPE_EXTERNAL,
  ACTIVITY_TYPE_INTERNAL,
  ACTIVITY_TYPE_VALUES,
  buildActivityCopyForm,
  buildActivityEditForm,
  buildActivityPayload,
  createDefaultActivityForm,
  getDefaultRegistrationNoticeThreshold,
  normalizeActivityType,
  normalizeNotificationHint,
  normalizeRegistrationNoticeThreshold,
  summarizeTeamSlots
};

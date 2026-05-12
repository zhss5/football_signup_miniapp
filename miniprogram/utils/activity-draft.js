const { MAX_ACTIVITY_IMAGES, MAX_DETAIL_IMAGES } = require('./constants');
const { normalizeTeamColorKey } = require('./team-colors');

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
    teams,
    startAt: combineDateAndTime(form.activityDate, form.startTime),
    endAt: combineDateAndTime(form.activityDate, form.endTime),
    signupDeadlineAt: combineDateAndTime(form.signupDeadlineDate, form.signupDeadlineTime),
    insuranceLink: String(form.insuranceLink || '').trim(),
    notificationHint: String(form.notificationHint || '').trim(),
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
      colorKey: normalizeTeamColorKey(team.colorKey, index)
    }));

  return {
    title: activity.title || '',
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
    notificationHint: activity.notificationHint || '',
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

module.exports = {
  buildActivityEditForm,
  buildActivityPayload,
  createDefaultActivityForm,
  getDefaultRegistrationNoticeThreshold,
  normalizeRegistrationNoticeThreshold,
  summarizeTeamSlots
};

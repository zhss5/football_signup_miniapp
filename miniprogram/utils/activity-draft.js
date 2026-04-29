const { MAX_ACTIVITY_IMAGES } = require('./constants');

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

function createDefaultActivityForm(options = {}) {
  const defaultTeams = Array.isArray(options.defaultTeams) && options.defaultTeams.length
    ? options.defaultTeams
    : [
        { teamName: 'White', maxMembers: 6 },
        { teamName: 'Red', maxMembers: 6 }
      ];
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
    coverImage: '',
    imageList: [],
    signupLimitTotal: 12,
    requirePhone: false,
    inviteCode: '',
    teams: defaultTeams
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

function buildActivityPayload(form) {
  const imageList = normalizeImageList(form);
  const coverImage = imageList[0] || form.coverImage || '';

  return {
    ...form,
    startAt: combineDateAndTime(form.activityDate, form.startTime),
    endAt: combineDateAndTime(form.activityDate, form.endTime),
    signupDeadlineAt: combineDateAndTime(form.signupDeadlineDate, form.signupDeadlineTime),
    coverImage,
    imageList
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
  const editableTeams = teams
    .filter(team => team.status !== 'inactive' && team.teamType !== 'bench')
    .map(team => ({
      teamName: team.teamName,
      maxMembers: Number(team.maxMembers) || 0
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
    coverImage: imageList[0] || activity.coverImage || '',
    imageList,
    signupLimitTotal: Number(activity.signupLimitTotal) || 0,
    requirePhone: Boolean(activity.requirePhone),
    inviteCode: activity.inviteCode || '',
    teams: editableTeams
  };
}

module.exports = {
  buildActivityEditForm,
  buildActivityPayload,
  createDefaultActivityForm,
  summarizeTeamSlots
};

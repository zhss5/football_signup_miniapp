const MAX_ACTIVITY_IMAGES = 1;
const MAX_SIGNUP_NAME_LENGTH = 16;

function normalizeSignupName(value) {
  const normalizedWhitespace = String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return Array.from(normalizedWhitespace).slice(0, MAX_SIGNUP_NAME_LENGTH).join('');
}

function parseDate(value, fieldName) {
  const stamp = Date.parse(value);

  if (Number.isNaN(stamp)) {
    throw new Error(`${fieldName} is required`);
  }

  return stamp;
}

function validateActivityDraft(draft) {
  if (!draft.title || !draft.title.trim()) {
    throw new Error('Activity title is required');
  }

  if (!draft.addressText || !draft.addressText.trim()) {
    throw new Error('Activity address is required');
  }

  if (!Array.isArray(draft.teams) || draft.teams.length === 0) {
    throw new Error('At least one team is required');
  }

  const startAt = parseDate(draft.startAt, 'Activity start time');
  const endAt = parseDate(draft.endAt, 'Activity end time');
  const signupDeadlineAt = parseDate(draft.signupDeadlineAt, 'Signup deadline');

  if (endAt <= startAt) {
    throw new Error('Activity end time must be later than start time');
  }

  if (signupDeadlineAt > startAt) {
    throw new Error('Signup deadline must be earlier than or equal to activity start time');
  }

  const totalSignupLimit = Number(draft.signupLimitTotal) || 0;
  if (totalSignupLimit <= 0) {
    throw new Error('Total signup limit is required');
  }

  const imageList = Array.isArray(draft.imageList)
    ? draft.imageList.filter(Boolean)
    : draft.coverImage
      ? [draft.coverImage]
      : [];

  if (imageList.length > MAX_ACTIVITY_IMAGES) {
    throw new Error('Only one activity image is supported right now');
  }

  const teamSlots = draft.teams.reduce((sum, team) => {
    if (!team.teamName || !team.teamName.trim()) {
      throw new Error('Team name is required');
    }

    const maxMembers = Number(team.maxMembers) || 0;
    if (maxMembers <= 0) {
      throw new Error('Team capacity must be greater than 0');
    }

    return sum + maxMembers;
  }, 0);

  if (totalSignupLimit < teamSlots) {
    throw new Error('Total signup limit must cover all team slots');
  }

  return true;
}

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

module.exports = {
  MAX_SIGNUP_NAME_LENGTH,
  normalizeSignupName,
  validateActivityDraft,
  validateSignupPayload
};

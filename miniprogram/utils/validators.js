const { MAX_ACTIVITY_IMAGES, MAX_TEAMS } = require('./constants');
const { t: translateText } = require('./i18n');

function buildValidationError(field, key, translate = null) {
  const message = translate ? translate(key) : translateText(key, {}, 'en-US');
  const error = new Error(message);
  error.field = field;
  error.key = key;
  return error;
}

function parseDate(value, fieldName, field, key, translate) {
  const stamp = Date.parse(value);

  if (Number.isNaN(stamp)) {
    throw buildValidationError(field, key, translate);
  }

  return stamp;
}

function validateActivityDraft(draft, translate = null) {
  if (!draft.title || !draft.title.trim()) {
    throw buildValidationError('title', 'errors.activityTitleRequired', translate);
  }

  if (!draft.addressText || !draft.addressText.trim()) {
    throw buildValidationError('addressText', 'errors.activityAddressRequired', translate);
  }

  if (!Array.isArray(draft.teams) || draft.teams.length === 0) {
    throw buildValidationError('teams', 'errors.atLeastOneTeamRequired', translate);
  }

  if (draft.teams.length > MAX_TEAMS) {
    throw buildValidationError('teams', 'errors.tooManyTeams', translate);
  }

  const startAt = parseDate(
    draft.startAt,
    'Activity start time',
    'startAt',
    'errors.activityStartTimeRequired',
    translate
  );
  const endAt = parseDate(
    draft.endAt,
    'Activity end time',
    'endAt',
    'errors.activityEndTimeRequired',
    translate
  );
  const signupDeadlineAt = parseDate(
    draft.signupDeadlineAt,
    'Signup deadline',
    'signupDeadlineAt',
    'errors.signupDeadlineRequired',
    translate
  );

  if (endAt <= startAt) {
    throw buildValidationError('endAt', 'errors.activityEndTimeOrder', translate);
  }

  if (signupDeadlineAt > startAt) {
    throw buildValidationError('signupDeadlineAt', 'errors.signupDeadlineOrder', translate);
  }

  const totalSignupLimit = Number(draft.signupLimitTotal) || 0;
  if (totalSignupLimit <= 0) {
    throw buildValidationError('signupLimitTotal', 'errors.totalSignupLimitRequired', translate);
  }

  const imageList = Array.isArray(draft.imageList)
    ? draft.imageList.filter(Boolean)
    : draft.coverImage
      ? [draft.coverImage]
      : [];

  if (imageList.length > MAX_ACTIVITY_IMAGES) {
    throw buildValidationError('imageList', 'errors.onlyOneActivityImage', translate);
  }

  const teamSlots = draft.teams.reduce((sum, team) => {
    if (!team.teamName || !team.teamName.trim()) {
      throw buildValidationError('teams', 'errors.teamNameRequired', translate);
    }

    const maxMembers = Number(team.maxMembers) || 0;
    if (maxMembers <= 0) {
      throw buildValidationError('teams', 'errors.teamCapacityRequired', translate);
    }

    return sum + maxMembers;
  }, 0);

  if (totalSignupLimit < teamSlots) {
    throw buildValidationError('signupLimitTotal', 'errors.totalSignupLimitCoverTeams', translate);
  }

  return true;
}

module.exports = {
  validateActivityDraft
};

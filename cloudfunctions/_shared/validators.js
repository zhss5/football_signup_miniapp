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

  return true;
}

function validateSignupPayload(payload) {
  if (!payload.activityId) {
    throw new Error('activityId is required');
  }

  if (!payload.teamId) {
    throw new Error('teamId is required');
  }

  if (!payload.signupName || !payload.signupName.trim()) {
    throw new Error('signupName is required');
  }

  return true;
}

module.exports = {
  validateActivityDraft,
  validateSignupPayload
};

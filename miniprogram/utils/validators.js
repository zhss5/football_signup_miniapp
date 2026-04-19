const { MAX_TEAMS } = require('./constants');

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

  if (draft.teams.length > MAX_TEAMS) {
    throw new Error('Too many teams');
  }

  return true;
}

module.exports = {
  validateActivityDraft
};

const { call } = require('./cloud');

function ensureUserProfile() {
  return call('ensureUserProfile');
}

module.exports = {
  ensureUserProfile
};

const { call } = require('./cloud');

function confirmWebAdminLogin(qrPayload) {
  return call('confirmWebAdminLogin', {
    qrPayload
  });
}

module.exports = {
  confirmWebAdminLogin
};

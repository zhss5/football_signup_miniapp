const defaults = {
  USE_LOCAL_MOCK: true,
  CLOUD_ENV_ID: '',
  LOCAL_STORAGE_KEY: 'football-signup-local-cloud-v1'
};

let localOverrides = {};

try {
  // Optional local-only overrides for real CloudBase wiring.
  localOverrides = require('./env.local');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') {
    throw error;
  }
}

module.exports = {
  ...defaults,
  ...localOverrides
};

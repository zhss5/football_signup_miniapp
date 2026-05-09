const TEAM_COLOR_OPTIONS = [
  { key: 'green', labelKey: 'teamColors.green', className: 'team-color-green', requiresBorder: false },
  { key: 'white', labelKey: 'teamColors.white', className: 'team-color-white', requiresBorder: true },
  { key: 'red', labelKey: 'teamColors.red', className: 'team-color-red', requiresBorder: false },
  { key: 'blue', labelKey: 'teamColors.blue', className: 'team-color-blue', requiresBorder: false },
  { key: 'black', labelKey: 'teamColors.black', className: 'team-color-black', requiresBorder: false },
  { key: 'yellow', labelKey: 'teamColors.yellow', className: 'team-color-yellow', requiresBorder: true }
];

const TEAM_COLOR_KEYS = TEAM_COLOR_OPTIONS.map(item => item.key);

function getDefaultTeamColorKey(index = 0) {
  const safeIndex = Math.max(Number(index) || 0, 0);
  return TEAM_COLOR_KEYS[safeIndex % TEAM_COLOR_KEYS.length];
}

function isTeamColorKey(value) {
  return TEAM_COLOR_KEYS.includes(String(value || '').trim());
}

function normalizeTeamColorKey(value, index = 0) {
  const key = String(value || '').trim();
  return isTeamColorKey(key) ? key : getDefaultTeamColorKey(index);
}

function getTeamColorOption(value, index = 0) {
  const key = normalizeTeamColorKey(value, index);
  return TEAM_COLOR_OPTIONS.find(item => item.key === key) || TEAM_COLOR_OPTIONS[0];
}

module.exports = {
  TEAM_COLOR_KEYS,
  TEAM_COLOR_OPTIONS,
  getDefaultTeamColorKey,
  getTeamColorOption,
  isTeamColorKey,
  normalizeTeamColorKey
};

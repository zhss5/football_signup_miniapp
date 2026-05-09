const TEAM_COLOR_KEYS = [
  'green',
  'white',
  'red',
  'blue',
  'black',
  'yellow',
  'orange',
  'purple',
  'gray',
  'pink'
];

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

module.exports = {
  TEAM_COLOR_KEYS,
  getDefaultTeamColorKey,
  isTeamColorKey,
  normalizeTeamColorKey
};

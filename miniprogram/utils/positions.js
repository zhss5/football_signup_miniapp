const POSITION_VALUES = ['前锋', '中场', '边锋', '后腰', '中卫', '边卫', '门将'];
const MAX_PREFERRED_POSITIONS = 2;

function normalizePreferredPositions(value) {
  const seen = new Set();
  const input = Array.isArray(value) ? value : [];

  return input.reduce((positions, item) => {
    const position = String(item || '').trim();

    if (!POSITION_VALUES.includes(position) || seen.has(position)) {
      return positions;
    }

    seen.add(position);
    positions.push(position);
    return positions;
  }, []);
}

function buildPositionOptions(selectedPositions = []) {
  const selected = new Set(normalizePreferredPositions(selectedPositions));

  return POSITION_VALUES.map(value => ({
    value,
    label: value,
    selected: selected.has(value)
  }));
}

module.exports = {
  MAX_PREFERRED_POSITIONS,
  POSITION_VALUES,
  buildPositionOptions,
  normalizePreferredPositions
};

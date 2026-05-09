const {
  TEAM_COLOR_OPTIONS,
  getDefaultTeamColorKey,
  getTeamColorOption,
  normalizeTeamColorKey
} = require('../../../miniprogram/utils/team-colors');

test('cycles team colors green white red blue black yellow', () => {
  expect(Array.from({ length: 8 }, (_, index) => getDefaultTeamColorKey(index))).toEqual([
    'green',
    'white',
    'red',
    'blue',
    'black',
    'yellow',
    'green',
    'white'
  ]);
});

test('normalizes unsupported team colors to the index default', () => {
  expect(normalizeTeamColorKey('purple', 2)).toBe('red');
  expect(normalizeTeamColorKey('blue', 2)).toBe('blue');
});

test('exposes readable palette options', () => {
  expect(TEAM_COLOR_OPTIONS).toContainEqual(
    expect.objectContaining({
      key: 'green',
      labelKey: 'teamColors.green'
    })
  );
  expect(getTeamColorOption('white')).toMatchObject({
    key: 'white',
    requiresBorder: true
  });
});

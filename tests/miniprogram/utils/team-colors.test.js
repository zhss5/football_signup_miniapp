const {
  TEAM_COLOR_OPTIONS,
  getDefaultTeamColorKey,
  getTeamColorOption,
  normalizeTeamColorKey
} = require('../../../miniprogram/utils/team-colors');

test('cycles common kit colors green white red blue black yellow orange purple gray pink', () => {
  expect(Array.from({ length: 12 }, (_, index) => getDefaultTeamColorKey(index))).toEqual([
    'green',
    'white',
    'red',
    'blue',
    'black',
    'yellow',
    'orange',
    'purple',
    'gray',
    'pink',
    'green',
    'white'
  ]);
});

test('normalizes unsupported team colors to the index default', () => {
  expect(normalizeTeamColorKey('teal', 2)).toBe('red');
  expect(normalizeTeamColorKey('purple', 2)).toBe('purple');
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
  expect(getTeamColorOption('pink')).toMatchObject({
    key: 'pink',
    labelKey: 'teamColors.pink'
  });
});

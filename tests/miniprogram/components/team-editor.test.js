const fs = require('fs');
const path = require('path');

describe('team editor minimum team count', () => {
  let componentConfig;

  beforeEach(() => {
    componentConfig = null;
    global.Component = jest.fn(config => {
      componentConfig = config;
    });
    global.wx = {
      showToast: jest.fn()
    };

    jest.resetModules();
    require('../../../miniprogram/components/team-editor/index');
  });

  test('renders remove controls whenever there is more than one team', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-editor/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{teams.length > 1}}"');
    expect(wxml).not.toContain('index >= 2');
  });

  test('keeps the remove control in the same row as the team inputs', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-editor/index.wxml'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-editor/index.wxss'),
      'utf8'
    );
    const teamFieldsBlock = wxml.match(/<view class="team-fields">[\s\S]*?<\/view>/)[0];

    expect(teamFieldsBlock).toContain('class="remove-button"');
    expect(wxss).toContain('.team-fields');
    expect(wxss).toMatch(/\.team-fields\s*{[^}]*align-items:\s*center;/);
    expect(wxss).toMatch(/\.remove-button\s*{[^}]*flex:/);
  });

  test('renders a team color chip in the team editor row', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-editor/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('class="team-color-chip');
    expect(wxml).toContain('data-field="colorKey"');
  });

  test('cycles the selected team color when the color chip is tapped', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      properties: {
        teams: [
          {
            teamName: 'White',
            maxMembers: 8,
            colorKey: 'green'
          }
        ]
      },
      triggerEvent,
      emitTeams: componentConfig.methods.emitTeams
    };

    componentConfig.methods.onTeamColorTap.call(ctx, {
      currentTarget: {
        dataset: {
          index: 0
        }
      }
    });

    expect(triggerEvent).toHaveBeenCalledWith('change', {
      teams: [
        {
          teamName: 'White',
          maxMembers: 8,
          colorKey: 'white'
        }
      ]
    });
  });

  test('assigns the next default color when adding a team', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      properties: {
        teams: [
          {
            teamName: 'Team 1',
            maxMembers: 8,
            colorKey: 'green'
          }
        ],
        labels: {
          teamNamePrefix: 'Team '
        }
      },
      triggerEvent,
      emitTeams: componentConfig.methods.emitTeams
    };

    componentConfig.methods.onAddTeam.call(ctx);

    expect(triggerEvent).toHaveBeenCalledWith('change', {
      teams: [
        {
          teamName: 'Team 1',
          maxMembers: 8,
          colorKey: 'green'
        },
        {
          teamName: 'Team 2',
          maxMembers: 8,
          colorKey: 'white'
        }
      ]
    });
  });

  test('does not remove the final remaining team', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      properties: {
        teams: [
          {
            teamName: 'White',
            maxMembers: 12
          }
        ]
      },
      triggerEvent
    };

    componentConfig.methods.onRemoveTeam.call(ctx, {
      currentTarget: {
        dataset: {
          index: 0
        }
      }
    });

    expect(triggerEvent).not.toHaveBeenCalled();
  });

  test('copies the previous team capacity when adding a team', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      properties: {
        teams: [
          {
            teamName: '队伍1',
            maxMembers: 8
          }
        ],
        labels: {
          teamNamePrefix: '队伍'
        }
      },
      triggerEvent,
      emitTeams: componentConfig.methods.emitTeams
    };

    componentConfig.methods.onAddTeam.call(ctx);

    expect(triggerEvent).toHaveBeenCalledWith('change', {
      teams: [
        {
          teamName: '队伍1',
          maxMembers: 8
        },
        {
          teamName: '队伍2',
          maxMembers: 8,
          colorKey: 'white'
        }
      ]
    });
  });
});

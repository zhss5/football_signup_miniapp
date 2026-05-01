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
});

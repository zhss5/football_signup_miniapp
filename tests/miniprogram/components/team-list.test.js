const fs = require('fs');
const path = require('path');

describe('team list component', () => {
  let componentConfig;

  beforeEach(() => {
    componentConfig = null;
    global.Component = jest.fn(config => {
      componentConfig = config;
    });

    jest.resetModules();
    require('../../../miniprogram/components/team-list/index');
  });

  test('renders team color editing controls only for editable teams', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/components/team-list/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{item.canEditColor}}"');
    expect(wxml).toContain('wx:else');
  });

  test('does not emit team color taps for non-editable teams', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      properties: {
        teams: [
          {
            _id: 'team_white',
            teamName: 'White',
            canEditColor: false
          }
        ]
      },
      triggerEvent
    };

    componentConfig.methods.onTeamColorTap.call(ctx, {
      currentTarget: {
        dataset: {
          teamId: 'team_white'
        }
      }
    });

    expect(triggerEvent).not.toHaveBeenCalled();
  });

  test('emits team color taps for editable teams', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      properties: {
        teams: [
          {
            _id: 'team_white',
            teamName: 'White',
            canEditColor: true
          }
        ]
      },
      triggerEvent
    };

    componentConfig.methods.onTeamColorTap.call(ctx, {
      currentTarget: {
        dataset: {
          teamId: 'team_white'
        }
      }
    });

    expect(triggerEvent).toHaveBeenCalledWith('teamcolortap', {
      teamId: 'team_white'
    });
  });
});

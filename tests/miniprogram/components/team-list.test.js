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

  test('renders attendance controls for member attendance actions', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/components/team-list/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{member.attendanceStatusVisible}}"');
    expect(wxml).toContain('wx:if="{{member.attendanceActionVisible}}"');
    expect(wxml).toContain('data-action="attendance"');
    expect(wxml).toContain('data-registration-id="{{member.registrationId}}"');
    expect(wxml).toContain('data-attendance-status="{{member.attendanceActionStatus}}"');
  });

  test('renders manager alias text and edit action for prepared member view models', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/components/team-list/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{member.managerAliasVisible}}"');
    expect(wxml).toContain('{{member.managerAliasText}}');
    expect(wxml).toContain('wx:if="{{member.managerAliasActionVisible}}"');
    expect(wxml).toContain('data-action="managerAlias"');
    expect(wxml).toContain('data-manager-alias="{{member.managerAliasText}}"');
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

  test('emits attendance changes with registration id and target status', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      triggerEvent
    };

    componentConfig.methods.onMemberActionTap.call(ctx, {
      currentTarget: {
        dataset: {
          action: 'attendance',
          registrationId: 'registration_1',
          attendanceStatus: 'absent',
          userOpenId: 'openid_player',
          signupName: 'Alex'
        }
      }
    });

    expect(triggerEvent).toHaveBeenCalledWith('attendancechange', {
      registrationId: 'registration_1',
      attendanceStatus: 'absent',
      userOpenId: 'openid_player',
      signupName: 'Alex'
    });
  });

  test('emits manager alias edits with current alias', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      triggerEvent
    };

    componentConfig.methods.onMemberActionTap.call(ctx, {
      currentTarget: {
        dataset: {
          action: 'managerAlias',
          userOpenId: 'openid_player',
          signupName: 'Alex',
          managerAlias: 'Zhang San'
        }
      }
    });

    expect(triggerEvent).toHaveBeenCalledWith('manageraliasedit', {
      userOpenId: 'openid_player',
      signupName: 'Alex',
      managerAlias: 'Zhang San'
    });
  });
});

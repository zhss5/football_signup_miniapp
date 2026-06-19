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

  test('passes attendance controls through member profile taps', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/components/team-list/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('data-registration-id="{{member.registrationId}}"');
    expect(wxml).toContain('data-attendance-status="{{member.attendanceStatus}}"');
    expect(wxml).toContain('data-attendance-status-text="{{member.attendanceStatusText}}"');
    expect(wxml).toContain('data-attendance-action-visible="{{member.attendanceActionVisible}}"');
    expect(wxml).toContain('data-attendance-action-status="{{member.attendanceActionStatus}}"');
    expect(wxml).toContain('data-attendance-action-text="{{member.attendanceActionText}}"');
    expect(wxml).not.toContain('data-action="attendance"');
    expect(wxml).not.toContain('class="member-attendance-status');
  });

  test('renders absent members with muted strike-through name and muted position', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/components/team-list/index.wxml'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/components/team-list/index.wxss'),
      'utf8'
    );

    expect(wxml).toContain(
      "class=\"member-name {{member.attendanceStatus === 'absent' ? 'member-name-absent' : ''}}\""
    );
    expect(wxml).toContain(
      "class=\"member-position-text {{member.attendanceStatus === 'absent' ? 'member-position-absent' : ''}}\""
    );
    expect(wxss).toContain('.member-name-absent');
    expect(wxss).toContain('text-decoration: line-through;');
    expect(wxss).toContain('.member-position-absent');
    expect(wxss).not.toContain('.member-attendance-absent');
    expect(wxss).not.toContain('.member-attendance-present');
    expect(wxss).not.toContain('.member-row-absent');
  });

  test('renders manager alias text inside a clickable member profile without a separate alias button', () => {
    const wxml = fs.readFileSync(
      path.join(process.cwd(), 'miniprogram/components/team-list/index.wxml'),
      'utf8'
    );
    const nameRowStart = wxml.indexOf('<view class="member-name-row">');
    const positionStart = wxml.indexOf('member-position-text', nameRowStart);
    const nameRowBlock = nameRowStart >= 0 && positionStart > nameRowStart
      ? wxml.slice(nameRowStart, positionStart)
      : '';

    expect(wxml).toContain('wx:if="{{member.managerAliasVisible}}"');
    expect(nameRowBlock).toContain('（{{member.managerAliasText}}）');
    expect(wxml).not.toContain('class="member-manager-alias"');
    expect(wxml).toContain('class="member-profile"');
    expect(wxml).toContain('bindtap="onMemberTap"');
    expect(wxml).toContain('data-manager-alias-editable="{{member.managerAliasActionVisible}}"');
    expect(wxml).not.toContain('class="member-action-button member-action-alias"');
    expect(wxml).not.toContain('data-action="managerAlias"');
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

  test('does not emit attendance changes from row actions', () => {
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

    expect(triggerEvent).not.toHaveBeenCalled();
  });

  test('emits member taps with display details and manager alias edit permission', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      triggerEvent
    };

    componentConfig.methods.onMemberTap.call(ctx, {
      currentTarget: {
        dataset: {
          userOpenId: 'openid_player',
          signupName: 'Alex',
          avatarUrl: 'https://example.com/avatar.jpg',
          avatarText: 'A',
          managerAlias: 'Zhang San',
          managerAliasEditable: true,
          registrationId: 'registration_1',
          attendanceStatus: 'present',
          attendanceStatusText: 'Present',
          attendanceActionVisible: true,
          attendanceActionStatus: 'absent',
          attendanceActionText: 'Mark absent'
        }
      }
    });

    expect(triggerEvent).toHaveBeenCalledWith('membertap', {
      userOpenId: 'openid_player',
      signupName: 'Alex',
      avatarUrl: 'https://example.com/avatar.jpg',
      avatarText: 'A',
      managerAliasEditable: true,
      managerAlias: 'Zhang San',
      registrationId: 'registration_1',
      attendanceStatus: 'present',
      attendanceStatusText: 'Present',
      attendanceActionVisible: true,
      attendanceActionStatus: 'absent',
      attendanceActionText: 'Mark absent'
    });
  });
});

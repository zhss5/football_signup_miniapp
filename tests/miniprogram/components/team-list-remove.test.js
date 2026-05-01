const fs = require('fs');
const path = require('path');

describe('team-list member removal', () => {
  let componentConfig;

  beforeEach(() => {
    componentConfig = null;
    global.Component = jest.fn(config => {
      componentConfig = config;
    });

    jest.resetModules();
    require('../../../miniprogram/components/team-list/index');
  });

  test('renders row-level member action controls', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-list/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{member.memberAction}}"');
    expect(wxml).toContain('catchtap="onMemberActionTap"');
  });

  test('renders manager proxy signup controls for teams that allow it', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-list/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{item.canProxySignup}}"');
    expect(wxml).toContain('bindtap="onProxySignupTap"');
  });

  test('renders proxy member badge only from the prepared member view model flag', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-list/index.wxml'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-list/index.wxss'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{member.proxyBadgeVisible}}"');
    expect(wxml).toContain('{{member.proxyBadgeText}}');
    expect(wxss).toContain('.member-proxy-badge');
  });

  test('renders manager move member controls', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-list/index.wxml'),
      'utf8'
    );

    expect(wxml).toContain('wx:if="{{member.moveActionVisible}}"');
    expect(wxml).toContain('data-action="move"');
    expect(wxml).toContain('data-current-team-id="{{item._id}}"');
  });

  test('uses a distinct visual style for self cancel signup and manager removal', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-list/index.wxml'),
      'utf8'
    );
    const wxss = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-list/index.wxss'),
      'utf8'
    );

    expect(wxml).toContain("member.memberAction === 'cancelSignup' ? 'member-action-cancel'");
    expect(wxml).toContain("member.memberAction === 'remove' ? 'member-action-danger'");
    expect(wxss).toContain('.member-action-cancel');
    expect(wxss).toContain('.member-action-danger');
  });

  test('emits remove member identity when a manager taps remove', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      triggerEvent
    };

    componentConfig.methods.onMemberActionTap.call(ctx, {
      currentTarget: {
        dataset: {
          action: 'remove',
          userOpenId: 'openid_player',
          signupName: 'Alex'
        }
      }
    });

    expect(triggerEvent).toHaveBeenCalledWith('removemember', {
      userOpenId: 'openid_player',
      signupName: 'Alex'
    });
  });

  test('emits move member identity when a manager taps move', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      triggerEvent
    };

    componentConfig.methods.onMemberActionTap.call(ctx, {
      currentTarget: {
        dataset: {
          action: 'move',
          userOpenId: 'openid_player',
          signupName: 'Alex',
          currentTeamId: 'team_white'
        }
      }
    });

    expect(triggerEvent).toHaveBeenCalledWith('movemember', {
      userOpenId: 'openid_player',
      signupName: 'Alex',
      currentTeamId: 'team_white'
    });
  });

  test('emits cancel signup when the current user taps their own member action', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      triggerEvent
    };

    componentConfig.methods.onMemberActionTap.call(ctx, {
      currentTarget: {
        dataset: {
          action: 'cancelSignup',
          userOpenId: 'openid_self',
          signupName: 'Alex'
        }
      }
    });

    expect(triggerEvent).toHaveBeenCalledWith('cancelsignup', {
      userOpenId: 'openid_self',
      signupName: 'Alex'
    });
  });

  test('emits proxy signup team identity when a manager taps add participant', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      triggerEvent
    };

    componentConfig.methods.onProxySignupTap.call(ctx, {
      currentTarget: {
        dataset: {
          teamId: 'team_white',
          teamName: 'White'
        }
      }
    });

    expect(triggerEvent).toHaveBeenCalledWith('proxysignup', {
      teamId: 'team_white',
      teamName: 'White'
    });
  });
});

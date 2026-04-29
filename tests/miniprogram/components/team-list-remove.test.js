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

  test('renders remove member controls only for managers', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../../miniprogram/components/team-list/index.wxml'),
      'utf8'
    );

    expect(componentConfig.properties.canManageRegistrations).toBeDefined();
    expect(wxml).toContain('wx:if="{{canManageRegistrations}}"');
    expect(wxml).toContain('catchtap="onRemoveMemberTap"');
  });

  test('emits member identity when a manager taps remove', () => {
    const triggerEvent = jest.fn();
    const ctx = {
      triggerEvent
    };

    componentConfig.methods.onRemoveMemberTap.call(ctx, {
      currentTarget: {
        dataset: {
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
});

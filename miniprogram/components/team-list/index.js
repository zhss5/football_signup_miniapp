function parseDatasetBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

Component({
  properties: {
    teams: {
      type: Array,
      value: []
    },
    emptyText: {
      type: String,
      value: 'No players yet'
    }
  },

  methods: {
    onJoinTap(event) {
      const teamId = event.currentTarget.dataset.teamId;
      const targetTeam = this.properties.teams.find(item => item._id === teamId);

      if (!targetTeam || targetTeam.joinDisabled) {
        return;
      }

      this.triggerEvent('jointap', {
        teamId
      });
    },

    onProxySignupTap(event) {
      const dataset = event.currentTarget.dataset;

      this.triggerEvent('proxysignup', {
        teamId: dataset.teamId,
        teamName: dataset.teamName
      });
    },

    onTeamColorTap(event) {
      const teamId = event.currentTarget.dataset.teamId;
      const targetTeam = this.properties.teams.find(item => item._id === teamId);

      if (!targetTeam || !targetTeam.canEditColor) {
        return;
      }

      this.triggerEvent('teamcolortap', {
        teamId
      });
    },

    onMemberActionTap(event) {
      const dataset = event.currentTarget.dataset;
      const eventNameByAction = {
        cancelSignup: 'cancelsignup',
        move: 'movemember',
        remove: 'removemember'
      };
      const eventName = eventNameByAction[dataset.action];

      if (!eventName) {
        return;
      }

      const detail = {
        userOpenId: dataset.userOpenId,
        signupName: dataset.signupName
      };

      if (dataset.action === 'move') {
        detail.currentTeamId = dataset.currentTeamId;
      }

      this.triggerEvent(eventName, detail);
    },

    onMemberTap(event) {
      const dataset = event.currentTarget.dataset;
      const managerAliasEditable = parseDatasetBoolean(dataset.managerAliasEditable);
      const attendanceActionVisible = parseDatasetBoolean(dataset.attendanceActionVisible);
      const selfProfileEditVisible = parseDatasetBoolean(dataset.selfProfileEditVisible);

      this.triggerEvent('membertap', {
        userOpenId: dataset.userOpenId || '',
        signupName: dataset.signupName || '',
        avatarUrl: dataset.avatarUrl || '',
        avatarText: dataset.avatarText || '',
        managerAlias: dataset.managerAlias || '',
        managerAliasEditable,
        registrationId: dataset.registrationId || '',
        attendanceStatus: dataset.attendanceStatus || '',
        attendanceStatusText: dataset.attendanceStatusText || '',
        attendanceActionVisible,
        attendanceActionStatus: dataset.attendanceActionStatus || '',
        attendanceActionText: dataset.attendanceActionText || '',
        selfProfileEditVisible
      });
    }
  }
});

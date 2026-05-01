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
    }
  }
});

Component({
  properties: {
    teams: {
      type: Array,
      value: []
    },
    emptyText: {
      type: String,
      value: 'No players yet'
    },
    removeMemberText: {
      type: String,
      value: 'Remove'
    },
    canManageRegistrations: {
      type: Boolean,
      value: false
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

    onRemoveMemberTap(event) {
      const dataset = event.currentTarget.dataset;

      this.triggerEvent('removemember', {
        userOpenId: dataset.userOpenId,
        signupName: dataset.signupName
      });
    }
  }
});

Component({
  properties: {
    teams: {
      type: Array,
      value: []
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
    }
  }
});

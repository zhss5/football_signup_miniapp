const { MAX_TEAMS } = require('../../utils/constants');

function buildDefaultTeam(index) {
  return {
    teamName: `Team ${index + 1}`,
    maxMembers: 0
  };
}

Component({
  properties: {
    teams: {
      type: Array,
      value: []
    },
    labels: {
      type: Object,
      value: {}
    }
  },

  methods: {
    emitTeams(teams) {
      this.triggerEvent('change', { teams });
    },

    onTeamFieldInput(event) {
      const index = Number(event.currentTarget.dataset.index);
      const field = event.currentTarget.dataset.field;
      const value = event.detail.value;
      const teams = this.properties.teams.map((team, currentIndex) => {
        if (currentIndex !== index) {
          return team;
        }

        return {
          ...team,
          [field]: field === 'maxMembers' ? Number(value) || 0 : value
        };
      });

      this.emitTeams(teams);
    },

    onAddTeam() {
      if (this.properties.teams.length >= MAX_TEAMS) {
        wx.showToast({
          title: this.properties.labels.upToTeams || `Up to ${MAX_TEAMS} teams`,
          icon: 'none'
        });
        return;
      }

      const prefix = this.properties.labels.teamNamePrefix || 'Team';
      const teams = [
        ...this.properties.teams,
        {
          ...buildDefaultTeam(this.properties.teams.length),
          teamName: `${prefix} ${this.properties.teams.length + 1}`
        }
      ];
      this.emitTeams(teams);
    },

    onRemoveTeam(event) {
      if (this.properties.teams.length <= 1) {
        return;
      }

      const index = Number(event.currentTarget.dataset.index);
      const teams = this.properties.teams.filter((team, currentIndex) => currentIndex !== index);
      this.emitTeams(teams);
    }
  }
});

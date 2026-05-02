const { MAX_TEAMS } = require('../../utils/constants');

function buildDefaultTeam(index, maxMembers = 0) {
  return {
    teamName: `Team ${index + 1}`,
    maxMembers
  };
}

function getPreviousTeamCapacity(teams) {
  const previousTeam = teams[teams.length - 1];
  return previousTeam ? Number(previousTeam.maxMembers) || 0 : 0;
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

      const prefix = this.properties.labels.teamNamePrefix || '';
      const previousCapacity = getPreviousTeamCapacity(this.properties.teams);
      const defaultTeam = buildDefaultTeam(this.properties.teams.length, previousCapacity);
      const teams = [
        ...this.properties.teams,
        {
          ...defaultTeam,
          teamName: prefix ? `${prefix}${this.properties.teams.length + 1}` : defaultTeam.teamName
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

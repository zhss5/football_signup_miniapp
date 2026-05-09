const { MAX_TEAMS } = require('../../utils/constants');
const { TEAM_COLOR_OPTIONS, normalizeTeamColorKey } = require('../../utils/team-colors');

function buildColorLabels(labels = {}) {
  if (
    Array.isArray(labels.colorOptions) &&
    labels.colorOptions.length === TEAM_COLOR_OPTIONS.length
  ) {
    return labels.colorOptions;
  }

  return TEAM_COLOR_OPTIONS.map(option => option.key);
}

function chooseColorIndex(itemList, fallbackIndex) {
  return new Promise(resolve => {
    if (typeof wx === 'undefined' || typeof wx.showActionSheet !== 'function') {
      resolve(fallbackIndex);
      return;
    }

    wx.showActionSheet({
      itemList,
      success: result => resolve(Number(result.tapIndex)),
      fail: () => resolve(-1)
    });
  });
}

function buildDefaultTeam(index, maxMembers = 0) {
  return {
    teamName: `Team ${index + 1}`,
    maxMembers,
    colorKey: normalizeTeamColorKey('', index)
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

    async onTeamColorTap(event) {
      const index = Number(event.currentTarget.dataset.index);
      const currentTeam = this.properties.teams[index];

      if (!currentTeam) {
        return;
      }

      const currentKey = normalizeTeamColorKey(currentTeam.colorKey, index);
      const currentOptionIndex = TEAM_COLOR_OPTIONS.findIndex(item => item.key === currentKey);
      const fallbackIndex = (currentOptionIndex + 1) % TEAM_COLOR_OPTIONS.length;
      const selectedIndex = await chooseColorIndex(
        buildColorLabels(this.properties.labels),
        fallbackIndex
      );
      const selectedOption = TEAM_COLOR_OPTIONS[selectedIndex];

      if (!selectedOption) {
        return;
      }

      const teams = this.properties.teams.map((team, currentIndex) =>
        currentIndex === index
          ? {
              ...team,
              colorKey: selectedOption.key
            }
          : team
      );

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

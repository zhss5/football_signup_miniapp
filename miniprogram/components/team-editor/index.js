Component({
  properties: {
    teams: {
      type: Array,
      value: []
    }
  },

  methods: {
    onTeamFieldInput(event) {
      const index = event.currentTarget.dataset.index;
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

      this.triggerEvent('change', { teams });
    }
  }
});

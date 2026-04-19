Component({
  properties: {
    teams: {
      type: Array,
      value: []
    }
  },

  methods: {
    onJoinTap(event) {
      this.triggerEvent('jointap', {
        teamId: event.currentTarget.dataset.teamId
      });
    }
  }
});

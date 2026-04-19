const { listActivities } = require('../../services/activity-service');
const { buildActivityCardVm } = require('../../utils/formatters');

Page({
  data: {
    createdItems: [],
    joinedItems: []
  },

  async onShow() {
    const [created, joined] = await Promise.all([
      listActivities({ scope: 'created', limit: 20 }),
      listActivities({ scope: 'joined', limit: 20 })
    ]);

    this.setData({
      createdItems: created.items.map(buildActivityCardVm),
      joinedItems: joined.items.map(buildActivityCardVm)
    });
  }
});

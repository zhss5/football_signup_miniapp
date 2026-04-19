const { getActivityDetail } = require('../../services/activity-service');
const { joinActivity, cancelRegistration } = require('../../services/registration-service');

Page({
  data: {
    activityId: '',
    activity: null,
    teams: [],
    myRegistration: null,
    signupVisible: false,
    pendingTeamId: ''
  },

  async onLoad(query) {
    this.setData({ activityId: query.activityId });
    await this.reload();
  },

  async reload() {
    const detail = await getActivityDetail(this.data.activityId);
    this.setData(detail);
  },

  openSignup(event) {
    this.setData({
      signupVisible: true,
      pendingTeamId: event.detail.teamId
    });
  },

  async submitSignup(event) {
    const detail = event.detail;
    await joinActivity({
      activityId: this.data.activityId,
      teamId: this.data.pendingTeamId,
      signupName: detail.signupName,
      phone: detail.phone || '',
      source: 'share'
    });

    this.setData({
      signupVisible: false,
      pendingTeamId: ''
    });

    await this.reload();
  },

  async onCancelSignup() {
    await cancelRegistration(this.data.activityId);
    await this.reload();
  },

  onCloseSignup() {
    this.setData({
      signupVisible: false,
      pendingTeamId: ''
    });
  },

  onShareAppMessage() {
    return {
      title: this.data.activity ? this.data.activity.title : 'Football Signup',
      path: `/pages/activity-detail/index?activityId=${this.data.activityId}`
    };
  }
});

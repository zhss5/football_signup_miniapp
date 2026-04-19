const { getActivityDetail, cancelActivity } = require('../../services/activity-service');
const { joinActivity, cancelRegistration } = require('../../services/registration-service');
const { buildTeamListVm } = require('../../utils/formatters');

Page({
  data: {
    activityId: '',
    activity: null,
    teams: [],
    myRegistration: null,
    viewer: null,
    signupVisible: false,
    pendingTeamId: '',
    pendingTeamName: ''
  },

  async onLoad(query) {
    this.setData({ activityId: query.activityId });
    await this.reload();
  },

  async reload() {
    const detail = await getActivityDetail(this.data.activityId);
    this.setData({
      ...detail,
      teams: buildTeamListVm(detail.teams, detail.myRegistration, detail.activity)
    });
  },

  openSignup(event) {
    const selectedTeam = this.data.teams.find(team => team._id === event.detail.teamId);
    if (!selectedTeam || selectedTeam.joinDisabled) {
      return;
    }

    this.setData({
      signupVisible: true,
      pendingTeamId: event.detail.teamId,
      pendingTeamName: selectedTeam.teamName
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
      pendingTeamId: '',
      pendingTeamName: ''
    });

    await this.reload();
  },

  async onCancelSignup() {
    try {
      await cancelRegistration(this.data.activityId);
      await this.reload();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },

  async onCancelActivity() {
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: 'Cancel Activity',
        content: 'This will stop new signups and mark the activity as cancelled.',
        success: result => resolve(Boolean(result.confirm))
      });
    });

    if (!confirmed) {
      return;
    }

    try {
      await cancelActivity(this.data.activityId);
      await this.reload();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },

  onOpenLocation() {
    const activity = this.data.activity;
    const location = activity && activity.location;

    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      wx.showToast({ title: 'Location pin not available', icon: 'none' });
      return;
    }

    wx.openLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      name: activity.addressName || activity.addressText,
      address: activity.addressText,
      scale: 16
    });
  },

  onCloseSignup() {
    this.setData({
      signupVisible: false,
      pendingTeamId: '',
      pendingTeamName: ''
    });
  },

  onShareAppMessage() {
    return {
      title: this.data.activity ? this.data.activity.title : 'Football Signup',
      path: `/pages/activity-detail/index?activityId=${this.data.activityId}`
    };
  }
});

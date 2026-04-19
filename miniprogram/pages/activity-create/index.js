const { createActivity } = require('../../services/activity-service');
const { validateActivityDraft } = require('../../utils/validators');

Page({
  data: {
    form: {
      title: '',
      startAt: '',
      endAt: '',
      addressText: '',
      description: '',
      coverImage: '',
      signupLimitTotal: 12,
      requirePhone: false,
      inviteCode: '',
      teams: [
        { teamName: 'White', maxMembers: 6 },
        { teamName: 'Red', maxMembers: 6 }
      ]
    },
    submitting: false
  },

  async onSubmit() {
    try {
      validateActivityDraft(this.data.form);
      this.setData({ submitting: true });
      const { activityId } = await createActivity(this.data.form);
      wx.redirectTo({ url: `/pages/activity-detail/index?activityId=${activityId}` });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});

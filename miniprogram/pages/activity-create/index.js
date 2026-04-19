const { createActivity } = require('../../services/activity-service');
const { validateActivityDraft } = require('../../utils/validators');

function createDefaultForm() {
  return {
    title: '',
    startAt: '2026-04-26T20:00:00.000Z',
    endAt: '2026-04-26T22:00:00.000Z',
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
  };
}

Page({
  data: {
    form: createDefaultForm(),
    submitting: false
  },

  onFieldInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    this.setData({
      [`form.${field}`]: field === 'signupLimitTotal' ? Number(value) || 0 : value
    });
  },

  onRequirePhoneChange(event) {
    this.setData({
      'form.requirePhone': event.detail.value
    });
  },

  onTeamsChange(event) {
    this.setData({
      'form.teams': event.detail.teams
    });
  },

  async onSubmit() {
    try {
      validateActivityDraft(this.data.form);
      this.setData({ submitting: true });
      const { activityId } = await createActivity(this.data.form);
      wx.redirectTo({ url: `/pages/activity-detail/index?activityId=${activityId}` });
      this.setData({ form: createDefaultForm() });
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    teamName: {
      type: String,
      value: ''
    }
  },

  data: {
    signupName: ''
  },

  methods: {
    onNameInput(event) {
      this.setData({ signupName: event.detail.value });
    },

    submit() {
      if (!this.data.signupName.trim()) {
        wx.showToast({ title: 'Signup name is required', icon: 'none' });
        return;
      }

      this.triggerEvent('submit', {
        signupName: this.data.signupName
      });
    },

    close() {
      this.setData({
        signupName: ''
      });
      this.triggerEvent('close');
    }
  }
});

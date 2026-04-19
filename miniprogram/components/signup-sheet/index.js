Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    requirePhone: {
      type: Boolean,
      value: false
    }
  },

  data: {
    signupName: '',
    phone: ''
  },

  methods: {
    onNameInput(event) {
      this.setData({ signupName: event.detail.value });
    },

    onPhoneInput(event) {
      this.setData({ phone: event.detail.value });
    },

    submit() {
      if (!this.data.signupName.trim()) {
        wx.showToast({ title: 'Signup name is required', icon: 'none' });
        return;
      }

      if (this.properties.requirePhone && !this.data.phone.trim()) {
        wx.showToast({ title: 'Phone is required', icon: 'none' });
        return;
      }

      this.triggerEvent('submit', {
        signupName: this.data.signupName,
        phone: this.data.phone
      });
    },

    close() {
      this.setData({
        signupName: '',
        phone: ''
      });
      this.triggerEvent('close');
    }
  }
});

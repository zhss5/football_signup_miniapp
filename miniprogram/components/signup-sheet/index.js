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
      this.triggerEvent('submit', {
        signupName: this.data.signupName,
        phone: this.data.phone
      });
    },

    close() {
      this.triggerEvent('close');
    }
  }
});

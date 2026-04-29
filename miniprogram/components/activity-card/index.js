Component({
  properties: {
    item: {
      type: Object,
      value: null,
      observer() {
        this.setData({ coverLoadFailed: false });
      }
    },
    embedded: {
      type: Boolean,
      value: false
    }
  },

  data: {
    coverLoadFailed: false
  },

  methods: {
    onCoverError() {
      this.setData({ coverLoadFailed: true });
    },

    onTap() {
      this.triggerEvent('tapcard', { id: this.properties.item._id });
    }
  }
});

Component({
  properties: {
    item: {
      type: Object,
      value: null
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('tapcard', { id: this.properties.item._id });
    }
  }
});

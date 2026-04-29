Component({
  properties: {
    item: {
      type: Object,
      value: null
    },
    embedded: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('tapcard', { id: this.properties.item._id });
    }
  }
});

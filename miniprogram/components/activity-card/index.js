function buildCoverCandidates(item = {}) {
  if (Array.isArray(item.coverImageSources) && item.coverImageSources.length > 0) {
    return item.coverImageSources.filter(Boolean);
  }

  return [item.coverDisplayImage].filter(Boolean);
}

Component({
  properties: {
    item: {
      type: Object,
      value: null,
      observer(item) {
        const coverCandidates = buildCoverCandidates(item || {});
        this.setData({
          activeCoverImage: coverCandidates[0] || '',
          coverCandidates,
          coverLoadFailed: false,
          coverSourceIndex: 0
        });
      }
    },
    embedded: {
      type: Boolean,
      value: false
    }
  },

  data: {
    activeCoverImage: '',
    coverCandidates: [],
    coverSourceIndex: 0,
    coverLoadFailed: false
  },

  methods: {
    onCoverError() {
      const nextIndex = this.data.coverSourceIndex + 1;
      const nextCoverImage = this.data.coverCandidates[nextIndex] || '';

      if (nextCoverImage) {
        this.setData({
          activeCoverImage: nextCoverImage,
          coverSourceIndex: nextIndex
        });
        return;
      }

      this.setData({ coverLoadFailed: true });
    },

    onTap() {
      this.triggerEvent('tapcard', { id: this.properties.item._id });
    }
  }
});

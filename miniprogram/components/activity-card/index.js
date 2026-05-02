const { downloadFile } = require('../../services/cloud');

function buildCoverCandidates(item = {}) {
  if (Array.isArray(item.coverImageSources) && item.coverImageSources.length > 0) {
    return item.coverImageSources.filter(Boolean);
  }

  return [item.coverDisplayImage].filter(Boolean);
}

function isCloudFileId(value) {
  return typeof value === 'string' && value.startsWith('cloud://');
}

async function resolveCoverCandidate(candidate) {
  if (!isCloudFileId(candidate)) {
    return candidate || '';
  }

  const tempFilePath = await downloadFile(candidate).catch(() => '');
  return tempFilePath || candidate;
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
    async onCoverError() {
      const nextIndex = this.data.coverSourceIndex + 1;
      const nextCoverImage = this.data.coverCandidates[nextIndex] || '';

      if (nextCoverImage) {
        const resolvedCoverImage = await resolveCoverCandidate(nextCoverImage);

        if (!resolvedCoverImage) {
          this.setData({
            coverSourceIndex: nextIndex
          });
          this.onCoverError();
          return;
        }

        this.setData({
          activeCoverImage: resolvedCoverImage,
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

Page({
  data: {
    url: ''
  },

  onLoad(query = {}) {
    const url = query.url ? decodeURIComponent(query.url) : '';
    this.setData({ url });
  }
});

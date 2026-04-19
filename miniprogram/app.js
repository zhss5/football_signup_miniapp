App({
  onLaunch() {
    if (!wx.cloud) {
      throw new Error('Cloud capability is required');
    }

    wx.cloud.init({
      traceUser: true
    });
  }
});

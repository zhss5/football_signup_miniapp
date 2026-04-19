function call(name, data = {}) {
  return wx.cloud.callFunction({
    name,
    data
  }).then(res => res.result);
}

module.exports = {
  call
};

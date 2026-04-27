function resolveOpenId(context, getWXContext) {
  if (context && context.OPENID) {
    return context.OPENID;
  }

  const wxContext = typeof getWXContext === 'function' ? getWXContext() : {};

  if (!wxContext || !wxContext.OPENID) {
    throw new Error('OPENID is required');
  }

  return wxContext.OPENID;
}

module.exports = {
  resolveOpenId
};

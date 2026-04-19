function nowIso(now = new Date()) {
  return typeof now === 'string' ? now : now.toISOString();
}

module.exports = {
  nowIso
};

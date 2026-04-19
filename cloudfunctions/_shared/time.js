function nowIso(now = new Date()) {
  const resolved = typeof now === 'function' ? now() : now;
  return typeof resolved === 'string' ? resolved : resolved.toISOString();
}

module.exports = {
  nowIso
};

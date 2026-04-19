function businessError(message) {
  const error = new Error(message);
  error.name = 'BusinessError';
  return error;
}

module.exports = {
  businessError
};

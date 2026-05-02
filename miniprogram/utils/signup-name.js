const MAX_SIGNUP_NAME_LENGTH = 16;

function normalizeSignupName(value) {
  const normalizedWhitespace = String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return Array.from(normalizedWhitespace).slice(0, MAX_SIGNUP_NAME_LENGTH).join('');
}

module.exports = {
  MAX_SIGNUP_NAME_LENGTH,
  normalizeSignupName
};

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [0, 'always', Infinity],
    'footer-max-line-length': [0, 'always', Infinity],
    'subject-case': [0],
    'header-max-length': [2, 'always', 120],
  },
};

module.exports = {
  extends: 'airbnb',
  rules: {
    'import/extensions': 0,
    'jsx-a11y/no-noninteractive-element-interactions': 0,
    'no-bitwise': 0,
    'no-continue': 0,
    'no-use-before-define': 0,
    'no-eval': 0,
    'no-restricted-syntax': 0,
    'no-mixed-operators': 0,
    'no-plusplus': 0,
    'react/jsx-filename-extension': 0,
    'react/prop-types': 0,
    'jsx-a11y/no-static-element-interactions': 0,
    'jsx-a11y/click-events-have-key-events': 0,
    'object-curly-newline': [
      'error',
      {
        consistent: true,
      },
    ],
  },
  env: {
    jasmine: true,
  },
};

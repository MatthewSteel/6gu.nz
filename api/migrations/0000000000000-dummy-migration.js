'use strict';

// const { query } = require('../src/db');

module.exports.description = 'Dummy migration';

module.exports.up = async () => {};

module.exports.down = (next) => {
  next();
};

'use strict';

const { Pool } = require('pg');

const pool = new Pool();
const query = pool.query.bind(pool);

module.exports = { pool, query };

'use strict';

const { query } = require('../src/db');
const fs = require('fs');

module.exports.up = async () => {
  // Something like:
  // pg_dump --quote-all-identifiers --schema-only -n public
  //       -wh localhost -U sheets_user_dev sheets_db_dev >
  //        src/sql/initial_db.sql
  const initialState = fs.readFileSync('src/sql/initial_db.sql', 'utf8');
  await query(initialState);
};

module.exports.down = async () => {
  const dropQueries = await query(`
    SELECT
      'DROP TABLE IF EXISTS "' || tablename || '" CASCADE;' AS q
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename != 'migrations';
  `);
  const bigQuery = dropQueries.rows.map(({ q }) => q).join('\n');
  await query(bigQuery);
};

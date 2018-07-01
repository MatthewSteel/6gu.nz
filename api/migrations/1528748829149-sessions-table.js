'use strict';

const { query } = require('../src/db');

module.exports.up = async () => {
  await query(`
    CREATE TABLE public.session (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    )
    WITH (OIDS=FALSE);
    ALTER TABLE public.session
      ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      NOT DEFERRABLE INITIALLY IMMEDIATE;
  `);
};

module.exports.down = async () => {
  await query('DROP TABLE IF EXISTS "session";');
};

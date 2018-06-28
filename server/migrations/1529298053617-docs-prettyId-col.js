'use strict';

const { query } = require('../src/db');

module.exports.up = async () => {
  await query(`
    ALTER TABLE public.documents
    ADD COLUMN "prettyId" CHARACTER VARYING(16) NOT NULL;

    CREATE UNIQUE INDEX "docs_prettyId_index" ON "public"."documents"
    USING "btree" ("prettyId");
  `);
};

module.exports.down = async () => {
  await query('ALTER TABLE public.documents DROP COLUMN "prettyId";');
};

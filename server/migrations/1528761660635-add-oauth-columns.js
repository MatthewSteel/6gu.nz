'use strict';

const { query } = require('../src/db');

module.exports.up = async () => {
  await query(`
    ALTER TABLE public.users
    ADD COLUMN providerName VARCHAR NOT NULL,
    ADD COLUMN providerUserId VARCHAR NOT NULL;

    CREATE UNIQUE INDEX user_provider_details_index
    ON public.users (providerName, providerUserId);
  `);
};

module.exports.down = async () => {
  await query(`
    ALTER TABLE public.users
    DROP COLUMN providerName,
    DROP COLUMN providerUserId;
  `);
};

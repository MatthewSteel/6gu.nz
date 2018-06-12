#!/bin/bash

set -o errexit
set -o nounset
set -o xtrace
set -o pipefail

psql -wh localhost postgres postgres -c "CREATE USER sheets_user_dev PASSWORD 'password'"
createdb -wh localhost -U postgres -O sheets_user_dev sheets_db_dev
psql -wh localhost sheets_db_dev postgres -c "CREATE EXTENSION IF NOT EXISTS pgcrypto"
cp .env.sample .env

yarn migrate up

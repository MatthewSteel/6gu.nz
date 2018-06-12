#!/bin/bash

set -o errexit
set -o nounset
set -o xtrace
set -o pipefail

dropdb -wh localhost -U postgres sheets_db_dev --if-exists
psql -wh localhost postgres postgres -c "DROP USER IF EXISTS sheets_user_dev"
rm -f .env
rm -f .migrate

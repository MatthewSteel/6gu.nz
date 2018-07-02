#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

direction=$1
shift
filename=${1:-}

if [[ "$direction" != "up" && "$direction" != "down" ]]; then
  echo "Direction must be 'up' or 'down'";
  exit 1;
fi


if [[ "$direction" == "down" && "$filename" != 1* ]]; then
  echo "Must supply a migration filename when migrating down";
  exit 1;
fi

docker service update \
  --env-add MIGRATE_DIRECTION="$direction" \
  --env-add MIGRATE_FILENAME="$filename" \
  --force \
  --with-registry-auth \
  svc_migrate

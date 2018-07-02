#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

service=$1

if [[ "$service" != "client" && "$service" != "api" ]]; then
  echo "Service must be 'client' or 'api'";
  exit 1;
fi

docker service update \
  --force \
  --with-registry-auth \
  --rollback \
  svc_$service

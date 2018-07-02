#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

export $(cat .env) && docker stack deploy \
  --compose-file docker-compose.yml \
  --with-registry-auth \
  svc

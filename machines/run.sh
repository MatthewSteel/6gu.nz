#!/bin/bash

command=$1
shift

cd "${0%/*}"
git pull

case "$command" in
  "deploy")
    ./deploy.sh "$@"
    ;;
  "revert")
    ./revert.sh "$@"
    ;;
  "migrate")
    ./migrate.sh "$@"
    ;;
  "everything")
    ./everything.sh "$@"
    ;;
  "bash")
    /bin/bash
    ;;
  *)
    echo "Command argument must be one of:"
    echo " - bash,"
    echo " - deploy,"
    echo " - revert,"
    echo " - migrate, or"
    echo " - everything."
    exit 1;
esac

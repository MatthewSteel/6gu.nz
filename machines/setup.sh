#!/bin/bash

# Installs docker and git, clones our repo and logs into our docker registry.
# Run via `server` in the top level directory.

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace


# Install git
apt-get update -qq
apt-get install -qq git

cat > /root/.ssh/config <<- EOM
ForwardAgent yes

Host git.6gu.nz-server
  Hostname git.6gu.nz
  User git
  IdentityFile /root/.ssh/git-key
EOM

cat > /root/.ssh/known_hosts <<- EOM
|1|cPFV5kgaOfk++Fwh4dUXWPGHenE=|jOLJJcBVP1ES5t13GsgutvH9suo= ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBJvoYTwmrO8NUYfdrhMyDo3+5A62VnWraSWSRlwwPZdXI3PduZ9Q5Aae6AIZaGBJSH96uaeN6YxnIrR/BWDTUnA=
|1|MMDJnjf7akyVeqlO405GMF8hJQ4=|txyez8GQEdknmR1OPRiBFS31qbE= ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCn5l2zK/reKnvJyPYOUAejaSvn6FAi3udpKH2vJ/dP1uuFNKhF7uZ/hvksnalyC7/Rb29Zfw+3PBe4OyyeFEQfoG7XZHAVxa20IhJoj/OUhMBydcLaw5jAQrzJGL/um/NI6W3Tk0l9A9ZhinrK1SgvldWDYqGtFAfTvoJhwbneVtdDEM0KeQHOsZNlSaJm1s5FUaw17VhF+NJaww1AsM4YdOs0sp6zy28QgblcDVCpmdA4e81YwMNhz7heBB/KTx1PsO7neavQxGT9INzy1wt2wjCulXWU4WuD9Ug/b50FXR7tojDdlky/oUF4QzPTRXCXkUt+i04HursDbBTajcXH
|1|VNHBnFlPv6lEcINlMCIAxz06iqY=|JTYf0Z5HHMYf5iRguLKik1cBy/k= ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIE3XritOjxO81IuRBdtO77LZ4VVV6aHu5KPLwbS1RV7o
EOM
git clone git@git.6gu.nz-server:o/6gu.git

# Install docker
apt-get -qq remove docker docker-engine docker.io

apt-get install -qq \
  apt-transport-https \
  ca-certificates \
  curl \
  software-properties-common

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -

set +o xtrace
echo "  !!! IMPORTANT !!! Panic if there is no fingerprint below"
echo "v------------------------------------------------------------v"
# apt-key complains if you try to pipe its output. Let's respect its wishes
# and not grep for 
apt-key fingerprint 0EBFCD88
echo "^------------------------------------------------------------^"
echo "  !!! IMPORTANT !!! Panic if there is no fingerprint above"
echo
echo "(Should be 9DC8 5822 9FC7 DD38 854A  E2D8 8D81 803C 0EBF CD88)"
set -o xtrace

add-apt-repository -y \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"

apt-get -qq update
apt-get -qq install docker-ce

docker login -u "$1" -p "$2" registry.6gu.nz

set +o xtrace
echo "Docker installed, everything is fine if the fingerprint appears"
echo "between the two dashed lines above."

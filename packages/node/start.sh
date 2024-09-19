#!/bin/sh
set -e

# check folder package exists
if [ -d "packages/cardano-ibc" ]; then
  cd "packages/cardano-ibc"
  # yarn install
  # yarn codegen
  # yarn build
else
  echo "Folder packages/cardano-ibc not found"
  exit 1
fi

cd ../node
yarn start:dev --multi-chain

#!/bin/sh
set -e

if [ ! -d node_modules/hardhat ]; then
  echo "📦 Installation des dépendances blockchain..."
  npm ci
fi

echo "⏳ Attente du noeud Hardhat..."
node /docker/scripts/wait-for-rpc.js

echo "🚀 Déploiement du contrat CrossBorderPayment..."
export HARDHAT_RPC_URL=http://blockchain:8545
npx hardhat run scripts/deploy.js --network localhost

if [ ! -f /shared/contract.env ]; then
  echo "❌ Adresse du contrat non générée"
  exit 1
fi

echo "✅ Contrat déployé:"
cat /shared/contract.env

#!/bin/sh
set -e

if [ ! -d node_modules/express ]; then
  echo "📦 Installation des dépendances backend..."
  npm ci
fi

SHOULD_RESTORE=0

if [ -f /shared/contract.env ]; then
  set -a
  . /shared/contract.env
  set +a
  echo "📄 Contrat utilisé: $CONTRACT_ADDRESS"
  if [ ! -f /shared/.restored ] || [ "$(cat /shared/.restored 2>/dev/null)" != "$CONTRACT_ADDRESS" ]; then
    SHOULD_RESTORE=1
  fi
fi

if [ "$SHOULD_RESTORE" = "0" ]; then
  BANK_COUNT=$(node -e "
const { Client } = require('pg');
const client = new Client({
  host: process.env.DB_HOST || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'crossborder-db',
  port: Number(process.env.DB_PORT || 5432),
});
client.connect()
  .then(() => client.query('SELECT COUNT(*)::int AS count FROM banks'))
  .then((res) => { console.log(res.rows[0].count); return client.end(); })
  .catch(() => { console.log('0'); process.exit(0); });
")
  if [ "$BANK_COUNT" = "0" ]; then
    echo "⚠️ Table banks vide — restauration requise"
    SHOULD_RESTORE=1
  fi
fi

echo "⏳ Attente de PostgreSQL..."
node -e "
const { Client } = require('pg');
const client = new Client({
  host: process.env.DB_HOST || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'crossborder-db',
  port: Number(process.env.DB_PORT || 5432),
});
(async () => {
  for (let i = 1; i <= 30; i++) {
    try {
      await client.connect();
      console.log('✅ PostgreSQL disponible');
      await client.end();
      process.exit(0);
    } catch {
      console.log('⏳ Attente PostgreSQL (' + i + '/30)...');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  process.exit(1);
})();
"

if [ "$SHOULD_RESTORE" = "1" ]; then
  echo "🔄 Restauration des données blockchain..."
  RPC_URL="${RPC_HTTP_URL:-http://blockchain:8545}" node scripts/restore.js
  echo "$CONTRACT_ADDRESS" > /shared/.restored
else
  echo "⏭️ Restauration ignorée (déjà effectuée pour ce contrat)"
fi

export RPC_URL="${RPC_WS_URL:-ws://blockchain:8545}"
export RPC_HTTP_URL="${RPC_HTTP_URL:-http://blockchain:8545}"
export DB_HOST="${DB_HOST:-postgres}"

echo "🚀 Démarrage du backend API (RPC: $RPC_URL)..."
exec node server.js

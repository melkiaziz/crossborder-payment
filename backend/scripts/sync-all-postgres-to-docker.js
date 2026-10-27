const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const SOURCE = {
  host: process.env.SOURCE_DB_HOST || 'host.docker.internal',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'crossborder-db',
  port: Number(process.env.SOURCE_DB_PORT || 5432),
};

const TARGET = {
  host: process.env.DB_HOST || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'crossborder-db',
  port: Number(process.env.DB_PORT || 5432),
};

// Ordre respectant les clés étrangères
const TABLES = [
  'rate_alerts',
  'rate_alert_history',
  'rate_history',
  'transactions',
  'pending_transfers',
  'blacklist_history',
  'banks',
  'employees',
];

async function getColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return rows.map((r) => r.column_name);
}

async function syncTable(source, target, table) {
  const sourceCols = await getColumns(source, table);
  const targetCols = await getColumns(target, table);
  const columns = sourceCols.filter((c) => targetCols.includes(c));

  if (columns.length === 0) {
    console.log(`⚠️ ${table}: aucune colonne commune, ignoré`);
    return 0;
  }

  const { rows } = await source.query(`SELECT * FROM ${table} ORDER BY id`);
  if (rows.length === 0) {
    console.log(`⏭️ ${table}: vide sur la source`);
    return 0;
  }

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updates = columns
    .filter((c) => c !== 'id')
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(', ');

  let copied = 0;
  for (const row of rows) {
    const values = columns.map((col) => row[col] ?? null);
    await target.query(
      `INSERT INTO ${table} (${columns.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT (id) DO UPDATE SET ${updates}`,
      values
    );
    copied++;
  }

  if (columns.includes('id')) {
    await target.query(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`
    );
  }

  console.log(`✅ ${table}: ${copied} ligne(s)`);
  return copied;
}

async function main() {
  const source = new Client(SOURCE);
  const target = new Client(TARGET);

  await source.connect();
  await target.connect();

  try {
    console.log('🔄 Synchronisation PostgreSQL locale → Docker\n');

    let total = 0;
    for (const table of TABLES) {
      total += await syncTable(source, target, table);
    }

    console.log(`\n🎉 Terminé — ${total} ligne(s) copiée(s) au total`);

    const summary = await target.query(`
      SELECT 'banks' AS table_name, COUNT(*)::int AS count FROM banks
      UNION ALL SELECT 'employees', COUNT(*)::int FROM employees
      UNION ALL SELECT 'transactions', COUNT(*)::int FROM transactions
      UNION ALL SELECT 'rate_history', COUNT(*)::int FROM rate_history
      UNION ALL SELECT 'pending_transfers', COUNT(*)::int FROM pending_transfers
      UNION ALL SELECT 'rate_alerts', COUNT(*)::int FROM rate_alerts
      UNION ALL SELECT 'rate_alert_history', COUNT(*)::int FROM rate_alert_history
      UNION ALL SELECT 'blacklist_history', COUNT(*)::int FROM blacklist_history
      ORDER BY table_name
    `);

    console.log('\n📊 État Docker:');
    for (const row of summary.rows) {
      console.log(`   ${row.table_name}: ${row.count}`);
    }
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((err) => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});

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

const COLUMNS = [
  'email',
  'password_hash',
  'employee_id',
  'full_name',
  'bank_wallet_address',
  'verification_token',
  'is_verified',
  'reset_token',
  'reset_token_expiry',
  'created_at',
];

async function main() {
  const source = new Client(SOURCE);
  const target = new Client(TARGET);

  await source.connect();
  await target.connect();

  try {
    const { rows } = await source.query('SELECT * FROM employees ORDER BY id');
    console.log(`📥 ${rows.length} employé(s) trouvé(s) sur PostgreSQL source`);

    if (rows.length === 0) {
      console.log('Rien à copier.');
      return;
    }

    let copied = 0;
    for (const row of rows) {
      const bankCheck = await target.query(
        'SELECT 1 FROM banks WHERE wallet_address = $1',
        [row.bank_wallet_address]
      );
      if (bankCheck.rows.length === 0) {
        console.log(`⚠️ Banque absente dans Docker pour ${row.email}: ${row.bank_wallet_address}`);
        continue;
      }

      const values = COLUMNS.map((col) => row[col] ?? null);
      await target.query(
        `INSERT INTO employees (${COLUMNS.join(', ')})
         VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(', ')})
         ON CONFLICT (email) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           employee_id = EXCLUDED.employee_id,
           full_name = EXCLUDED.full_name,
           bank_wallet_address = EXCLUDED.bank_wallet_address,
           verification_token = EXCLUDED.verification_token,
           is_verified = EXCLUDED.is_verified,
           reset_token = EXCLUDED.reset_token,
           reset_token_expiry = EXCLUDED.reset_token_expiry,
           created_at = EXCLUDED.created_at`,
        values
      );
      copied++;
      console.log(`✅ ${row.email}`);
    }

    const count = await target.query('SELECT COUNT(*)::int AS count FROM employees');
    console.log(`\n🎉 ${copied} employé(s) copié(s). Total Docker: ${count.rows[0].count}`);
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((err) => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});

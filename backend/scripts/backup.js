const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'crossborder_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function backup() {
  console.log("💾 Sauvegarde des données...");
  
  try {
    // Sauvegarder les banques
    const banks = await pool.query(`
      SELECT wallet_address, name, country, currency, balance 
      FROM banks 
      ORDER BY id
    `);
    
    fs.writeFileSync('./backup-banks.json', JSON.stringify(banks.rows, null, 2));
    console.log(`✅ ${banks.rows.length} banques sauvegardées`);
    
    // Sauvegarder les balances
    const balances = banks.rows.map(b => ({
      address: b.wallet_address,
      balance: b.balance
    }));
    fs.writeFileSync('./backup-balances.json', JSON.stringify(balances, null, 2));
    
    console.log("✅ Sauvegarde terminée !");
  } catch (err) {
    console.error("❌ Erreur sauvegarde:", err);
  } finally {
    await pool.end();
  }
}

backup();
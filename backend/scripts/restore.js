const { ethers } = require('ethers');
const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

async function syncBanksToPostgres(banks) {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'crossborder-db',
    port: Number(process.env.DB_PORT || 5432),
  });

  await client.connect();
  try {
    for (const bank of banks) {
      await client.query(
        `INSERT INTO banks (wallet_address, name, country, currency)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (wallet_address) DO UPDATE
         SET name = EXCLUDED.name, country = EXCLUDED.country, currency = EXCLUDED.currency`,
        [bank.wallet_address, bank.name, bank.country, bank.currency]
      );
    }
    console.log(`✅ ${banks.length} banque(s) synchronisée(s) dans PostgreSQL`);
  } finally {
    await client.end();
  }
}

async function restore() {
  console.log("🔄 Restauration des données sur la blockchain...");
  
  try {
    // Connexion à Hardhat
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:8545");
    const wallet = new ethers.Wallet(process.env.CENTRAL_BANK_PRIVATE_KEY, provider);
    
    // Récupérer le nonce actuel pour éviter les conflits
    let currentNonce = await provider.getTransactionCount(wallet.address);
    console.log(`📝 Nonce actuel: ${currentNonce}`);
    
    // Adresse du contrat
    const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
    const CONTRACT_ABI = require('../config/CrossBorderPayment.json').abi;
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    
    // Lire les backups
    const banks = JSON.parse(fs.readFileSync('./backup-banks.json'));
    const balances = JSON.parse(fs.readFileSync('./backup-balances.json'));
    
    console.log(`📦 ${banks.length} banques à restaurer...`);
    
    // Restaurer les banques
    for (const bank of banks) {
      console.log(`🏦 Enregistrement de ${bank.name}...`);
      try {
        // Vérifier d'abord si la banque existe déjà
        let bankInfo;
        try {
          bankInfo = await contract.banks(bank.wallet_address);
        } catch (e) {
          // La banque n'existe pas
          bankInfo = { isRegistered: false };
        }
        
        if (bankInfo.isRegistered) {
          console.log(`  ℹ️ ${bank.name} déjà existante - ignoré`);
        } else {
          const tx = await contract.registerBank(
            bank.wallet_address,
            bank.name,
            bank.country,
            bank.currency,
            { nonce: currentNonce++ }
          );
          await tx.wait();
          console.log(`  ✅ ${bank.name} restaurée (nonce: ${currentNonce-1})`);
        }
      } catch (err) {
        console.log(`  ❌ Erreur: ${err.message}`);
      }
      
      // Attendre 500ms entre chaque transaction
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log("💰 Restauration des balances...");
    for (const bal of balances) {
      if (parseFloat(bal.balance) > 0) {
        console.log(`  Ajout de ${bal.balance} TND à ${bal.address.substring(0,10)}...`);
        try {
          // Vérifier d'abord que la banque existe sur la blockchain
          let bankInfo;
          try {
            bankInfo = await contract.banks(bal.address);
          } catch (e) {
            bankInfo = { isRegistered: false };
          }
          
          if (!bankInfo.isRegistered) {
            console.log(`  ⚠️ Banque non enregistrée sur la blockchain - impossible d'ajouter la balance`);
            continue;
          }
          
          const amountWei = ethers.parseEther(bal.balance.toString());
          const tx = await contract.addBalance(
            bal.address, 
            amountWei,
            { nonce: currentNonce++ }
          );
          await tx.wait();
          console.log(`  ✅ Balance restaurée (nonce: ${currentNonce-1})`);
        } catch (err) {
          console.log(`  ⚠️ Erreur: ${err.message}`);
        }
        
        // Attendre 500ms entre chaque transaction
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    await syncBanksToPostgres(banks);

    console.log("✅ Restauration terminée !");
    console.log(`📝 Dernier nonce utilisé: ${currentNonce - 1}`);
    
  } catch (err) {
    console.error("❌ Erreur restauration:", err);
    process.exit(1);
  }
}

restore();
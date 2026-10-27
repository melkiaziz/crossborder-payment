// ============================================
// 🏦 CrossBorderPayment Backend API with PostgreSQL (UPDATED - COMPLETE)
// ============================================

const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config({ path: '.env' });

function resolveRpcWsUrl() {
  if (process.env.RPC_WS_URL) {
    return process.env.RPC_WS_URL;
  }
  const url = process.env.RPC_URL || 'ws://127.0.0.1:8545';
  if (url.startsWith('http://')) {
    return `ws://${url.slice('http://'.length)}`;
  }
  if (url.startsWith('https://')) {
    return `wss://${url.slice('https://'.length)}`;
  }
  return url;
}

// Import du service email
const emailService = require('./services/email.service');

// Import des routes de taux de change
const ratesRoutes = require('./routes/rates.routes');

// Import du cron de taux de change
const { startExchangeRateCron } = require('./cron/exchange-rate.cron');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const SALT_ROUNDS = 10;

// Email admin pour les notifications
const ADMIN_EMAIL = 'melki.mohamedaziz@esprit.tn';

// ============================================
// EMAIL TRANSPORT (vérification + reset password)
// ============================================

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.log("❌ Erreur configuration email:", error);
  } else {
    console.log("✅ Serveur email prêt à envoyer des messages");
  }
});

// ============================================
// POSTGRESQL
// ============================================

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'crossborder_db',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

pool.connect()
  .then(() => console.log("✅ PostgreSQL Connected"))
  .catch(err => console.error("❌ PostgreSQL Error:", err.message));

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json());

// ============================================
// ROUTES DE TAUX DE CHANGE
// ============================================

app.use('/api/rates', ratesRoutes);

// ============================================
// BLOCKCHAIN CONNECTION (WEBSOCKET)
// ============================================

const provider = new ethers.WebSocketProvider(resolveRpcWsUrl());

provider.on('error', (err) => {
  console.error('❌ WebSocket blockchain error:', err.message);
});

const centralBankWallet = new ethers.Wallet(
  process.env.CENTRAL_BANK_PRIVATE_KEY,
  provider
);

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const CONTRACT_ABI = require('./config/CrossBorderPayment.json').abi;

const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  centralBankWallet
);

// ============================================
// CONSTANTS
// ============================================

const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;
const EXCHANGE_RATE_API_URL = 'https://v6.exchangerate-api.com/v6';
const RATE_POLL_INTERVAL_MS = Number(process.env.RATE_POLL_INTERVAL_MS) || 21600000; // 6 heures
const RATE_SYNC_INTERVAL_MS = Number(process.env.RATE_SYNC_INTERVAL_MS) || 86400000; // 24h
const ALERT_REARM_MINUTES = Number(process.env.ALERT_REARM_MINUTES) || 60; // 1h
const AUTO_SYNC_TO_CONTRACT = process.env.AUTO_SYNC_TO_CONTRACT !== 'false'; // true by default

const FOREX_FALLBACK_RATES = {
  eurToTnd: 3.3,
  usdToTnd: 3.1,
  source: 'fallback'
};

// ============================================
// CACHE BLOCKCHAIN (évite appels répétés)
// ============================================

const cache = {
  info: { data: null, timestamp: 0, ttl: 30000 },
  rates: { data: null, timestamp: 0, ttl: 30000 },
  fees: { data: null, timestamp: 0, ttl: 30000 },
  forexRates: { data: null, timestamp: 0, ttl: RATE_POLL_INTERVAL_MS }
};

async function getCachedData(key, fetchFunction) {
  const now = Date.now();
  const cached = cache[key];
  if (cached && cached.data !== null && (now - cached.timestamp < cached.ttl)) {
    console.log(`📦 Cache HIT pour ${key}`);
    return cached.data;
  }
  console.log(`🔄 Cache MISS pour ${key}`);
  const data = await fetchFunction();
  if (cache[key]) {
    cache[key] = { data, timestamp: now, ttl: cached.ttl };
  }
  return data;
}

function invalidateCache(...keys) {
  keys.forEach(k => {
    if (cache[k]) {
      cache[k] = { ...cache[k], data: null, timestamp: 0 };
    }
  });
}

async function getContractRates() {
  const [eurRate, usdRate] = await Promise.all([
    contract.eurToTndRate(),
    contract.usdToTndRate()
  ]);

  return {
    eurToTnd: Number(ethers.formatEther(eurRate)),
    usdToTnd: Number(ethers.formatEther(usdRate))
  };
}

async function fetchForexRates() {
  const API_KEY = EXCHANGE_RATE_API_KEY;
  const API_URL = EXCHANGE_RATE_API_URL;

  if (!API_KEY) {
    console.warn('EXCHANGE_RATE_API_KEY is not configured; skipping forex update.');
    return FOREX_FALLBACK_RATES;
  }

  try {
    console.log('🌐 [Forex] Appel API ExchangeRate-API...');
    
    // Récupérer EUR/TND
    const eurResp = await fetch(`${API_URL}/${API_KEY}/latest/EUR`);
    const eurData = await eurResp.json();
    
    // Récupérer USD/TND
    const usdResp = await fetch(`${API_URL}/${API_KEY}/latest/USD`);
    const usdData = await usdResp.json();
    
    if (eurData.result !== 'success') {
      console.error('❌ [Forex] Erreur API EUR:', eurData.error?.type);
      throw new Error('Erreur API ExchangeRate EUR');
    }
    
    if (usdData.result !== 'success') {
      console.error('❌ [Forex] Erreur API USD:', usdData.error?.type);
      throw new Error('Erreur API ExchangeRate USD');
    }
    
    const eurToTnd = eurData.conversion_rates.TND;
    const usdToTnd = usdData.conversion_rates.TND;
    
    console.log(`✅ [Forex] Taux récupérés:`);
    console.log(`   1 EUR = ${eurToTnd} TND`);
    console.log(`   1 USD = ${usdToTnd} TND`);
    
    return {
      eurToTnd: Number(eurToTnd),
      usdToTnd: Number(usdToTnd),
      source: 'forex'
    };
  } catch (error) {
    console.error('❌ [Forex] Erreur:', error.message);
    console.warn('⚠️ [Forex] Utilisation des taux par défaut (3.3 EUR/TND, 3.1 USD/TND)');
    return {
      eurToTnd: FOREX_FALLBACK_RATES.eurToTnd,
      usdToTnd: FOREX_FALLBACK_RATES.usdToTnd,
      source: 'fallback'
    };
  }
}

async function saveRateHistory(currency, rate, source) {
  try {
    await pool.query(
      `INSERT INTO rate_history (currency, rate, source) VALUES ($1, $2, $3)`,
      [currency, rate, source]
    );
  } catch (err) {
    console.error('⚠️ Erreur sauvegarde rate_history:', err.message);
  }
}

async function checkRateAlerts(currentRates) {
  try {
    const alertsRes = await pool.query(`SELECT * FROM rate_alerts WHERE active = TRUE`);
    const alerts = alertsRes.rows;

    for (const alert of alerts) {
      const currentRate = alert.currency === 'EUR' ? currentRates.eurToTnd : currentRates.usdToTnd;
      const threshold = Number(alert.threshold);
      const lastTriggered = alert.last_triggered_at ? new Date(alert.last_triggered_at) : null;
      const now = new Date();
      const rearmDate = lastTriggered ? new Date(lastTriggered.getTime() + ALERT_REARM_MINUTES * 60000) : null;

      let shouldTrigger = false;
      if (alert.direction === 'above' && currentRate >= threshold) shouldTrigger = true;
      if (alert.direction === 'below' && currentRate <= threshold) shouldTrigger = true;
      if (shouldTrigger && rearmDate && rearmDate > now) {
        shouldTrigger = false;
      }

      if (shouldTrigger) {
        await pool.query(`
          INSERT INTO rate_alert_history (alert_id, current_rate, status)
          VALUES ($1, $2, 'triggered')
        `, [alert.id, currentRate]);

        await pool.query(`
          UPDATE rate_alerts
          SET last_triggered_at = NOW()
          WHERE id = $1
        `, [alert.id]);

        try {
          await emailService.sendRateAlertEmail(alert.email, {
            currency: alert.currency,
            threshold: alert.threshold,
            direction: alert.direction,
            currentRate
          });
          console.log(`✅ Alerte de taux envoyée à ${alert.email} pour ${alert.currency}`);
        } catch (emailErr) {
          console.error('❌ Erreur envoi email alerte taux:', emailErr.message);
          await pool.query(`
            INSERT INTO rate_alert_history (alert_id, current_rate, status)
            VALUES ($1, $2, 'email_error')
          `, [alert.id, currentRate]);
        }
      }
    }
  } catch (err) {
    console.error('⚠️ checkRateAlerts failed:', err.message);
  }
}

async function syncRatesToContract() {
  if (!AUTO_SYNC_TO_CONTRACT) {
    console.log('ℹ️ AUTO_SYNC_TO_CONTRACT désactivé');
    return;
  }

  try {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   🚀 SYNCHRONISATION DES TAUX DE CHANGE                  ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');

    // ✅ Récupérer le nonce actuel
    const currentNonce = await centralBankWallet.getNonce();
    let nonce = currentNonce;
    console.log(`📝 Nonce actuel: ${nonce}`);

    const forex = await fetchForexRates();
    const onChain = await getContractRates();

    console.log('\n📊 Comparaison des taux:');
    console.log(`   EUR/TND: API = ${forex.eurToTnd} | Blockchain = ${onChain.eurToTnd}`);
    console.log(`   USD/TND: API = ${forex.usdToTnd} | Blockchain = ${onChain.usdToTnd}`);

    const eurDiff = Math.abs(forex.eurToTnd - onChain.eurToTnd);
    const usdDiff = Math.abs(forex.usdToTnd - onChain.usdToTnd);

    let updated = false;

    if (eurDiff > 0.0001) {
      console.log('\n⛓️  Mise à jour EUR/TND sur la blockchain...');
      const rateWei = ethers.parseEther(forex.eurToTnd.toString());
      // ✅ Utiliser le nonce manuellement
      const tx = await contract.updateEurRate(rateWei, { nonce: nonce++ });
      console.log(`   📝 Transaction: ${tx.hash}`);
      await tx.wait();
      console.log(`   ✅ EUR/TND mis à jour: ${onChain.eurToTnd} → ${forex.eurToTnd}`);
      updated = true;
    } else {
      console.log(`\nℹ️ EUR/TND déjà à jour (diff ${eurDiff.toFixed(6)})`);
    }

    if (usdDiff > 0.0001) {
      console.log('\n⛓️  Mise à jour USD/TND sur la blockchain...');
      const rateWei = ethers.parseEther(forex.usdToTnd.toString());
      // ✅ Utiliser le nonce manuellement
      const tx = await contract.updateUsdRate(rateWei, { nonce: nonce++ });
      console.log(`   📝 Transaction: ${tx.hash}`);
      await tx.wait();
      console.log(`   ✅ USD/TND mis à jour: ${onChain.usdToTnd} → ${forex.usdToTnd}`);
      updated = true;
    } else {
      console.log(`ℹ️ USD/TND déjà à jour (diff ${usdDiff.toFixed(6)})`);
    }

    if (!updated) {
      console.log('\n✅ Tous les taux sont déjà à jour, aucune transaction envoyée.');
    }

    invalidateCache('info', 'rates');

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ SYNCHRONISATION TERMINÉE');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ Erreur syncRatesToContract:', err.message);
  }
}

async function getLiveRates() {
  const cached = cache.forexRates;
  const now = Date.now();
  
  if (cached && cached.data !== null && (now - cached.timestamp < cached.ttl)) {
    return cached.data;
  }
  
  const rates = await fetchForexRates();
  cache.forexRates = { data: rates, timestamp: now, ttl: RATE_POLL_INTERVAL_MS };
  return rates;
}

// Cron de pull des taux externes pour historique + alertes
setInterval(async () => {
  try {
    console.log('🔁 Synchronisation automatique des taux Forex externes...');
    const forex = await fetchForexRates();
    cache.forexRates = { data: forex, timestamp: Date.now(), ttl: RATE_POLL_INTERVAL_MS };
    await saveRateHistory('EUR', forex.eurToTnd, 'forex');
    await saveRateHistory('USD', forex.usdToTnd, 'forex');
    await checkRateAlerts(forex);
  } catch (err) {
    console.error('⚠️ Erreur cron taux Forex:', err.message);
  }
}, RATE_POLL_INTERVAL_MS);

// Cron quotidien pour transférer les taux Forex externes vers le contrat (on-chain)
setInterval(async () => {
  try {
    await syncRatesToContract();
  } catch (err) {
    console.error('❌ Erreur cron quotidien de syncRatesToContract:', err.message);
  }
}, RATE_SYNC_INTERVAL_MS);

// Exécution initiale au démarrage
(async () => {
  try {
    // Attendre 2 secondes pour que le contrat soit bien initialisé
    await new Promise(resolve => setTimeout(resolve, 2000));
    await syncRatesToContract();
  } catch (err) {
    console.error('❌ Erreur sync initiale:', err.message);
  }
})();

console.log("👂 Listening blockchain events via WebSocket...");

// ============================================
// EVENT LISTENERS (SOURCE OF TRUTH)
// ============================================

// ✅ Transfer executed
contract.on("TransferExecuted", async (
  fromBank,
  toBank,
  originalAmount,
  convertedAmount,
  fee
) => {
  console.log("\n🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔");
  console.log("🔔 EVENT TRANSFER EXECUTED DÉTECTÉ !");
  console.log("🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔");
  console.log(`📤 From: ${fromBank}`);
  console.log(`📥 To: ${toBank}`);
  console.log(`💰 Original Amount (wei): ${originalAmount.toString()}`);
  console.log(`💰 Original Amount (TND): ${ethers.formatEther(originalAmount)}`);
  console.log(`💱 Converted Amount (wei): ${convertedAmount.toString()}`);
  console.log(`💱 Converted Amount (TND): ${ethers.formatEther(convertedAmount)}`);
  console.log(`💸 Fee (wei): ${fee.toString()}`);
  console.log(`💸 Fee (TND): ${ethers.formatEther(fee)}`);
  
  try {
    // Formater les montants
    const formattedOriginal = ethers.formatEther(originalAmount);
    const formattedConverted = ethers.formatEther(convertedAmount);
    const formattedFee = ethers.formatEther(fee);
    
    console.log("📝 Tentative d'insertion dans PostgreSQL...");
    console.log(`   Données: ${fromBank}, ${toBank}, ${formattedOriginal}, ${formattedConverted}, ${formattedFee}`);
    
    const result = await pool.query(`
      INSERT INTO transactions
      (from_bank, to_bank, original_amount, converted_amount, fee)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      fromBank,
      toBank,
      formattedOriginal,
      formattedConverted,
      formattedFee
    ]);

    console.log(`✅✅✅ TRANSACTION SAUVEGARDÉE DANS POSTGRESQL ! ID: ${result.rows[0].id}`);
    
    // Mettre à jour les balances dans PostgreSQL
    try {
      console.log("📝 Mise à jour des balances...");
      
      // Récupérer les nouvelles balances depuis le contrat
      const fromBalance = await contract.getBalance(fromBank);
      const toBalance = await contract.getBalance(toBank);
      
      console.log(`   Nouvelle balance from: ${ethers.formatEther(fromBalance)} TND`);
      console.log(`   Nouvelle balance to: ${ethers.formatEther(toBalance)} TND`);
      
      await pool.query(`
        UPDATE banks SET balance = $1 WHERE wallet_address = $2
      `, [ethers.formatEther(fromBalance), fromBank]);
      
      await pool.query(`
        UPDATE banks SET balance = $1 WHERE wallet_address = $2
      `, [ethers.formatEther(toBalance), toBank]);
      
      console.log("✅ Balances mises à jour dans PostgreSQL");
    } catch (balanceErr) {
      console.error("⚠️ Erreur mise à jour balances:", balanceErr.message);
    }

  } catch (err) {
    console.error("❌❌❌ ERREUR DANS L'EVENT LISTENER ❌❌❌");
    console.error("Message:", err.message);
    console.error("Stack complet:", err.stack);
    if (err.code) console.error("Code erreur:", err.code);
    if (err.detail) console.error("Détail:", err.detail);
  }
  console.log("=============================================\n");
});

// ✅ Pending created
// ✅ Pending created (AVEC ON CONFLICT - VERSION FINALE)
contract.on("PendingTransferCreated", async (
  transferId,
  from,
  to,
  amount
) => {
  console.log("\n🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔");
  console.log("🔔 EVENT PENDING TRANSFER CREATED DÉTECTÉ !");
  console.log("🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔");
  console.log(`🆔 Transfer ID: ${Number(transferId)}`);
  console.log(`📤 From: ${from}`);
  console.log(`📥 To: ${to}`);
  console.log(`💰 Amount (TND): ${ethers.formatEther(amount)}`);
  
  try {
    const formattedAmount = ethers.formatEther(amount);
    
    // ✅ Insertion avec gestion de conflit UNIQUE
    const result = await pool.query(`
      INSERT INTO pending_transfers
      (transfer_id, from_bank, to_bank, amount, status)
      VALUES ($1, $2, $3, $4, 'pending')
      ON CONFLICT (transfer_id) DO NOTHING
      RETURNING id
    `, [
      Number(transferId),
      from,
      to,
      formattedAmount
    ]);

    if (result.rows.length > 0) {
      console.log(`✅✅✅ NOUVEAU pending transfer inséré ! ID: ${result.rows[0].id}`);
    } else {
      console.log(`ℹ️ Transfer ID ${transferId} existe déjà, ignoré (contrainte UNIQUE)`);
    }

  } catch (err) {
    console.error("❌❌❌ ERREUR DANS L'EVENT PENDING LISTENER ❌❌❌");
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
  }
  console.log("=============================================\n");
});

// ✅ Pending approved (AVEC DÉPLACEMENT VERS TRANSACTIONS)
contract.on("PendingTransferApproved", async (transferId) => {
  console.log("\n🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔");
  console.log("🔔 EVENT PENDING TRANSFER APPROVED DÉTECTÉ !");
  console.log("🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔");
  console.log(`🆔 Transfer ID approuvé: ${Number(transferId)}`);
  
  try {
    // 1. Récupérer les informations du pending transfer
    const pendingResult = await pool.query(`
      SELECT * FROM pending_transfers 
      WHERE transfer_id = $1
    `, [Number(transferId)]);

    if (pendingResult.rows.length === 0) {
      console.log(`⚠️ Aucun pending transfer trouvé avec l'ID ${transferId}`);
      return;
    }

    const pending = pendingResult.rows[0];
    console.log(`📦 Pending transfer trouvé: ${pending.amount} TND de ${pending.from_bank} vers ${pending.to_bank}`);

    // 2. Récupérer les taux de change et frais depuis le contrat
    let convertedAmount = pending.amount;
    let fee = "0";
    
    try {
      const fromBankInfo = await contract.banks(pending.from_bank);
      const toBankInfo = await contract.banks(pending.to_bank);
      
      const amountNum = parseFloat(pending.amount);
      
      if (fromBankInfo.currency === toBankInfo.currency) {
        convertedAmount = pending.amount;
        fee = (amountNum * 0.01).toString(); // 1% de frais
      } else if (fromBankInfo.currency === "EUR" && toBankInfo.currency === "TND") {
        convertedAmount = (amountNum * 3.3).toString();
        fee = (parseFloat(convertedAmount) * 0.01).toString();
      } else if (fromBankInfo.currency === "USD" && toBankInfo.currency === "TND") {
        convertedAmount = (amountNum * 3.1).toString();
        fee = (parseFloat(convertedAmount) * 0.01).toString();
      } else if (fromBankInfo.currency === "TND" && toBankInfo.currency === "EUR") {
        convertedAmount = (amountNum / 3.3).toString();
        fee = (parseFloat(convertedAmount) * 0.01).toString();
      } else if (fromBankInfo.currency === "TND" && toBankInfo.currency === "USD") {
        convertedAmount = (amountNum / 3.1).toString();
        fee = (parseFloat(convertedAmount) * 0.01).toString();
      } else {
        convertedAmount = pending.amount;
        fee = (amountNum * 0.01).toString();
      }
      
      console.log(`💱 Conversion: ${pending.amount} ${fromBankInfo.currency} -> ${convertedAmount} ${toBankInfo.currency}`);
      console.log(`💰 Frais: ${fee} TND`);
    } catch (rateErr) {
      console.log("⚠️ Erreur calcul taux:", rateErr.message);
      convertedAmount = pending.amount;
      fee = (parseFloat(pending.amount) * 0.01).toString();
    }

    // 3. Insérer dans transactions
    const txResult = await pool.query(`
      INSERT INTO transactions
      (from_bank, to_bank, original_amount, converted_amount, fee, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      pending.from_bank,
      pending.to_bank,
      pending.amount,
      convertedAmount,
      fee,
      pending.created_at
    ]);

    console.log(`✅✅✅ TRANSACTION CRÉÉE DANS L'HISTORIQUE ! ID: ${txResult.rows[0].id}`);

    // 4. Mettre à jour le statut du pending transfer
    await pool.query(`
      UPDATE pending_transfers
      SET status = 'approved', approved_at = NOW()
      WHERE transfer_id = $1
    `, [Number(transferId)]);

    console.log(`✅✅✅ PENDING TRANSFER APPROUVÉ !`);

  } catch (err) {
    console.error("❌❌❌ ERREUR DANS L'EVENT APPROVED LISTENER ❌❌❌");
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
  }
  console.log("=============================================\n");
});

// ============================================
// REGISTER BANK ENDPOINT
// ============================================

app.post("/api/banks/register", async (req, res) => {
  try {
    const { address, name, country, currency } = req.body;

    if (!address || !name || !country || !currency) {
      return res.status(400).json({
        success: false,
        error: "Missing fields"
      });
    }

    console.log(`📝 Enregistrement de ${name} (${address})...`);

    // ✅ 1. D'abord vérifier si déjà dans PostgreSQL
    const existing = await pool.query(
      "SELECT * FROM banks WHERE wallet_address = $1",
      [address]
    );

    // ✅ 2. Appeler le smart contract (obligatoire pour la blockchain)
    console.log("⛓️  Appel du smart contract...");
    const tx = await contract.registerBank(address, name, country, currency);
    const receipt = await tx.wait();
    console.log(`✅ Transaction blockchain: ${receipt.hash}`);

    // ✅ 3. Ensuite enregistrer dans PostgreSQL (si pas déjà fait)
    if (existing.rows.length === 0) {
      await pool.query(`
        INSERT INTO banks (wallet_address, name, country, currency, tx_hash)
        VALUES ($1, $2, $3, $4, $5)
      `, [address, name, country, currency, receipt.hash]);
      console.log("✅ Banque ajoutée à PostgreSQL");
    } else {
      // Mettre à jour le tx_hash si la banque existe déjà
      await pool.query(`
        UPDATE banks 
        SET tx_hash = $1 
        WHERE wallet_address = $2
      `, [receipt.hash, address]);
      console.log("✅ Transaction hash mis à jour dans PostgreSQL");
    }

    res.json({
      success: true,
      message: "Bank registered successfully on blockchain",
      transactionHash: receipt.hash,
      blockchain: true,
      database: existing.rows.length === 0 ? "inserted" : "updated"
    });

  } catch (err) {
    console.error("❌ Erreur registerBank:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============================================
// ADD BALANCE ENDPOINT
// ============================================

app.post("/api/banks/:address/balance", async (req, res) => {
  try {
    const { address } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Montant invalide"
      });
    }

    // Convertir en nombre
    const amountNum = parseFloat(amount);
    
    console.log(`💰 Ajout de ${amountNum} TND à ${address}`);

    // Vérifier que la banque existe
    const bankCheck = await pool.query(
      "SELECT * FROM banks WHERE wallet_address = $1",
      [address]
    );

    if (bankCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Banque non trouvée"
      });
    }

    // Appeler le smart contract
    const amountWei = ethers.parseEther(amount.toString());
    const tx = await contract.addBalance(address, amountWei);
    const receipt = await tx.wait();

    console.log(`✅ Transaction blockchain (addBalance): ${receipt.hash}`);
    console.log(`📦 Block: ${receipt.blockNumber}`);

    // Mettre à jour PostgreSQL
    await pool.query(`
      UPDATE banks 
      SET balance = COALESCE(balance, 0) + $1
      WHERE wallet_address = $2
    `, [amountNum, address]);

    // Récupérer la nouvelle balance
    const updated = await pool.query(
      "SELECT balance FROM banks WHERE wallet_address = $1",
      [address]
    );

    console.log(`✅ Nouvelle balance pour ${address}: ${updated.rows[0].balance} TND`);

    // ✅ Envoi email après ajout de solde
    try {
      const bankInfo = await pool.query(
        "SELECT name FROM banks WHERE wallet_address = $1",
        [address]
      );
      
      await emailService.sendBalanceAddedEmail(
        ADMIN_EMAIL,
        {
          bankName: bankInfo.rows[0]?.name || address,
          amount: amountNum,
          newBalance: updated.rows[0].balance
        }
      );
      console.log('✅ Email de notification de solde envoyé');
    } catch (emailErr) {
      console.error('❌ Erreur envoi email balance:', emailErr.message);
    }

    res.json({
      success: true,
      message: `✅ ${amountNum} TND ajoutés avec succès`,
      newBalance: updated.rows[0].balance,
      transactionHash: receipt.hash
    });

  } catch (err) {
    console.error("❌ Erreur ajout solde:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============================================
// HELPERS
// ============================================

function getContractForBank(privateKey) {
  const wallet = new ethers.Wallet(privateKey, provider);
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
}

const parseEther = v => ethers.parseEther(v.toString());

// ============================================
// TRANSFER ENDPOINT (AVEC LOGS DÉTAILLÉS + INSERT DIRECT CORRIGÉ)
// ============================================

app.post("/api/transfers", async (req, res) => {
  try {
    const { fromBankPrivateKey, toAddress, amount } = req.body;

    if (!fromBankPrivateKey || !toAddress || !amount) {
      return res.status(400).json({
        success: false,
        error: "Missing fields"
      });
    }

    console.log("\n=================================");
    console.log("🔄 NOUVEAU TRANSFERT");
    console.log(`📤 From Private Key: ${fromBankPrivateKey.substring(0, 15)}...`);
    console.log(`📥 To Address: ${toAddress}`);
    console.log(`💰 Amount: ${amount} TND`);

    // Obtenir l'adresse de la banque émettrice
    const fromWallet = new ethers.Wallet(fromBankPrivateKey, provider);
    const fromAddress = fromWallet.address;
    console.log(`🏦 From Address: ${fromAddress}`);

    // Vérifier le solde de la banque émettrice (via contrat)
    try {
      const balance = await contract.getBalance(fromAddress);
      console.log(`💰 Solde disponible: ${ethers.formatEther(balance)} TND`);
    } catch (e) {
      console.log(`⚠️  Impossible de vérifier le solde: ${e.message}`);
    }

    // Vérifier que la banque destinataire existe
    try {
      const toBank = await contract.banks(toAddress);
      console.log(`🏦 Banque destinataire enregistrée: ${toBank.isRegistered ? 'OUI' : 'NON'}`);
    } catch (e) {
      console.log(`⚠️  Erreur vérification destinataire: ${e.message}`);
    }

    // Vérifier le seuil d'approbation
    const threshold = await contract.approvalThreshold();
    const amountWei = parseEther(amount);
    const isPending = amountWei > threshold;
    console.log(`⚖️  Seuil d'approbation: ${ethers.formatEther(threshold)} TND`);
    console.log(`📊 Statut: ${isPending ? "EN ATTENTE (montant > seuil)" : "DIRECT"}`);

    // Créer le contrat pour cette banque
    const bankContract = getContractForBank(fromBankPrivateKey);

    console.log("⛓️  Envoi de la transaction au smart contract...");
    const tx = await bankContract.transfer(toAddress, amountWei);
    console.log(`📝 Transaction hash: ${tx.hash}`);

    console.log("⏳ Attente de confirmation (minage)...");
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmée dans le block: ${receipt.blockNumber}`);
    console.log(`⛽ Gas utilisé: ${receipt.gasUsed.toString()}`);

    // ✅ INSERT DIRECT DANS POSTGRESQL (CORRIGÉ)
    try {
      console.log("📝 Sauvegarde directe dans PostgreSQL...");
      
      // Récupérer le nombre de pending transfers (si applicable)
      let pendingId = null;
      if (isPending) {
        const pendingCount = await contract.pendingCount();
        pendingId = Number(pendingCount) - 1;
      }
      
      if (isPending) {
        // ✅ POUR LES TRANSFERTS EN ATTENTE
        console.log(`⏸️ Transfert en attente (ID: ${pendingId}) - insertion dans pending_transfers`);
        
        // Vérifier si le pending transfer existe déjà (créé par l'event)
        const pendingCheck = await pool.query(
          "SELECT id FROM pending_transfers WHERE transfer_id = $1",
          [pendingId]
        );
        
        if (pendingCheck.rows.length === 0) {
          // L'event n'a pas fonctionné, on insère manuellement
          await pool.query(`
            INSERT INTO pending_transfers
            (transfer_id, from_bank, to_bank, amount, status)
            VALUES ($1, $2, $3, $4, 'pending')
          `, [pendingId, fromAddress, toAddress, amount]);
          console.log(`✅ Pending transfer inséré manuellement (ID: ${pendingId})`);
        } else {
          console.log(`ℹ️ Pending transfer déjà existant (ID: ${pendingCheck.rows[0].id})`);
        }
      } else {
        // ✅ POUR LES TRANSFERTS DIRECTS (< seuil)
        // Récupérer les informations de taux de change et frais
        let convertedAmount = amount;
        let fee = "0";
        
        try {
          const fromBankInfo = await contract.banks(fromAddress);
          const toBankInfo = await contract.banks(toAddress);
          const amountNum = parseFloat(amount);

          const rates = await getLiveRates();
          const eurRate = Number(rates.eurToTnd);
          const usdRate = Number(rates.usdToTnd);

          if (fromBankInfo.currency === toBankInfo.currency) {
            convertedAmount = amount;
          } else if (fromBankInfo.currency === 'EUR' && toBankInfo.currency === 'TND') {
            convertedAmount = (amountNum * eurRate).toFixed(6).toString();
          } else if (fromBankInfo.currency === 'USD' && toBankInfo.currency === 'TND') {
            convertedAmount = (amountNum * usdRate).toFixed(6).toString();
          } else if (fromBankInfo.currency === 'TND' && toBankInfo.currency === 'EUR') {
            convertedAmount = (amountNum / eurRate).toFixed(6).toString();
          } else if (fromBankInfo.currency === 'TND' && toBankInfo.currency === 'USD') {
            convertedAmount = (amountNum / usdRate).toFixed(6).toString();
          } else if (fromBankInfo.currency === 'EUR' && toBankInfo.currency === 'USD') {
            const eurToUsd = usdRate / eurRate;
            convertedAmount = (amountNum * eurToUsd).toFixed(6).toString();
          } else if (fromBankInfo.currency === 'USD' && toBankInfo.currency === 'EUR') {
            const usdToEur = eurRate / usdRate;
            convertedAmount = (amountNum * usdToEur).toFixed(6).toString();
          } else {
            convertedAmount = amount;
          }

          fee = (parseFloat(convertedAmount) * 0.01).toFixed(6).toString();
        } catch (rateErr) {
          console.log("⚠️ Erreur calcul taux:", rateErr.message);
          convertedAmount = amount;
          fee = (parseFloat(amount) * 0.01).toString();
        }

        const result = await pool.query(`
          INSERT INTO transactions
          (from_bank, to_bank, original_amount, converted_amount, fee)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [
          fromAddress,
          toAddress,
          amount,
          convertedAmount,
          fee
        ]);

        console.log(`✅✅✅ TRANSACTION SAUVEGARDÉE DIRECTEMENT DANS POSTGRESQL ! ID: ${result.rows[0].id}`);
        
        // ✅ Envoi email après transfert direct
        try {
          const fromBankInfo = await pool.query(
            "SELECT name FROM banks WHERE wallet_address = $1",
            [fromAddress]
          );
          const toBankInfo = await pool.query(
            "SELECT name FROM banks WHERE wallet_address = $1",
            [toAddress]
          );
          
          await emailService.sendTransferCreatedEmail(
            ADMIN_EMAIL,
            {
              fromBank: fromBankInfo.rows[0]?.name || fromAddress,
              toBank: toBankInfo.rows[0]?.name || toAddress,
              amount: amount,
              status: 'completed'
            }
          );
          console.log('✅ Email de transfert direct envoyé');
        } catch (emailErr) {
          console.error('❌ Erreur envoi email transfert:', emailErr.message);
        }
      }
    } catch (dbErr) {
      console.error("❌ Erreur sauvegarde directe dans PostgreSQL:", dbErr.message);
      console.error("Stack:", dbErr.stack);
    }

    // Récupérer le nombre de pending transfers (si applicable)
    if (isPending) {
      const pendingCount = await contract.pendingCount();
      console.log(`🆔 Pending Transfer ID: ${Number(pendingCount) - 1}`);
      
      // ✅ Envoi email pour transfert en attente
      try {
        const fromBankInfo = await pool.query(
          "SELECT name FROM banks WHERE wallet_address = $1",
          [fromAddress]
        );
        const toBankInfo = await pool.query(
          "SELECT name FROM banks WHERE wallet_address = $1",
          [toAddress]
        );
        
        await emailService.sendTransferCreatedEmail(
          ADMIN_EMAIL,
          {
            fromBank: fromBankInfo.rows[0]?.name || fromAddress,
            toBank: toBankInfo.rows[0]?.name || toAddress,
            amount: amount,
            status: 'pending'
          }
        );
        console.log('✅ Email de transfert en attente envoyé');
      } catch (emailErr) {
        console.error('❌ Erreur envoi email pending:', emailErr.message);
      }
    }

    console.log("✅ TRANSFERT RÉUSSI !");
    console.log("=================================\n");

    res.json({
      success: true,
      message: isPending
        ? "Transfer created (pending - waiting for approval)"
        : "Transfer executed (completed)",
      txHash: receipt.hash,
      status: isPending ? "pending" : "completed",
      fromAddress: fromAddress,
      blockNumber: receipt.blockNumber,
      pendingId: isPending ? Number(await contract.pendingCount()) - 1 : null
    });

  } catch (err) {
    console.error("\n❌❌❌ ERREUR TRANSFERT ❌❌❌");
    console.error("Message:", err.message);
    console.error("Raison:", err.reason || err.error?.message || "Non spécifiée");
    
    if (err.transaction) {
      console.error("Transaction:", {
        from: err.transaction.from,
        to: err.transaction.to,
        data: err.transaction.data?.substring(0, 50) + "..."
      });
    }
    
    if (err.receipt) {
      console.error("Receipt error:", err.receipt);
    }
    
    console.error("=================================\n");

    res.status(500).json({
      success: false,
      error: err.reason || err.message,
      details: err.error?.message || null
    });
  }
});

// ============================================
// APPROVE TRANSFER ENDPOINT
// ============================================

app.post("/api/transfers/approve/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`\n=================================`);
    console.log(`✅✅ APPROBATION DE TRANSFERT ${id} ✅✅`);
    console.log(`=================================`);
    
    // Appeler le smart contract
    console.log("⛓️  Appel du smart contract...");
    const tx = await contract.approveTransfer(id);
    console.log(`📝 Transaction hash: ${tx.hash}`);
    
    console.log("⏳ Attente de confirmation...");
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmée dans le block: ${receipt.blockNumber}`);
    
    // ✅ Envoi email après approbation
    try {
      const pendingInfo = await pool.query(
        "SELECT * FROM pending_transfers WHERE transfer_id = $1",
        [id]
      );
      
      if (pendingInfo.rows.length > 0) {
        const fromBankInfo = await pool.query(
          "SELECT name FROM banks WHERE wallet_address = $1",
          [pendingInfo.rows[0].from_bank]
        );
        const toBankInfo = await pool.query(
          "SELECT name FROM banks WHERE wallet_address = $1",
          [pendingInfo.rows[0].to_bank]
        );
        
        await emailService.sendTransferApprovedEmail(
          ADMIN_EMAIL,
          {
            fromBank: fromBankInfo.rows[0]?.name || pendingInfo.rows[0].from_bank,
            toBank: toBankInfo.rows[0]?.name || pendingInfo.rows[0].to_bank,
            amount: pendingInfo.rows[0].amount
          }
        );
        console.log('✅ Email d\'approbation envoyé');
      }
    } catch (emailErr) {
      console.error('❌ Erreur envoi email approbation:', emailErr.message);
    }
    
    console.log(`✅✅ APPROBATION RÉUSSIE !`);
    console.log(`=================================\n`);
    
    res.json({
      success: true,
      message: `Transfert ${id} approuvé avec succès`,
      transactionHash: receipt.hash
    });
    
  } catch (err) {
    console.error(`\n❌❌❌ ERREUR APPROBATION ❌❌❌`);
    console.error("Message:", err.message);
    console.error("Raison:", err.reason || err.error?.message || "Non spécifiée");
    console.error(`=================================\n`);
    
    res.status(500).json({
      success: false,
      error: err.reason || err.message
    });
  }
});

// ============================================
// BLACKLIST ENDPOINTS
// ============================================

// Vérifier si une adresse est blacklistée
app.get("/api/blacklist/:address", async (req, res) => {
  try {
    const { address } = req.params;
    
    console.log(`🚫 Vérification blacklist pour ${address}`);
    
    // Appeler le smart contract
    const isBlacklisted = await contract.blacklisted(address);
    
    res.json({
      success: true,
      address: address,
      isBlacklisted: isBlacklisted
    });
    
  } catch (err) {
    console.error("❌ Erreur vérification blacklist:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Ajouter une adresse à la blacklist
app.post("/api/blacklist/:address", async (req, res) => {
  try {
    const { address } = req.params;
    
    console.log(`🚫 Ajout à la blacklist: ${address}`);
    
    // Appeler le smart contract
    const tx = await contract.blacklistBank(address);
    const receipt = await tx.wait();
    
    // Optionnel: ajouter à une table blacklist_history
    try {
      await pool.query(`
        INSERT INTO blacklist_history (wallet_address, action, tx_hash)
        VALUES ($1, 'blacklist', $2)
      `, [address, receipt.hash]);
    } catch (dbErr) {
      console.log("⚠️ Erreur enregistrement historique:", dbErr.message);
    }
    
    res.json({
      success: true,
      message: `Adresse ${address} ajoutée à la blacklist`,
      transactionHash: receipt.hash
    });
    
  } catch (err) {
    console.error("❌ Erreur ajout blacklist:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Retirer une adresse de la blacklist
app.delete("/api/blacklist/:address", async (req, res) => {
  try {
    const { address } = req.params;
    
    console.log(`✅ Retrait de la blacklist: ${address}`);
    
    // Appeler le smart contract
    const tx = await contract.removeFromBlacklist(address);
    const receipt = await tx.wait();
    
    // Optionnel: ajouter à une table blacklist_history
    try {
      await pool.query(`
        INSERT INTO blacklist_history (wallet_address, action, tx_hash)
        VALUES ($1, 'remove', $2)
      `, [address, receipt.hash]);
    } catch (dbErr) {
      console.log("⚠️ Erreur enregistrement historique:", dbErr.message);
    }
    
    res.json({
      success: true,
      message: `Adresse ${address} retirée de la blacklist`,
      transactionHash: receipt.hash
    });
    
  } catch (err) {
    console.error("❌ Erreur retrait blacklist:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ============================================
// DB CHECK ENDPOINTS
// ============================================

app.get("/api/db/pending", async(req,res)=>{
  const result = await pool.query(`
    SELECT * FROM pending_transfers
    ORDER BY created_at DESC
  `);
  res.json(result.rows);
});

app.get("/api/db/transactions", async(req,res)=>{
  const result = await pool.query(`
    SELECT * FROM transactions
    ORDER BY created_at DESC
  `);
  res.json(result.rows);
});

app.get("/api/db/banks", async(req,res)=>{
  const result = await pool.query(`
    SELECT * FROM banks
    ORDER BY created_at DESC
  `);
  res.json(result.rows);
});

// ============================================
// CONTRACT INFO ENDPOINT (AVEC CACHE)
// ============================================

app.get("/api/info", async (req, res) => {
  try {
    const data = await getCachedData('info', async () => {
      const [owner, transferFee, dailyLimit, approvalThreshold, pendingCount, txCount] = await Promise.all([
        contract.owner(),
        contract.transferFeePercent(),
        contract.dailyLimit(),
        contract.approvalThreshold(),
        contract.pendingCount(),
        contract.getTransactionCount(),
      ]);

      const liveRates = await getLiveRates();
      const contractRates = await getContractRates();

      return {
        contractAddress: CONTRACT_ADDRESS,
        owner,
        rates: {
          eurToTnd: liveRates.eurToTnd,
          usdToTnd: liveRates.usdToTnd,
          source: liveRates.source || 'forex',
          contract: contractRates
        },
        transferFeePercent: Number(transferFee),
        dailyLimit: ethers.formatEther(dailyLimit),
        approvalThreshold: ethers.formatEther(approvalThreshold),
        statistics: {
          pendingTransfers: Number(pendingCount),
          totalTransactions: Number(txCount),
        }
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Erreur récupération infos contrat:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// RATES ENDPOINTS (AVEC CACHE)
// ============================================

// Mettre à jour le taux EUR/TND
app.put("/api/rates/eur", async (req, res) => {
  try {
    const { rate } = req.body;

    if (!rate || rate <= 0) {
      return res.status(400).json({
        success: false,
        error: "Taux invalide"
      });
    }

    console.log(`💱 Mise à jour du taux EUR/TND: ${rate}`);

    const rateWei = ethers.parseEther(rate.toString());
    const tx = await contract.updateEurRate(rateWei);
    const receipt = await tx.wait();

    invalidateCache('info', 'rates');
    console.log(`✅ Taux EUR/TND mis à jour: ${receipt.hash}`);

    res.json({
      success: true,
      message: "Taux EUR/TND mis à jour avec succès",
      transactionHash: receipt.hash,
      newRate: rate
    });

  } catch (error) {
    console.error("❌ Erreur mise à jour taux EUR:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Mettre à jour le taux USD/TND
app.put("/api/rates/usd", async (req, res) => {
  try {
    const { rate } = req.body;

    if (!rate || rate <= 0) {
      return res.status(400).json({
        success: false,
        error: "Taux invalide"
      });
    }

    console.log(`💱 Mise à jour du taux USD/TND: ${rate}`);

    const rateWei = ethers.parseEther(rate.toString());
    const tx = await contract.updateUsdRate(rateWei);
    const receipt = await tx.wait();

    invalidateCache('info', 'rates');
    console.log(`✅ Taux USD/TND mis à jour: ${receipt.hash}`);

    res.json({
      success: true,
      message: "Taux USD/TND mis à jour avec succès",
      transactionHash: receipt.hash,
      newRate: rate
    });

  } catch (error) {
    console.error("❌ Erreur mise à jour taux USD:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// endpoint manuelle de sync automatique
app.post('/api/rates/sync', async (req, res) => {
  try {
    await syncRatesToContract();
    res.json({ success: true, message: 'Synchronisation des taux lancée.' });
  } catch (err) {
    console.error('❌ Erreur /api/rates/sync:', err);
    res.status(500).json({ success: false, error: 'Échec de la synchronisation des taux' });
  }
});

// ============================================
// FEES ENDPOINTS (AVEC CACHE)
// ============================================

// Mettre à jour le pourcentage de frais
app.put("/api/fees", async (req, res) => {
  try {
    const { fee } = req.body;

    if (fee === undefined || fee < 0 || fee > 10) {
      return res.status(400).json({
        success: false,
        error: "Frais invalide (doit être entre 0 et 10)"
      });
    }

    console.log(`💰 Mise à jour des frais: ${fee}%`);

    const tx = await contract.updateTransferFee(fee);
    const receipt = await tx.wait();

    invalidateCache('info', 'fees');
    console.log(`✅ Frais mis à jour: ${receipt.hash}`);

    res.json({
      success: true,
      message: "Frais de transfert mis à jour avec succès",
      transactionHash: receipt.hash,
      newFee: fee
    });

  } catch (error) {
    console.error("❌ Erreur mise à jour frais:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// GET RATES ONLY ENDPOINT (AVEC CACHE)
// ============================================

app.get("/api/rates", async (req, res) => {
  try {
    const rates = await getLiveRates();
    res.json({ success: true, data: { eurToTnd: rates.eurToTnd, usdToTnd: rates.usdToTnd, source: rates.source || 'forex', updatedAt: new Date().toISOString() } });
  } catch (error) {
    console.error("❌ Erreur récupération taux:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/rates/history', async (req, res) => {
  try {
    const currency = (req.query.currency || '').toUpperCase();
    const limit = Math.min(1000, Number(req.query.limit) || 100);
    let query = 'SELECT currency, rate, source, created_at FROM rate_history';
    const params = [];

    if (currency === 'EUR' || currency === 'USD') {
      query += ' WHERE currency = $1';
      params.push(currency);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const rows = await pool.query(query, params);
    res.json({ success: true, data: rows.rows });
  } catch (error) {
    console.error('❌ Erreur récupération historique taux:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/rates/alerts', async (req, res) => {
  try {
    const { currency, threshold, direction, email } = req.body;
    if (!['EUR', 'USD'].includes(currency)) {
      return res.status(400).json({ success: false, error: 'Currency must be EUR or USD' });
    }
    if (!['above', 'below'].includes(direction)) {
      return res.status(400).json({ success: false, error: 'Direction must be above or below' });
    }
    const parsed = Number(threshold);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ success: false, error: 'Threshold invalid' });
    }
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email required for alert notifications' });
    }

    const result = await pool.query(
      `INSERT INTO rate_alerts (currency, threshold, direction, email) VALUES ($1, $2, $3, $4) RETURNING *`,
      [currency, parsed, direction, email]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('❌ Erreur création alerte taux:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/rates/alerts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rate_alerts ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('❌ Erreur récupération alertes taux:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// GET frais (avec cache)
app.get("/api/fees", async (req, res) => {
  try {
    const fees = await getCachedData('fees', async () => {
      const transferFee = await contract.transferFeePercent();
      return { transferFeePercent: Number(transferFee) };
    });
    res.json({ success: true, data: fees });
  } catch (error) {
    console.error("❌ Erreur récupération frais:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DASHBOARD ENDPOINTS
// ============================================

// KPIs globaux
app.get("/api/dashboard/kpis", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM banks) AS total_banks,
        (SELECT COUNT(*) FROM transactions) AS total_transactions,
        (SELECT COALESCE(SUM(original_amount::numeric), 0) FROM transactions) AS total_volume,
        (SELECT COALESCE(SUM(fee::numeric), 0) FROM transactions) AS total_fees,
        (SELECT COUNT(*) FROM pending_transfers WHERE status = 'pending') AS pending_count,
        (SELECT COUNT(*) FROM employees) AS total_employees
    `);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("❌ Erreur dashboard KPIs:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Évolution des transactions (par jour)
app.get("/api/dashboard/transactions-evolution", async (req, res) => {
  try {
    const days = parseInt(req.query.days || '7', 10);
    const result = await pool.query(`
      SELECT 
        DATE(created_at) AS date,
        COUNT(*) AS count,
        SUM(original_amount::numeric) AS volume,
        SUM(fee::numeric) AS fees
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("❌ Erreur dashboard transactions-evolution:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Répartition par devise
app.get("/api/dashboard/currency-distribution", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        currency,
        COUNT(*) AS count,
        COALESCE(SUM(balance::numeric), 0) AS total_balance
      FROM banks
      GROUP BY currency
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("❌ Erreur dashboard currency-distribution:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Répartition par pays
app.get("/api/dashboard/country-distribution", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        country,
        COUNT(*) AS bank_count
      FROM banks
      GROUP BY country
      ORDER BY bank_count DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("❌ Erreur dashboard country-distribution:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Top 10 banques
app.get("/api/dashboard/top-banks", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.name,
        b.wallet_address,
        COUNT(t.id) AS transaction_count,
        COALESCE(SUM(t.original_amount::numeric), 0) AS total_sent
      FROM banks b
      LEFT JOIN transactions t ON b.wallet_address = t.from_bank
      GROUP BY b.id, b.name, b.wallet_address
      ORDER BY transaction_count DESC
      LIMIT 10
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("❌ Erreur dashboard top-banks:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Activités récentes
app.get("/api/dashboard/recent-activity", async (req, res) => {
  try {
    const [recentTx, recentPending, activeBanks] = await Promise.all([
      pool.query(`SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10`),
      pool.query(`SELECT * FROM pending_transfers WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10`),
      pool.query(`
        SELECT 
          b.name,
          b.wallet_address,
          COUNT(t.id) AS transaction_count
        FROM banks b
        LEFT JOIN transactions t ON b.wallet_address = t.from_bank OR b.wallet_address = t.to_bank
        GROUP BY b.id, b.name, b.wallet_address
        ORDER BY transaction_count DESC
        LIMIT 10
      `)
    ]);

    res.json({
      success: true,
      data: {
        recentTransactions: recentTx.rows,
        pendingTransfers: recentPending.rows,
        activeBanks: activeBanks.rows
      }
    });
  } catch (err) {
    console.error("❌ Erreur dashboard recent-activity:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// EMPLOYEE AUTHENTICATION ENDPOINTS
// ============================================

// 1. INSCRIPTION
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, employeeId, fullName, bankWalletAddress } = req.body;

    if (!email || !password || !employeeId || !fullName || !bankWalletAddress) {
      return res.status(400).json({
        success: false,
        error: "Tous les champs sont requis"
      });
    }

    // Email déjà utilisé ?
    const existingUser = await pool.query(
      "SELECT id FROM employees WHERE email = $1",
      [email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Cet email est déjà utilisé"
      });
    }

    // employee_id déjà utilisé ?
    const existingEmployeeId = await pool.query(
      "SELECT id FROM employees WHERE employee_id = $1",
      [employeeId]
    );
    if (existingEmployeeId.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Cet identifiant employé est déjà utilisé"
      });
    }

    // Vérifier que la banque existe
    const bankCheck = await pool.query(
      "SELECT * FROM banks WHERE wallet_address = $1",
      [bankWalletAddress]
    );
    if (bankCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Banque non trouvée"
      });
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Générer un token de vérification
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Insérer l'utilisateur
    const result = await pool.query(`
      INSERT INTO employees 
      (email, password_hash, employee_id, full_name, bank_wallet_address, verification_token, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, full_name, bank_wallet_address
    `, [email, hashedPassword, employeeId, fullName, bankWalletAddress, verificationToken, false]);

    // ✅ Envoi email de bienvenue
    try {
      const bankInfo = await pool.query(
        "SELECT name FROM banks WHERE wallet_address = $1",
        [bankWalletAddress]
      );
      
      await emailService.sendWelcomeEmail(email, {
        fullName: fullName,
        email: email,
        bankName: bankInfo.rows[0]?.name || bankWalletAddress,
        verificationLink: `http://localhost:4200/verify-email?token=${verificationToken}`
      });
      console.log('✅ Email de bienvenue envoyé');
    } catch (emailErr) {
      console.error('❌ Erreur envoi email bienvenue:', emailErr.message);
    }

    res.json({
      success: true,
      message: "Inscription réussie ! Un email de vérification vous a été envoyé.",
      user: result.rows[0]
    });
  } catch (err) {
    console.error("❌ Erreur inscription:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 2. CONNEXION
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email et mot de passe requis"
      });
    }

    const result = await pool.query(`
      SELECT e.*, b.name as bank_name, b.country, b.currency 
      FROM employees e
      JOIN banks b ON e.bank_wallet_address = b.wallet_address
      WHERE e.email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Email ou mot de passe incorrect"
      });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: "Email ou mot de passe incorrect"
      });
    }

    if (!user.is_verified) {
      return res.status(401).json({
        success: false,
        error: "Compte non vérifié. Vérifiez votre email."
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        employeeId: user.employee_id,
        bankWalletAddress: user.bank_wallet_address,
        bankName: user.bank_name
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    delete user.password_hash;

    res.json({
      success: true,
      message: "Connexion réussie",
      token,
      user
    });
  } catch (err) {
    console.error("❌ Erreur connexion:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 3. MOT DE PASSE OUBLIÉ
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email requis"
      });
    }

    const result = await pool.query(
      "SELECT * FROM employees WHERE email = $1",
      [email]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 3600000);

      await pool.query(`
        UPDATE employees 
        SET reset_token = $1, reset_token_expiry = $2 
        WHERE id = $3
      `, [resetToken, resetExpiry, user.id]);

      const resetLink = `http://localhost:4200/reset-password?token=${resetToken}`;

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Réinitialisation de mot de passe',
        html: `<a href="${resetLink}">Cliquez ici</a>`
      });
    }

    res.json({
      success: true,
      message: "Si un compte existe, un email a été envoyé"
    });
  } catch (err) {
    console.error("❌ Erreur forgot password:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 4. RÉINITIALISATION
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const result = await pool.query(`
      SELECT * FROM employees 
      WHERE reset_token = $1 AND reset_token_expiry > NOW()
    `, [token]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Token invalide"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(`
      UPDATE employees 
      SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL 
      WHERE id = $2
    `, [hashedPassword, result.rows[0].id]);

    res.json({ success: true, message: "Mot de passe réinitialisé" });
  } catch (err) {
    console.error("❌ Erreur reset:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. VÉRIFICATION EMAIL
app.get("/api/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    const result = await pool.query(
      "SELECT * FROM employees WHERE verification_token = $1",
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: "Token invalide" });
    }

    await pool.query(`
      UPDATE employees 
      SET is_verified = true, verification_token = NULL 
      WHERE id = $1
    `, [result.rows[0].id]);

    res.json({ success: true, message: "Email vérifié !" });
  } catch (err) {
    console.error("❌ Erreur vérification:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. PROFIL
app.get("/api/auth/me", async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ success: false, error: "Token manquant" });

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ success: false, error: "Token invalide" });

    const result = await pool.query(`
      SELECT e.id, e.email, e.full_name, e.employee_id, 
             b.name as bank_name, b.wallet_address, b.country, b.currency
      FROM employees e
      JOIN banks b ON e.bank_wallet_address = b.wallet_address
      WHERE e.id = $1
    `, [user.id]);

    res.json({ success: true, user: result.rows[0] });
  });
});

  
  // Démarrer le cron job de mise à jour des taux
  console.log("\n🚀 Initialisation du cron job de taux de change...");
  startExchangeRateCron();
// ============================================
// SERVER
// ============================================

app.listen(PORT, () => {
  console.log("🏦 API RUNNING:", PORT);
});
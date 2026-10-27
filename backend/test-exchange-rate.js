#!/usr/bin/env node

/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║   Script de test - Mise à jour des taux de change       ║
 * ║   Usage: node test-exchange-rate.js                      ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

const ExchangeRateService = require('./services/exchange-rate.service');

async function runTest() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   🧪 TEST - EXCHANGE RATE SERVICE                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const service = new ExchangeRateService();

  try {
    // ============================================
    // 1. Récupérer les taux actuels sur le contrat
    // ============================================
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 ÉTAPE 1: Récupération des taux actuels (blockchain)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const currentEur = await service.getCurrentEurRate();
    const currentUsd = await service.getCurrentUsdRate();
    
    console.log(`EUR/TND actuel:  ${parseFloat(currentEur).toFixed(4)} TND`);
    console.log(`USD/TND actuel:  ${parseFloat(currentUsd).toFixed(4)} TND`);

    // ============================================
    // 2. Récupérer les taux de l'API externe
    // ============================================
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📡 ÉTAPE 2: Appel à l\'API ExchangeRate-API');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const { eurToTnd, usdToTnd } = await service.fetchExchangeRates();
    
    console.log(`EUR/TND depuis API: ${parseFloat(eurToTnd).toFixed(4)} TND`);
    console.log(`USD/TND depuis API: ${parseFloat(usdToTnd).toFixed(4)} TND`);

    // ============================================
    // 3. Mise à jour complète
    // ============================================
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔄 ÉTAPE 3: Mise à jour complète des taux');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const result = await service.updateAllRates();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ RÉSUMÉ DU TEST');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n✅ TEST RÉUSSI!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n╔═══════════════════════════════════════════════════════════╗');
    console.error('║   ❌ ERREUR LORS DU TEST                                  ║');
    console.error('╚═══════════════════════════════════════════════════════════╝\n');
    
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    process.exit(1);
  }
}

// Lancer le test
runTest();

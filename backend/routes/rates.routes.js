/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║   Routes API - Gestion des taux de change                ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

const express = require('express');
const router = express.Router();
const ExchangeRateService = require('../services/exchange-rate.service');

// Instance du service
const exchangeRateService = new ExchangeRateService();

/**
 * GET /api/rates/current
 * Retourne les taux actuels depuis la blockchain
 */
router.get('/current', async (req, res) => {
  try {
    exchangeRateService.log('📊 Récupération des taux actuels...', 'api');
    
    const eurToTnd = await exchangeRateService.getCurrentEurRate();
    const usdToTnd = await exchangeRateService.getCurrentUsdRate();

    exchangeRateService.log(`✅ Taux récupérés: EUR=${eurToTnd}, USD=${usdToTnd}`, 'success');

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        eurToTnd: parseFloat(eurToTnd).toFixed(4),
        usdToTnd: parseFloat(usdToTnd).toFixed(4)
      }
    });
  } catch (error) {
    exchangeRateService.log(`Erreur: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/rates/fetch
 * Récupère les taux depuis l'API externe (sans mise à jour blockchain)
 */
router.get('/fetch', async (req, res) => {
  try {
    exchangeRateService.log('🌍 Récupération des taux depuis l\'API externe...', 'api');
    
    const { eurToTnd, usdToTnd } = await exchangeRateService.fetchExchangeRates();

    exchangeRateService.log('✅ Taux récupérés avec succès', 'success');

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        eurToTnd: parseFloat(eurToTnd).toFixed(4),
        usdToTnd: parseFloat(usdToTnd).toFixed(4),
        source: 'ExchangeRate-API'
      }
    });
  } catch (error) {
    exchangeRateService.log(`Erreur: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/rates/update
 * Force une mise à jour immédiate des taux sur la blockchain
 */
router.post('/update', async (req, res) => {
  try {
    exchangeRateService.log('🔄 Mise à jour forcée des taux demandée...', 'api');
    
    const result = await exchangeRateService.updateAllRates();

    exchangeRateService.log('✅ Mise à jour réussie', 'success');

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: result
    });
  } catch (error) {
    exchangeRateService.log(`Erreur: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/rates/status
 * Retourne le statut du service de taux
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    status: 'active',
    service: 'ExchangeRateService',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      current: 'GET /api/rates/current (Taux blockchain actuels)',
      fetch: 'GET /api/rates/fetch (Taux API externe)',
      update: 'POST /api/rates/update (Mise à jour forcée)',
      status: 'GET /api/rates/status (Police du service)'
    }
  });
});

module.exports = router;

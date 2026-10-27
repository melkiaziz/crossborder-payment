/**
 * ╔════════════════════════════════════════════════════════════╗
 * ║   Service de mise à jour des taux de change EUR/USD/TND   ║
 * ╚════════════════════════════════════════════════════════════╝
 */

const axios = require('axios');
const { ethers } = require('ethers');
require('dotenv').config({ path: '.env' });

class ExchangeRateService {
  constructor() {
    this.API_KEY = process.env.EXCHANGE_RATE_API_KEY;
    this.API_BASE_URL = 'https://v6.exchangerate-api.com/v6';
    
    // Configuration blockchain
    const provider = new ethers.JsonRpcProvider(
      process.env.RPC_HTTP_URL || process.env.RPC_URL || 'http://127.0.0.1:8545'
    );
    const privateKey = process.env.PRIVATE_KEY_OWNER || process.env.CENTRAL_BANK_PRIVATE_KEY;
    
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.provider = provider;
    
    // Charger le contrat
    this.contractAddress = process.env.CONTRACT_ADDRESS;
    this.abi = [
      'function updateEurRate(uint256) external',
      'function updateUsdRate(uint256) external',
      'function eurToTndRate() external view returns (uint256)',
      'function usdToTndRate() external view returns (uint256)'
    ];
    
    this.contract = new ethers.Contract(this.contractAddress, this.abi, this.wallet);
  }

  /**
   * Formate les logs avec style
   */
  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    const icons = {
      info: '💬',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      chain: '⛓️',
      api: '🌍',
      time: '⏱️'
    };
    
    const colors = {
      info: '\x1b[36m',      // Cyan
      success: '\x1b[32m',   // Green
      error: '\x1b[31m',     // Red
      warning: '\x1b[33m',   // Yellow
      chain: '\x1b[35m',     // Magenta
      api: '\x1b[34m',       // Blue
      time: '\x1b[37m',      // White
      reset: '\x1b[0m'
    };
    
    const icon = icons[type] || '•';
    const color = colors[type] || colors.info;
    console.log(`${color}[${timestamp}] ${icon} ${message}${colors.reset}`);
  }

  /**
   * Récupère les taux depuis ExchangeRate-API
   */
  async fetchExchangeRates() {
    try {
      this.log('Récupération des taux depuis ExchangeRate-API...', 'api');
      
      // Récupérer les taux EUR => TND et USD => TND
      const [eurResponse, usdResponse] = await Promise.all([
        axios.get(`${this.API_BASE_URL}/${this.API_KEY}/latest/EUR`),
        axios.get(`${this.API_BASE_URL}/${this.API_KEY}/latest/USD`)
      ]);

      if (eurResponse.data.result !== 'success' || usdResponse.data.result !== 'success') {
        throw new Error('Erreur API: réponse invalide');
      }

      const eurToTnd = eurResponse.data.conversion_rates.TND;
      const usdToTnd = usdResponse.data.conversion_rates.TND;

      if (!eurToTnd || !usdToTnd || eurToTnd <= 0 || usdToTnd <= 0) {
        throw new Error('Taux invalides reçus de l\'API');
      }

      this.log(`✨ Taux récupérés avec succès:`, 'success');
      this.log(`  1 EUR = ${eurToTnd} TND`, 'info');
      this.log(`  1 USD = ${usdToTnd} TND`, 'info');

      return { eurToTnd, usdToTnd };
    } catch (error) {
      this.log(`Erreur lors de la récupération des taux: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Récupère le taux actuel EUR depuis le contrat
   */
  async getCurrentEurRate() {
    try {
      const rate = await this.contract.eurToTndRate();
      return ethers.formatUnits(rate, 18);
    } catch (error) {
      this.log(`Erreur lors de la lecture du taux EUR: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Récupère le taux actuel USD depuis le contrat
   */
  async getCurrentUsdRate() {
    try {
      const rate = await this.contract.usdToTndRate();
      return ethers.formatUnits(rate, 18);
    } catch (error) {
      this.log(`Erreur lors de la lecture du taux USD: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Met à jour le taux EUR sur la blockchain
   */
  async updateEurRateOnChain(newRate) {
    try {
      this.log('🔄 Mise à jour EUR/TND sur blockchain...', 'chain');
      
      // Récupérer l'ancien taux
      const oldRate = await this.getCurrentEurRate();
      const oldRateFormatted = parseFloat(oldRate).toFixed(4);
      const newRateFormatted = parseFloat(newRate).toFixed(4);

      this.log(`Ancien taux: ${oldRateFormatted} TND`, 'info');
      this.log(`Nouveau taux: ${newRateFormatted} TND`, 'info');

      // Vérifier si le taux a changé
      if (Math.abs(parseFloat(oldRate) - newRate) < 0.0001) {
        this.log('Taux identique, pas de mise à jour nécessaire', 'warning');
        return null;
      }

      // Convertir en uint256
      const newRateUint = ethers.parseUnits(newRate.toString(), 18);

      // Envoyer la transaction
      this.log('📤 Envoi de la transaction blockchain...', 'chain');
      const tx = await this.contract.updateEurRate(newRateUint);
      this.log(`Transaction ID: ${tx.hash}`, 'info');

      // Attendre la confirmation
      this.log('⏳ Attente de la confirmation (1 bloc)...', 'time');
      const receipt = await tx.wait(1);

      this.log(`✅ Confirmé au bloc ${receipt.blockNumber}`, 'success');

      return {
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        oldRate: oldRateFormatted,
        newRate: newRateFormatted,
        currency: 'EUR'
      };
    } catch (error) {
      this.log(`❌ Erreur mise à jour EUR: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Met à jour le taux USD sur la blockchain
   */
  async updateUsdRateOnChain(newRate) {
    try {
      this.log('🔄 Mise à jour USD/TND sur blockchain...', 'chain');
      
      // Récupérer l'ancien taux
      const oldRate = await this.getCurrentUsdRate();
      const oldRateFormatted = parseFloat(oldRate).toFixed(4);
      const newRateFormatted = parseFloat(newRate).toFixed(4);

      this.log(`Ancien taux: ${oldRateFormatted} TND`, 'info');
      this.log(`Nouveau taux: ${newRateFormatted} TND`, 'info');

      // Vérifier si le taux a changé
      if (Math.abs(parseFloat(oldRate) - newRate) < 0.0001) {
        this.log('Taux identique, pas de mise à jour nécessaire', 'warning');
        return null;
      }

      // Convertir en uint256
      const newRateUint = ethers.parseUnits(newRate.toString(), 18);

      // Envoyer la transaction
      this.log('📤 Envoi de la transaction blockchain...', 'chain');
      const tx = await this.contract.updateUsdRate(newRateUint);
      this.log(`Transaction ID: ${tx.hash}`, 'info');

      // Attendre la confirmation
      this.log('⏳ Attente de la confirmation (1 bloc)...', 'time');
      const receipt = await tx.wait(1);

      this.log(`✅ Confirmé au bloc ${receipt.blockNumber}`, 'success');

      return {
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        oldRate: oldRateFormatted,
        newRate: newRateFormatted,
        currency: 'USD'
      };
    } catch (error) {
      this.log(`❌ Erreur mise à jour USD: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Met à jour tous les taux (EUR et USD)
   */
  async updateAllRates() {
    const startTime = Date.now();
    
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   MISE À JOUR TAUX DE CHANGE          ║');
    console.log('╚════════════════════════════════════════╝\n');

    try {
      // Récupérer les taux de l'API
      const { eurToTnd, usdToTnd } = await this.fetchExchangeRates();

      const results = {
        success: true,
        timestamp: new Date().toISOString(),
        updates: []
      };

      // Mise à jour EUR
      this.log('\n--- EUR/TND ---', 'info');
      const eurResult = await this.updateEurRateOnChain(eurToTnd);
      if (eurResult) {
        results.updates.push(eurResult);
      }

      // Mise à jour USD
      this.log('\n--- USD/TND ---', 'info');
      const usdResult = await this.updateUsdRateOnChain(usdToTnd);
      if (usdResult) {
        results.updates.push(usdResult);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log('\n═══════════════════════════════════════');
      this.log(`✅ MISE À JOUR TERMINÉE (${duration}s)`, 'success');
      console.log('═══════════════════════════════════════\n');

      return results;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log('\n═══════════════════════════════════════');
      this.log(`❌ ERREUR LORS DE LA MISE À JOUR (${duration}s)`, 'error');
      console.log('═══════════════════════════════════════\n');
      
      throw error;
    }
  }
}

module.exports = ExchangeRateService;

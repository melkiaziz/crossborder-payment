/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║   Cron Job - Mise à jour automatique des taux de change  ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

const cron = require('node-cron');
const ExchangeRateService = require('../services/exchange-rate.service');

let cronTask = null;

/**
 * Démarre le cron job pour une mise à jour automatique des taux
 */
async function startExchangeRateCron() {
  const exchangeRateService = new ExchangeRateService();
  
  // Format cron: 'minute hour day month day_of_week'
  // '0 0 * * *' = À minuit tous les jours
  const cronSchedule = process.env.EXCHANGE_RATE_CRON || '0 0 * * *';
  const timezone = process.env.EXCHANGE_RATE_TIMEZONE || 'Africa/Tunis';
  
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   🚀 Démarrage du Cron Job - Taux de Change           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  console.log(`📅 Schedule: ${cronSchedule}`);
  console.log(`🕐 Timezone: ${timezone}`);
  console.log(`⏰ Prochain exécution: ${getNextExecutionTime(cronSchedule)}\n`);

  try {
    // Créer et démarrer le cron job
    cronTask = cron.schedule(cronSchedule, async () => {
      console.log('\n───────────────────────────────────────────────────────────');
      console.log('🔔 Exécution du Cron Job (Mise à jour des taux)...');
      console.log('───────────────────────────────────────────────────────────');
      
      try {
        await exchangeRateService.updateAllRates();
        console.log('✅ Cron job: Mise à jour réussie\n');
      } catch (error) {
        console.error('❌ Cron job: Erreur lors de la mise à jour:', error.message);
        console.error(error.stack);
      }
    }, {
      scheduled: true,
      timezone: timezone
    });

    console.log('✅ Cron job démarré avec succès!\n');

    // Optionnel: Mise à jour au démarrage si RUN_ON_STARTUP = true
    if (process.env.RUN_ON_STARTUP === 'true') {
      console.log('🚀 RUN_ON_STARTUP activé - Mise à jour immédiate...\n');
      try {
        await exchangeRateService.updateAllRates();
      } catch (error) {
        console.error('❌ Erreur lors de la mise à jour au démarrage:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors du démarrage du cron job:', error.message);
    console.error(error.stack);
  }
}

/**
 * Arrête le cron job
 */
function stopExchangeRateCron() {
  if (cronTask) {
    cronTask.stop();
    cronTask.destroy();
    console.log('⛔ Cron job arrêté');
  }
}

/**
 * Calcule le temps de la prochaine exécution (approximatif)
 */
function getNextExecutionTime(cronSchedule) {
  // Parse simple: si c'est '0 0 * * *', c'est minuit
  if (cronSchedule === '0 0 * * *') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toLocaleString('fr-FR');
  }
  return 'Prochaine exécution selon le schedule';
}

module.exports = {
  startExchangeRateCron,
  stopExchangeRateCron
};

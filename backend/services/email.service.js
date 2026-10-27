const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // 🔍 DEBUG - Afficher les variables
    console.log('=================================');
    console.log('📧 EMAIL SERVICE INITIALIZATION');
    console.log('=================================');
    console.log('EMAIL_USER:', process.env.EMAIL_USER || '❌ UNDEFINED');
    console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ Défini' : '❌ UNDEFINED');
    console.log('=================================');

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Vérifier la connexion
    this.transporter.verify((error, success) => {
      if (error) {
        console.log("❌ Erreur configuration email:", error.message);
      } else {
        console.log("✅ Serveur email prêt à envoyer des messages");
      }
    });
  }

  // ============================================
  // EMAIL: Nouveau transfert créé
  // ============================================
  async sendTransferCreatedEmail(to, data) {
    const textContent = `
NOUVEAU TRANSFERT CRÉÉ
═══════════════════════

De : ${data.fromBank}
Vers : ${data.toBank}
Montant : ${data.amount} TND
Statut : ${data.status === 'pending' ? 'En attente' : 'Exécuté'}
Date : ${new Date().toLocaleString('fr-FR')}

${data.status === 'pending' 
  ? '⏳ Ce transfert est en attente d\'approbation par la Banque Centrale.' 
  : '✅ Ce transfert a été exécuté immédiatement.'}

───────────────────────────
CrossBorder Payment - Application de transferts interbancaires
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nouveau transfert</title>
      </head>
      <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:20px auto; background:white; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0d6efd; padding:20px; text-align:center; border-radius:8px 8px 0 0;">
              <h1 style="color:white; margin:0; font-size:24px;">💰 Nouveau transfert</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding:30px;">
              <p style="font-size:16px; margin:0 0 20px 0;">Bonjour,</p>
              <p style="font-size:16px; margin:0 0 20px 0;">Un nouveau transfert a été créé :</p>
              
              <table width="100%" cellpadding="10" style="background:#f8f9fa; border-radius:5px; margin-bottom:20px;">
                <tr>
                  <td style="font-weight:bold; width:120px;">De :</td>
                  <td>${data.fromBank}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;">Vers :</td>
                  <td>${data.toBank}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;">Montant :</td>
                  <td style="font-size:20px; font-weight:bold; color:#0d6efd;">${data.amount} TND</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;">Statut :</td>
                  <td>${data.status === 'pending' ? '⏳ En attente' : '✅ Exécuté'}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;">Date :</td>
                  <td>${new Date().toLocaleString('fr-FR')}</td>
                </tr>
              </table>
              
              ${data.status === 'pending' 
                ? '<p style="color:#856404; background:#fff3cd; padding:15px; border-radius:5px;">⏳ Ce transfert est en attente d\'approbation par la Banque Centrale.</p>' 
                : '<p style="color:#155724; background:#d4edda; padding:15px; border-radius:5px;">✅ Ce transfert a été exécuté immédiatement.</p>'}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fa; padding:15px; text-align:center; color:#6c757d; font-size:12px; border-radius:0 0 8px 8px;">
              CrossBorder Payment - Application de transferts interbancaires
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"CrossBorder Payment" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: '💰 Nouveau transfert créé',
      text: textContent,
      html: htmlContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email transfert créé envoyé:', info.messageId);
      return info;
    } catch (error) {
      console.error('❌ Erreur envoi email transfert:', error.message);
      return null;
    }
  }

  // ============================================
  // EMAIL: Transfert approuvé
  // ============================================
  async sendTransferApprovedEmail(to, data) {
    const textContent = `
TRANSFERT APPROUVÉ
══════════════════

De : ${data.fromBank}
Vers : ${data.toBank}
Montant : ${data.amount} TND
Date d'approbation : ${new Date().toLocaleString('fr-FR')}

✅ Ce transfert a été approuvé par la Banque Centrale.

───────────────────────────
CrossBorder Payment - Application de transferts interbancaires
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Transfert approuvé</title>
      </head>
      <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:20px auto; background:white; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#198754; padding:20px; text-align:center; border-radius:8px 8px 0 0;">
              <h1 style="color:white; margin:0; font-size:24px;">✅ Transfert approuvé</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding:30px;">
              <p style="font-size:16px; margin:0 0 20px 0;">Bonjour,</p>
              <p style="font-size:16px; margin:0 0 20px 0;">Votre transfert a été approuvé par la Banque Centrale :</p>
              
              <table width="100%" cellpadding="10" style="background:#f8f9fa; border-radius:5px; margin-bottom:20px;">
                <tr>
                  <td style="font-weight:bold; width:120px;">De :</td>
                  <td>${data.fromBank}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;">Vers :</td>
                  <td>${data.toBank}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;">Montant :</td>
                  <td style="font-size:20px; font-weight:bold; color:#198754;">${data.amount} TND</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;">Date :</td>
                  <td>${new Date().toLocaleString('fr-FR')}</td>
                </tr>
              </table>
              
              <p style="color:#155724; background:#d4edda; padding:15px; border-radius:5px;">
                ✅ Ce transfert a été approuvé et exécuté.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fa; padding:15px; text-align:center; color:#6c757d; font-size:12px; border-radius:0 0 8px 8px;">
              CrossBorder Payment - Application de transferts interbancaires
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"CrossBorder Payment" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: '✅ Transfert approuvé',
      text: textContent,
      html: htmlContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email transfert approuvé envoyé:', info.messageId);
      return info;
    } catch (error) {
      console.error('❌ Erreur envoi email approbation:', error.message);
      return null;
    }
  }

  // ============================================
  // EMAIL: Solde ajouté
  // ============================================
  async sendBalanceAddedEmail(to, data) {
    const textContent = `
SOLDE AJOUTÉ
════════════

Banque : ${data.bankName}
Montant ajouté : ${data.amount} TND
Nouveau solde : ${data.newBalance} TND
Date : ${new Date().toLocaleString('fr-FR')}

💰 Une opération de crédit a été effectuée sur votre compte.

───────────────────────────
CrossBorder Payment - Application de transferts interbancaires
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Solde ajouté</title>
      </head>
      <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:20px auto; background:white; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#198754; padding:20px; text-align:center; border-radius:8px 8px 0 0;">
              <h1 style="color:white; margin:0; font-size:24px;">💰 Solde ajouté</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding:30px;">
              <p style="font-size:16px; margin:0 0 20px 0;">Bonjour,</p>
              <p style="font-size:16px; margin:0 0 20px 0;">Un montant a été ajouté à votre banque :</p>
              
              <table width="100%" cellpadding="10" style="background:#f8f9fa; border-radius:5px; margin-bottom:20px;">
                <tr>
                  <td style="font-weight:bold; width:150px;">Banque :</td>
                  <td>${data.bankName}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;">Montant ajouté :</td>
                  <td style="font-size:20px; font-weight:bold; color:#198754;">${data.amount} TND</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;">Nouveau solde :</td>
                  <td>${data.newBalance} TND</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;">Date :</td>
                  <td>${new Date().toLocaleString('fr-FR')}</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fa; padding:15px; text-align:center; color:#6c757d; font-size:12px; border-radius:0 0 8px 8px;">
              CrossBorder Payment - Application de transferts interbancaires
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"CrossBorder Payment" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: '💰 Solde ajouté',
      text: textContent,
      html: htmlContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email solde ajouté envoyé:', info.messageId);
      return info;
    } catch (error) {
      console.error('❌ Erreur envoi email solde:', error.message);
      return null;
    }
  }

  // ============================================
  // EMAIL: Bienvenue
  // ============================================
  async sendWelcomeEmail(to, data) {
    const textContent = `
BIENVENUE SUR CROSSBORDER PAYMENT
═════════════════════════════════

Bonjour ${data.fullName},

Votre compte a été créé avec succès !

Email : ${data.email}
Banque : ${data.bankName}

Pour activer votre compte, veuillez cliquer sur le lien ci-dessous :
${data.verificationLink}

───────────────────────────
CrossBorder Payment - Application de transferts interbancaires
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue</title>
      </head>
      <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:20px auto; background:white; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0d6efd; padding:20px; text-align:center; border-radius:8px 8px 0 0;">
              <h1 style="color:white; margin:0; font-size:24px;">🎉 Bienvenue !</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding:30px;">
              <p style="font-size:16px; margin:0 0 20px 0;">Bonjour ${data.fullName},</p>
              <p style="font-size:16px; margin:0 0 20px 0;">Votre compte a été créé avec succès !</p>
              
              <table width="100%" cellpadding="10" style="background:#f8f9fa; border-radius:5px; margin-bottom:20px;">
                <tr>
                  <td style="font-weight:bold; width:100px;">Email :</td>
                  <td>${data.email}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;">Banque :</td>
                  <td>${data.bankName}</td>
                </tr>
              </table>
              
              <p style="margin:20px 0;">Pour activer votre compte, veuillez cliquer sur le bouton ci-dessous :</p>
              
              <table cellpadding="0" cellspacing="0" style="margin:20px auto;">
                <tr>
                  <td style="background-color:#0d6efd; border-radius:5px;">
                    <a href="${data.verificationLink}" style="display:inline-block; padding:12px 24px; color:white; text-decoration:none; font-weight:bold;">
                      Vérifier mon compte
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fa; padding:15px; text-align:center; color:#6c757d; font-size:12px; border-radius:0 0 8px 8px;">
              CrossBorder Payment - Application de transferts interbancaires
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"CrossBorder Payment" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: '🎉 Bienvenue sur CrossBorder Payment',
      text: textContent,
      html: htmlContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email bienvenue envoyé:', info.messageId);
      return info;
    } catch (error) {
      console.error('❌ Erreur envoi email bienvenue:', error.message);
      return null;
    }
  }

  // ============================================
  // EMAIL: Alerte de taux
  // ============================================
  async sendRateAlertEmail(to, data) {
    const textContent = `
ALERTE TAUX DE CHANGE
═════════════════════

Devise : ${data.currency}/TND
Seuil : ${data.direction} ${data.threshold}
Taux actuel : ${data.currentRate}
Date : ${new Date().toLocaleString('fr-FR')}

Ceci est une notification automatique.
`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Alerte taux de change</title>
      </head>
      <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:20px auto; background:white; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#ffc107; padding:20px; text-align:center; border-radius:8px 8px 0 0;">
              <h1 style="color:#212529; margin:0; font-size:24px;">💱 Alerte taux de change</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;">
              <p>La condition d'alerte a été atteinte :</p>
              <ul>
                <li>Devise : ${data.currency}/TND</li>
                <li>Seuil : ${data.direction} ${data.threshold}</li>
                <li>Taux actuel : ${data.currentRate}</li>
                <li>Date : ${new Date().toLocaleString('fr-FR')}</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td style="background:#f8f9fa; padding:15px; text-align:center; color:#6c757d; font-size:12px; border-radius:0 0 8px 8px;">
              CrossBorder Payment - Alerte taux de change
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"CrossBorder Payment" <${process.env.EMAIL_USER}>`,
      to,
      subject: `🚨 Alerte taux ${data.currency}/TND`,
      text: textContent,
      html: htmlContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email alerte taux envoyé:', info.messageId);
      return info;
    } catch (error) {
      console.error('❌ Erreur envoi email alerte taux:', error.message);
      return null;
    }
  }
}

module.exports = new EmailService();
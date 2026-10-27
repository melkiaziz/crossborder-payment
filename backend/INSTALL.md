# 🚀 Guide d'Installation Complet - Backend CrossBorderPayment

## 📦 Fichiers Fournis

1. **server.js** - Serveur API complet
2. **package.json** - Configuration et dépendances
3. **.env** - Variables d'environnement
4. **INSTALL.md** - Ce fichier

---

## ✅ INSTALLATION ÉTAPE PAR ÉTAPE

### **Étape 1 : Créer le dossier backend (si pas déjà fait)**

```bash
cd C:\Users\MSI\Desktop\stage
mkdir backend
cd backend
```

### **Étape 2 : Copier TOUS les fichiers téléchargés**

Copiez dans `C:\Users\MSI\Desktop\stage\backend\` :
- ✅ server.js
- ✅ package.json  
- ✅ .env

### **Étape 3 : Installer les dépendances**

```bash
npm install
```

Cela va installer :
- express
- ethers
- dotenv
- cors
- body-parser

### **Étape 4 : Créer le dossier config**

```bash
mkdir config
```

### **Étape 5 : Copier l'ABI du contrat**

```bash
copy ..\blockchain2\artifacts\contracts\CrossBorderPayments.sol\CrossBorderPayment.json config\
```

**⚠️ IMPORTANT : Notez le "s" dans CrossBorderPayments !**

### **Étape 6 : Vérifier que tout est en place**

```bash
# Vérifier le fichier .env
type .env

# Vérifier l'ABI
dir config\CrossBorderPayment.json

# Vérifier package.json
type package.json
```

### **Étape 7 : Démarrer Hardhat node (Terminal 1)**

```bash
cd C:\Users\MSI\Desktop\stage\blockchain2
npx hardhat node
```

**Laissez ce terminal ouvert !**

### **Étape 8 : Lancer le backend (Terminal 2)**

```bash
cd C:\Users\MSI\Desktop\stage\backend
npm start
```

---

## 🎯 RÉSULTAT ATTENDU

```
🔍 DEBUG - Variables d'environnement:
PORT: 3000
RPC_URL: http://127.0.0.1:8545
CONTRACT_ADDRESS: 0x5FbDB2315678afecb367f032d93F642f64180aa3
CENTRAL_BANK_PRIVATE_KEY: ✅ Défini
📄 ABI chargé depuis config/CrossBorderPayment.json

🏦 ========================================
   CrossBorderPayment API Started
========================================
📡 Server running on: http://localhost:3000
🔗 Contract address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
🌐 RPC URL: http://127.0.0.1:8545
========================================

📚 Available endpoints:
  GET  / - API documentation
  GET  /api/info - Contract info
  POST /api/banks/register - Register bank
  POST /api/transfers - Create transfer
  GET  /api/transfers/pending - Pending transfers
```

---

## 📁 STRUCTURE FINALE

```
C:\Users\MSI\Desktop\stage\
├── blockchain2\
│   ├── contracts\
│   │   └── CrossBorderPayments.sol
│   ├── artifacts\
│   │   └── contracts\
│   │       └── CrossBorderPayments.sol\
│   │           └── CrossBorderPayment.json
│   ├── test\
│   ├── scripts\
│   └── hardhat.config.js
│
└── backend\
    ├── server.js          ← API REST
    ├── package.json       ← Configuration
    ├── .env               ← Variables d'environnement
    ├── config\
    │   └── CrossBorderPayment.json  ← ABI du contrat
    └── node_modules\      ← Dépendances (après npm install)
```

---

## 🧪 TESTER L'API

### **Test 1 : Navigateur**

Ouvrez : **http://localhost:3000**

Vous verrez la liste de tous les endpoints disponibles.

### **Test 2 : PowerShell**

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/info
```

### **Test 3 : Postman**

```
GET http://localhost:3000/api/info
```

**Réponse attendue :**
```json
{
  "success": true,
  "data": {
    "contractAddress": "0x5FbDB...",
    "owner": "0xf39Fd...",
    "rates": {
      "eurToTnd": "3.3",
      "usdToTnd": "3.1"
    },
    "transferFeePercent": 1,
    "dailyLimit": "10000.0",
    "approvalThreshold": "5000.0",
    "statistics": {
      "pendingTransfers": 0,
      "totalTransactions": 0
    }
  }
}
```

---

## 🔧 DÉPANNAGE

### **Erreur : "Cannot find module './config/CrossBorderPayment.json'"**

**Solution :**
```bash
# Copiez l'ABI
copy ..\blockchain2\artifacts\contracts\CrossBorderPayments.sol\CrossBorderPayment.json config\

# Vérifiez
dir config\
```

### **Erreur : "CENTRAL_BANK_PRIVATE_KEY is undefined"**

**Solution :**
```bash
# Vérifiez le .env
type .env

# Il doit contenir EXACTEMENT :
PORT=3000
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
CENTRAL_BANK_PRIVATE_KEY=
```

### **Erreur : "connect ECONNREFUSED 127.0.0.1:8545"**

**Solution :**
```bash
# Lancez Hardhat node dans un autre terminal
cd C:\Users\MSI\Desktop\stage\blockchain2
npx hardhat node
```

---

## 📚 ENDPOINTS DISPONIBLES

### **Info & Configuration**
- `GET /` - Documentation API
- `GET /api/info` - Info du contrat
- `GET /api/rates` - Taux de change
- `GET /api/fees` - Frais de transfert

### **Gestion des Banques**
- `POST /api/banks/register` - Enregistrer une banque
- `GET /api/banks/:address` - Info d'une banque
- `POST /api/banks/:address/balance` - Ajouter du solde
- `GET /api/banks/:address/balance` - Consulter le solde

### **Transferts**
- `POST /api/transfers` - Créer un transfert
- `GET /api/transfers/pending` - Transferts en attente
- `POST /api/transfers/approve/:id` - Approuver un transfert
- `GET /api/transfers/history` - Historique
- `GET /api/transfers/count` - Nombre de transactions

### **Blacklist**
- `POST /api/blacklist/:address` - Ajouter à la blacklist
- `DELETE /api/blacklist/:address` - Retirer de la blacklist
- `GET /api/blacklist/:address` - Vérifier si blacklisté

### **Taux & Frais**
- `GET /api/rates` - Taux de change dynamiques (Forex en temps réel)
- `GET /api/rates/history?currency=EUR|USD&limit=100` - Historique des fluctuations
- `POST /api/rates/alerts` - Créer une alerte taux (body: currency, threshold, direction, email)
- `GET /api/rates/alerts` - Voir les alertes en cours
- `PUT /api/rates/eur` - Forcer la mise à jour manuelle EUR/TND (smart contract)
- `PUT /api/rates/usd` - Forcer la mise à jour manuelle USD/TND (smart contract)
- `PUT /api/fees` - Mettre à jour les frais

---

## 🎉 FÉLICITATIONS !

Une fois le backend démarré, vous avez :
- ✅ Smart contract déployé
- ✅ Tests qui passent à 100%
- ✅ Backend API fonctionnel
- ✅ 20+ endpoints REST

**Prochaines étapes possibles :**
1. Tester avec Postman
2. Créer un frontend React
3. Déployer sur testnet
4. Configurer un pipeline CI/CD

---

## 💬 BESOIN D'AIDE ?

Si vous rencontrez un problème :
1. Vérifiez que Hardhat node tourne
2. Vérifiez que le fichier .env est correct
3. Vérifiez que l'ABI est dans config/
4. Relancez `npm start`

**Commandes de diagnostic :**
```bash
# Vérifier les processus Node
tasklist | findstr node

# Vérifier le port 3000
netstat -ano | findstr :3000

# Tuer les processus Node si besoin
taskkill /F /IM node.exe
```

🚀 **Bon développement !**

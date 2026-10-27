const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossBorderPayment Contract - Tests Complets", function () {
  let crossBorderPayment;
  let owner;
  let bankTunisia;
  let bankFrance;
  let bankUSA;
  let unauthorizedUser;

  const INITIAL_BALANCE = ethers.parseEther("100000");
  const DAILY_LIMIT = ethers.parseEther("10000");
  const APPROVAL_THRESHOLD = ethers.parseEther("5000");

  beforeEach(async function () {
    [owner, bankTunisia, bankFrance, bankUSA, unauthorizedUser] = await ethers.getSigners();

    const CrossBorderPayment = await ethers.getContractFactory("CrossBorderPayment");
    crossBorderPayment = await CrossBorderPayment.deploy();
    await crossBorderPayment.waitForDeployment();

    await crossBorderPayment.registerBank(
      bankTunisia.address,
      "Banque Centrale de Tunisie",
      "Tunisia",
      "TND"
    );

    await crossBorderPayment.registerBank(
      bankFrance.address,
      "Banque de France",
      "France",
      "EUR"
    );

    await crossBorderPayment.registerBank(
      bankUSA.address,
      "Federal Reserve",
      "USA",
      "USD"
    );

    await crossBorderPayment.addBalance(bankTunisia.address, INITIAL_BALANCE);
    await crossBorderPayment.addBalance(bankFrance.address, INITIAL_BALANCE);
    await crossBorderPayment.addBalance(bankUSA.address, INITIAL_BALANCE);
  });

  describe("Déploiement et Configuration Initiale", function () {
    it("✅ Devrait déployer le contrat avec succès", async function () {
      const address = await crossBorderPayment.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
    });

    it("✅ Devrait définir le bon propriétaire (Central Bank)", async function () {
      expect(await crossBorderPayment.owner()).to.equal(owner.address);
    });

    it("✅ Devrait initialiser les taux de change par défaut", async function () {
      expect(await crossBorderPayment.eurToTndRate()).to.equal(ethers.parseEther("3.3"));
      expect(await crossBorderPayment.usdToTndRate()).to.equal(ethers.parseEther("3.1"));
    });

    it("✅ Devrait initialiser les frais de transfert à 1%", async function () {
      const fee = await crossBorderPayment.transferFeePercent();
      expect(Number(fee)).to.equal(1);
    });

    it("✅ Devrait initialiser la limite quotidienne", async function () {
      expect(await crossBorderPayment.dailyLimit()).to.equal(DAILY_LIMIT);
    });

    it("✅ Devrait initialiser le seuil d'approbation", async function () {
      expect(await crossBorderPayment.approvalThreshold()).to.equal(APPROVAL_THRESHOLD);
    });
  });

  describe("Enregistrement des Banques", function () {
    it("✅ Devrait enregistrer une banque correctement", async function () {
      const newBank = unauthorizedUser;
      
      await crossBorderPayment.registerBank(
        newBank.address,
        "Banque Test",
        "Test Country",
        "EUR"
      );

      const bank = await crossBorderPayment.banks(newBank.address);
      expect(bank.name).to.equal("Banque Test");
      expect(bank.country).to.equal("Test Country");
      expect(bank.currency).to.equal("EUR");
      expect(bank.isRegistered).to.equal(true);
      expect(Number(bank.balance)).to.equal(0);
    });

    it("❌ Ne devrait pas permettre à un non-owner d'enregistrer une banque", async function () {
      try {
        await crossBorderPayment.connect(bankTunisia).registerBank(
          unauthorizedUser.address,
          "Fake Bank",
          "Fake Country",
          "EUR"
        );
        expect.fail("La transaction aurait dû échouer");
      } catch (error) {
        expect(error.message).to.include("Only Central Bank allowed");
      }
    });

    it("✅ Devrait permettre d'ajouter du solde à une banque", async function () {
      const addAmount = ethers.parseEther("50000");
      
      await crossBorderPayment.addBalance(bankTunisia.address, addAmount);
      
      const balance = await crossBorderPayment.getBalance(bankTunisia.address);
      expect(balance).to.equal(INITIAL_BALANCE + addAmount);
    });

    it("❌ Ne devrait pas ajouter de solde à une banque non enregistrée", async function () {
      try {
        await crossBorderPayment.addBalance(unauthorizedUser.address, ethers.parseEther("1000"));
        expect.fail("La transaction aurait dû échouer");
      } catch (error) {
        expect(error.message).to.include("Not registered");
      }
    });
  });

  describe("Système de Blacklist (Anti-Blanchiment)", function () {
    it("✅ Devrait blacklister une banque", async function () {
      await crossBorderPayment.blacklistBank(bankTunisia.address);
      expect(await crossBorderPayment.blacklisted(bankTunisia.address)).to.equal(true);
    });

    it("✅ Devrait retirer une banque de la blacklist", async function () {
      await crossBorderPayment.blacklistBank(bankTunisia.address);
      await crossBorderPayment.removeFromBlacklist(bankTunisia.address);
      expect(await crossBorderPayment.blacklisted(bankTunisia.address)).to.equal(false);
    });

    it("❌ Ne devrait pas permettre un transfert depuis une banque blacklistée", async function () {
      await crossBorderPayment.blacklistBank(bankTunisia.address);
      
      try {
        await crossBorderPayment.connect(bankTunisia).transfer(
          bankFrance.address,
          ethers.parseEther("1000")
        );
        expect.fail("La transaction aurait dû échouer");
      } catch (error) {
        expect(error.message).to.include("Sender blacklisted");
      }
    });

    it("❌ Ne devrait pas permettre un transfert vers une banque blacklistée", async function () {
      await crossBorderPayment.blacklistBank(bankFrance.address);
      
      try {
        await crossBorderPayment.connect(bankTunisia).transfer(
          bankFrance.address,
          ethers.parseEther("1000")
        );
        expect.fail("La transaction aurait dû échouer");
      } catch (error) {
        expect(error.message).to.include("Receiver blacklisted");
      }
    });

    it("❌ Seul l'owner peut blacklister", async function () {
      try {
        await crossBorderPayment.connect(bankTunisia).blacklistBank(bankFrance.address);
        expect.fail("La transaction aurait dû échouer");
      } catch (error) {
        expect(error.message).to.include("Only Central Bank allowed");
      }
    });
  });

  describe("Gestion des Taux de Change", function () {
    it("✅ Devrait mettre à jour le taux EUR/TND", async function () {
      const newRate = ethers.parseEther("3.5");
      await crossBorderPayment.updateEurRate(newRate);
      expect(await crossBorderPayment.eurToTndRate()).to.equal(newRate);
    });

    it("✅ Devrait mettre à jour le taux USD/TND", async function () {
      const newRate = ethers.parseEther("3.2");
      await crossBorderPayment.updateUsdRate(newRate);
      expect(await crossBorderPayment.usdToTndRate()).to.equal(newRate);
    });

    it("❌ Seul l'owner peut mettre à jour les taux", async function () {
      try {
        await crossBorderPayment.connect(bankTunisia).updateEurRate(ethers.parseEther("4.0"));
        expect.fail("La transaction aurait dû échouer");
      } catch (error) {
        expect(error.message).to.include("Only Central Bank allowed");
      }
    });

    it("✅ Devrait mettre à jour les frais de transfert", async function () {
      await crossBorderPayment.updateTransferFee(2);
      const fee = await crossBorderPayment.transferFeePercent();
      expect(Number(fee)).to.equal(2);
    });

    it("❌ Ne devrait pas accepter des frais supérieurs à 10%", async function () {
      try {
        await crossBorderPayment.updateTransferFee(11);
        expect.fail("La transaction aurait dû échouer");
      } catch (error) {
        expect(error.message).to.include("Fee too high");
      }
    });
  });

  describe("Transferts Entre Banques (Même Devise)", function () {
    it("✅ Devrait effectuer un transfert TND → TND", async function () {
      const amount = ethers.parseEther("1000");
      const fee = amount * BigInt(1) / BigInt(100);
      const expectedReceived = amount - fee;

      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Autre Banque TND",
        "Tunisia",
        "TND"
      );
      await crossBorderPayment.addBalance(unauthorizedUser.address, INITIAL_BALANCE);

      const initialBalanceSender = await crossBorderPayment.getBalance(bankTunisia.address);
      const initialBalanceReceiver = await crossBorderPayment.getBalance(unauthorizedUser.address);

      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        amount
      );

      const finalBalanceSender = await crossBorderPayment.getBalance(bankTunisia.address);
      const finalBalanceReceiver = await crossBorderPayment.getBalance(unauthorizedUser.address);

      expect(finalBalanceSender).to.equal(initialBalanceSender - amount);
      expect(finalBalanceReceiver).to.equal(initialBalanceReceiver + expectedReceived);
    });

    it("✅ Devrait émettre l'événement TransferExecuted", async function () {
      const amount = ethers.parseEther("1000");
      
      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );
      await crossBorderPayment.addBalance(unauthorizedUser.address, INITIAL_BALANCE);

      const tx = await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        amount
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return crossBorderPayment.interface.parseLog(log).name === "TransferExecuted";
        } catch {
          return false;
        }
      });
      
      expect(event).to.not.be.undefined;
    });

    it("❌ Ne devrait pas permettre un transfert avec solde insuffisant", async function () {
      const tooMuchAmount = INITIAL_BALANCE + ethers.parseEther("1");
      
      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );

      try {
        await crossBorderPayment.connect(bankTunisia).transfer(
          unauthorizedUser.address,
          tooMuchAmount
        );
        expect.fail("La transaction aurait dû échouer");
      } catch (error) {
        expect(error.message).to.include("Insufficient balance");
      }
    });

    it("❌ Ne devrait pas permettre à une banque non enregistrée d'envoyer", async function () {
      try {
        await crossBorderPayment.connect(unauthorizedUser).transfer(
          bankTunisia.address,
          ethers.parseEther("100")
        );
        expect.fail("La transaction aurait dû échouer");
      } catch (error) {
        expect(error.message).to.include("Sender not registered");
      }
    });

    it("❌ Ne devrait pas permettre d'envoyer à une banque non enregistrée", async function () {
      try {
        await crossBorderPayment.connect(bankTunisia).transfer(
          unauthorizedUser.address,
          ethers.parseEther("100")
        );
        expect.fail("La transaction aurait dû échouer");
      } catch (error) {
        expect(error.message).to.include("Receiver not registered");
      }
    });
  });

  describe("Transferts avec Conversion de Devises", function () {
    it("✅ Devrait convertir EUR → TND correctement", async function () {
      const amount = ethers.parseEther("100");
      
      await crossBorderPayment.connect(bankFrance).transfer(
        bankTunisia.address,
        amount
      );

      const txCount = await crossBorderPayment.getTransactionCount();
      const tx = await crossBorderPayment.transactions(txCount - BigInt(1));

      expect(tx.originalAmount).to.equal(amount);
      expect(tx.convertedAmount).to.be.gt(0);
    });

    it("✅ Devrait convertir USD → TND correctement", async function () {
      const amount = ethers.parseEther("100");
      
      await crossBorderPayment.connect(bankUSA).transfer(
        bankTunisia.address,
        amount
      );

      const txCount = await crossBorderPayment.getTransactionCount();
      const tx = await crossBorderPayment.transactions(txCount - BigInt(1));

      expect(tx.originalAmount).to.equal(amount);
      expect(tx.convertedAmount).to.be.gt(0);
    });

    it("✅ Devrait convertir TND → EUR correctement", async function () {
      const amount = ethers.parseEther("330");

      await crossBorderPayment.connect(bankTunisia).transfer(
        bankFrance.address,
        amount
      );

      const txCount = await crossBorderPayment.getTransactionCount();
      const tx = await crossBorderPayment.transactions(txCount - BigInt(1));

      expect(tx.originalAmount).to.equal(amount);
      expect(tx.convertedAmount).to.be.gt(0);
    });

    it("✅ Devrait convertir TND → USD correctement", async function () {
      const amount = ethers.parseEther("310");

      await crossBorderPayment.connect(bankTunisia).transfer(
        bankUSA.address,
        amount
      );

      const txCount = await crossBorderPayment.getTransactionCount();
      const tx = await crossBorderPayment.transactions(txCount - BigInt(1));

      expect(tx.convertedAmount).to.be.gt(0);
    });
  });

  describe("Système de Limite Quotidienne", function () {
    it("✅ Devrait créer pending transfer pour montants > 5000", async function () {
      const amount = ethers.parseEther("6000");
      
      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );
      await crossBorderPayment.addBalance(unauthorizedUser.address, INITIAL_BALANCE);

      const initialPending = await crossBorderPayment.pendingCount();

      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        amount
      );

      const finalPending = await crossBorderPayment.pendingCount();
      expect(finalPending).to.equal(initialPending + BigInt(1));
    });

    it("❌ Devrait bloquer les transferts dépassant la limite quotidienne", async function () {
      const amount1 = ethers.parseEther("4000");
      const amount2 = ethers.parseEther("4000");
      const amount3 = ethers.parseEther("3000");
      
      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );
      await crossBorderPayment.addBalance(unauthorizedUser.address, INITIAL_BALANCE);

      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        amount1
      );

      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        amount2
      );

      try {
        await crossBorderPayment.connect(bankTunisia).transfer(
          unauthorizedUser.address,
          amount3
        );
        expect.fail("La transaction aurait dû échouer");
      } catch (error) {
        expect(error.message).to.include("Daily transfer limit exceeded");
      }
    });
  });

  describe("Système Multi-Signature (Gros Transferts)", function () {
    it("✅ Les petits transferts devraient être exécutés immédiatement", async function () {
      const smallAmount = ethers.parseEther("4000");
      
      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );
      await crossBorderPayment.addBalance(unauthorizedUser.address, INITIAL_BALANCE);

      const initialCount = await crossBorderPayment.getTransactionCount();
      
      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        smallAmount
      );

      const finalCount = await crossBorderPayment.getTransactionCount();
      expect(finalCount).to.equal(initialCount + BigInt(1));
    });

    it("✅ Les gros transferts devraient créer une transaction en attente", async function () {
      const largeAmount = ethers.parseEther("6000");
      
      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );

      const initialPendingCount = await crossBorderPayment.pendingCount();
      
      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        largeAmount
      );

      const finalPendingCount = await crossBorderPayment.pendingCount();
      expect(finalPendingCount).to.equal(initialPendingCount + BigInt(1));
    });

    it("✅ L'owner devrait pouvoir approuver un transfert en attente", async function () {
      const largeAmount = ethers.parseEther("6000");
      
      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );
      await crossBorderPayment.addBalance(unauthorizedUser.address, INITIAL_BALANCE);

      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        largeAmount
      );

      const pendingId = (await crossBorderPayment.pendingCount()) - BigInt(1);

      await crossBorderPayment.approveTransfer(pendingId);

      const pending = await crossBorderPayment.pendingTransfers(pendingId);
      expect(pending.executed).to.equal(true);
    });

    it("❌ Ne devrait pas exécuter deux fois le même transfert en attente", async function () {
      const largeAmount = ethers.parseEther("6000");
      
      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );
      await crossBorderPayment.addBalance(unauthorizedUser.address, INITIAL_BALANCE);

      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        largeAmount
      );

      const pendingId = (await crossBorderPayment.pendingCount()) - BigInt(1);

      await crossBorderPayment.approveTransfer(pendingId);

      try {
        await crossBorderPayment.approveTransfer(pendingId);
        expect.fail("La transaction aurait dû échouer");
      } catch (error) {
        expect(error.message).to.include("Already executed");
      }
    });

    it("❌ Seul l'owner peut approuver", async function () {
      const largeAmount = ethers.parseEther("6000");
      
      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );

      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        largeAmount
      );

      const pendingId = (await crossBorderPayment.pendingCount()) - BigInt(1);

      try {
        await crossBorderPayment.connect(bankTunisia).approveTransfer(pendingId);
        expect.fail("La transaction aurait dû échouer");
      } catch (error) {
        expect(error.message).to.include("Only Central Bank allowed");
      }
    });
  });

  describe("Historique des Transactions", function () {
    it("✅ Devrait stocker les détails de chaque transaction", async function () {
      const amount = ethers.parseEther("1000");
      
      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );
      await crossBorderPayment.addBalance(unauthorizedUser.address, INITIAL_BALANCE);

      const initialCount = await crossBorderPayment.getTransactionCount();

      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        amount
      );

      const finalCount = await crossBorderPayment.getTransactionCount();
      expect(finalCount).to.equal(initialCount + BigInt(1));

      const tx = await crossBorderPayment.transactions(finalCount - BigInt(1));
      expect(tx.from).to.equal(bankTunisia.address);
      expect(tx.to).to.equal(unauthorizedUser.address);
      expect(tx.originalAmount).to.equal(amount);
    });

    it("✅ Devrait incrémenter le compteur de transactions", async function () {
      const amount = ethers.parseEther("1000");
      
      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );
      await crossBorderPayment.addBalance(unauthorizedUser.address, INITIAL_BALANCE);

      const countBefore = await crossBorderPayment.getTransactionCount();

      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        amount
      );

      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        amount
      );

      const countAfter = await crossBorderPayment.getTransactionCount();
      expect(countAfter).to.equal(countBefore + BigInt(2));
    });
  });

  describe("Calcul et Distribution des Frais", function () {
    it("✅ La banque centrale devrait recevoir les frais", async function () {
      const amount = ethers.parseEther("1000");
      
      await crossBorderPayment.registerBank(
        owner.address,
        "Central Bank",
        "Tunisia",
        "TND"
      );

      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );
      await crossBorderPayment.addBalance(unauthorizedUser.address, INITIAL_BALANCE);

      const initialOwnerBalance = await crossBorderPayment.getBalance(owner.address);

      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        amount
      );

      const finalOwnerBalance = await crossBorderPayment.getBalance(owner.address);
      const expectedFee = amount * BigInt(1) / BigInt(100);

      expect(finalOwnerBalance).to.equal(initialOwnerBalance + expectedFee);
    });

    it("✅ Les frais devraient être correctement déduits", async function () {
      const amount = ethers.parseEther("1000");
      const fee = amount * BigInt(1) / BigInt(100);
      const expectedReceived = amount - fee;
      
      await crossBorderPayment.registerBank(
        owner.address,
        "Central Bank",
        "Tunisia",
        "TND"
      );

      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );
      await crossBorderPayment.addBalance(unauthorizedUser.address, INITIAL_BALANCE);

      const initialBalance = await crossBorderPayment.getBalance(unauthorizedUser.address);

      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        amount
      );

      const finalBalance = await crossBorderPayment.getBalance(unauthorizedUser.address);
      expect(finalBalance).to.equal(initialBalance + expectedReceived);
    });
  });

  describe("Fonctions de Consultation", function () {
    it("✅ getBalance() devrait retourner le solde correct", async function () {
      const balance = await crossBorderPayment.getBalance(bankTunisia.address);
      expect(balance).to.equal(INITIAL_BALANCE);
    });

    it("✅ getTransactionCount() devrait retourner le nombre correct", async function () {
      const initialCount = await crossBorderPayment.getTransactionCount();
      
      await crossBorderPayment.registerBank(
        unauthorizedUser.address,
        "Test Bank",
        "Tunisia",
        "TND"
      );
      await crossBorderPayment.addBalance(unauthorizedUser.address, INITIAL_BALANCE);

      await crossBorderPayment.connect(bankTunisia).transfer(
        unauthorizedUser.address,
        ethers.parseEther("100")
      );

      const finalCount = await crossBorderPayment.getTransactionCount();
      expect(finalCount).to.equal(initialCount + BigInt(1));
    });

    it("✅ banks() mapping devrait retourner les bonnes infos", async function () {
      const bank = await crossBorderPayment.banks(bankTunisia.address);
      
      expect(bank.name).to.equal("Banque Centrale de Tunisie");
      expect(bank.country).to.equal("Tunisia");
      expect(bank.currency).to.equal("TND");
      expect(bank.isRegistered).to.equal(true);
    });
  });
});

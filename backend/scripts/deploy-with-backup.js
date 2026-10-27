const hre = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("📦 Déploiement du contrat...");
  
  const CrossBorderPayment = await hre.ethers.getContractFactory("CrossBorderPayment");
  const contract = await CrossBorderPayment.deploy();
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log(`✅ Contrat déployé à: ${address}`);
  
  // Sauvegarder l'adresse
  const config = {
    contractAddress: address,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync('./deployed-address.json', JSON.stringify(config, null, 2));
  console.log(`📁 Adresse sauvegardée dans deployed-address.json`);
  
  // Mettre à jour .env
  try {
    const envPath = './.env';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    if (envContent.includes('CONTRACT_ADDRESS=')) {
      envContent = envContent.replace(
        /CONTRACT_ADDRESS=.*/,
        `CONTRACT_ADDRESS=${address}`
      );
    } else {
      envContent += `\nCONTRACT_ADDRESS=${address}`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log(`📝 .env mis à jour avec la nouvelle adresse`);
  } catch (err) {
    console.log(`⚠️ Impossible de mettre à jour .env:`, err.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
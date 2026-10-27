const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const ContractFactory = await ethers.getContractFactory("CrossBorderPayment");
  const contract = await ContractFactory.deploy();
  
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log("✅ Contract deployed to:", address);

  if (process.env.DEPLOY_OUTPUT_FILE) {
    fs.writeFileSync(process.env.DEPLOY_OUTPUT_FILE, `CONTRACT_ADDRESS=${address}\n`);
    console.log(`📁 Adresse sauvegardée dans ${process.env.DEPLOY_OUTPUT_FILE}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const { ethers } = require("hardhat");

/**
 * CoreVault Contract Authorization Script
 * 
 * Usage:
 * npx hardhat run scripts/grant-transfer-role.js --network <network>
 * 
 * You can set the CoreVault contract address through environment variables:
 * COREVAULT_ADDRESS=0x... npx hardhat run scripts/grant-transfer-role.js --network <network>
 */
async function main() {
  const { deployments } = require("hardhat");
  const { get } = deployments;
  const network = require("hardhat").network.name;
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get CoreVault contract address
  let coreVaultAddress = process.env.COREVAULT_ADDRESS;
  if (!coreVaultAddress) {
    try {
      const creationDeployment = await get("Creation");
      coreVaultAddress = creationDeployment.address;
    } catch (error) {
      console.error("Unable to get CoreVault contract address, please provide it via COREVAULT_ADDRESS environment variable");
      return;
    }
  }
  
  console.log(`Using CoreVault contract address: ${coreVaultAddress}`);
  
  // Get CoreVault contract instance
  const coreVault = await ethers.getContractAt("CoreVault", coreVaultAddress);
  
  // List of user addresses to grant TOKEN_TRANSFER_ROLE
  const usersToGrant = [
    // "0xE8053153E0559213EfF9B3a4952Eca72B27f35DF", // base
    "0xd2DC0Ad8565470824Fc4813E2239177aAC57965b", // bsc
  ];
  
  // Get TOKEN_TRANSFER_ROLE constant
  const TOKEN_TRANSFER_ROLE = await coreVault.TOKEN_TRANSFER_ROLE();
  console.log(`TOKEN_TRANSFER_ROLE: ${TOKEN_TRANSFER_ROLE}`);
  
  // Grant TOKEN_TRANSFER_ROLE to each user
  for (const userAddress of usersToGrant) {
    console.log(`Granting TOKEN_TRANSFER_ROLE to user ${userAddress}...`);
    
    try {
      // Check if user already has the role
      const hasRole = await coreVault.hasRole(TOKEN_TRANSFER_ROLE, userAddress);
      
      if (hasRole) {
        console.log(`User ${userAddress} already has TOKEN_TRANSFER_ROLE, skipping`);
        continue;
      }
      
      // Grant role
      const tx = await coreVault.grantRole(TOKEN_TRANSFER_ROLE, userAddress);
      await tx.wait();
      console.log(`Successfully granted TOKEN_TRANSFER_ROLE to user ${userAddress}, transaction hash: ${tx.hash}`);
    } catch (error) {
      console.error(`Failed to grant TOKEN_TRANSFER_ROLE to user ${userAddress}:`, error.message);
    }
  }
  
  console.log("Authorization operations completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
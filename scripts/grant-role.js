const { ethers } = require("hardhat");

/**
 * Creation Contract Authorization Script
 * 
 * Usage:
 * npx hardhat run scripts/grant-role.js --network <network>
 * 
 * You can set the Creation contract address through environment variables:
 * CREATION_ADDRESS=0x... npx hardhat run scripts/grant-role.js --network <network>
 */
async function main() {
  const { deployments } = require("hardhat");
  const { get } = deployments;
  const network = require("hardhat").network.name;
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Get Creation contract address
  let creationAddress = process.env.CREATION_ADDRESS;
  if (!creationAddress) {
    try {
      const creationDeployment = await deployments.get("Creation");
      creationAddress = creationDeployment.address;
    } catch (error) {
      console.error("Unable to get Creation contract address, please provide it via CREATION_ADDRESS environment variable");
      process.exit(1);
    }
  }
  
  console.log(`Using Creation contract address: ${creationAddress}`);
  
  // Get Creation contract instance
  const creation = await ethers.getContractAt("Creation", creationAddress);
  
  // List of user addresses to grant MANAGER_ROLE
  const usersToGrant = [
    // "0xE8053153E0559213EfF9B3a4952Eca72B27f35DF", // base
    "0xd2DC0Ad8565470824Fc4813E2239177aAC57965b", // bsc
  ];
  
  // Get MANAGER_ROLE constant
  const MANAGER_ROLE = await creation.MANAGER_ROLE();
  console.log(`MANAGER_ROLE: ${MANAGER_ROLE}`);
  
  // Grant MANAGER_ROLE to each user
  for (const userAddress of usersToGrant) {
    console.log(`Granting MANAGER_ROLE to user ${userAddress}...`);
    
    // Check if user already has the role
     const hasRole = await creation.hasRole(MANAGER_ROLE, userAddress);
     
     if (hasRole) {
       console.log(`User ${userAddress} already has MANAGER_ROLE, skipping`);
       continue;
     }
        
     // Grant role
     try {
      const tx = await creation.grantRole(MANAGER_ROLE, userAddress);
      await tx.wait();
      console.log(`Successfully granted MANAGER_ROLE to user ${userAddress}, transaction hash: ${tx.hash}`);
    } catch (error) {
      console.error(`Failed to grant MANAGER_ROLE to user ${userAddress}:`, error.message);
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
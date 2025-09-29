const { ethers } = require("hardhat");

/**
 * Advanced Role Management Script
 * 
 * Usage:
 * npx hardhat run scripts/grant-role.js --network <network>
 * 
 * Environment variables:
 * CREATION_ADDRESS=0x... - Creation contract address
 * VAULT_ADDRESS=0x... - Vault contract address
 * CROWDSALE_ADDRESS=0x... - Crowdsale contract address
 * YIELD_ADDRESS=0x... - Yield contract address
 * VALIDATOR_REGISTRY_ADDRESS=0x... - ValidatorRegistry contract address
 */

// ============ Role Grant Helper Functions ============

/**
 * Generic role granting function
 * @param {Object} contract - Contract instance
 * @param {string} contractName - Contract name for logging
 * @param {string} roleName - Role name for logging
 * @param {string} roleHash - Role hash
 * @param {string} userAddress - User address to grant role to
 */
async function grantRoleToUser(contract, contractName, roleName, roleHash, userAddress) {
  try {
    console.log(`\n🔍 Checking ${roleName} for ${userAddress} on ${contractName}...`);
    
    // Check if user already has the role
    const hasRole = await contract.hasRole(roleHash, userAddress);
    
    if (hasRole) {
      console.log(`✅ User ${userAddress} already has ${roleName}, skipping`);
      return true;
    }
    
    // Grant role
    console.log(`🚀 Granting ${roleName} to ${userAddress}...`);
    const tx = await contract.grantRole(roleHash, userAddress);
    await tx.wait();
    console.log(`✅ Successfully granted ${roleName} to ${userAddress}`);
    console.log(`📝 Transaction hash: ${tx.hash}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to grant ${roleName} to ${userAddress}:`, error.message);
    return false;
  }
}

/**
 * Grant Creation contract roles
 */
async function grantCreationRoles(creationAddress, users) {
  if (!creationAddress) return;
  
  console.log(`\n🏗️  Processing Creation Contract: ${creationAddress}`);
  const creation = await ethers.getContractAt("Creation", creationAddress);
  
  const MANAGER_ROLE = await creation.MANAGER_ROLE();
  const VAULT_LAUNCH_ROLE = await creation.VAULT_LAUNCH_ROLE();
  
  for (const userAddress of users) {
    await grantRoleToUser(creation, "Creation", "MANAGER_ROLE", MANAGER_ROLE, userAddress);
    await grantRoleToUser(creation, "Creation", "VAULT_LAUNCH_ROLE", VAULT_LAUNCH_ROLE, userAddress);
  }
}

/**
 * Grant Vault contract roles
 */
async function grantVaultRoles(vaultAddress, users) {
  if (!vaultAddress) return;
  
  console.log(`\n🏦 Processing Vault Contract: ${vaultAddress}`);
  const vault = await ethers.getContractAt("CoreVault", vaultAddress);
  
  const MANAGER_ROLE = await vault.MANAGER_ROLE();
  const TOKEN_TRANSFER_ROLE = await vault.TOKEN_TRANSFER_ROLE();
  const MINT_ROLE = await vault.MINT_ROLE();
  const BURN_ROLE = await vault.BURN_ROLE();
  const PAUSE_ROLE = await vault.PAUSE_ROLE();
  
  for (const userAddress of users) {
    await grantRoleToUser(vault, "Vault", "MANAGER_ROLE", MANAGER_ROLE, userAddress);
    await grantRoleToUser(vault, "Vault", "TOKEN_TRANSFER_ROLE", TOKEN_TRANSFER_ROLE, userAddress);
    await grantRoleToUser(vault, "Vault", "MINT_ROLE", MINT_ROLE, userAddress);
    await grantRoleToUser(vault, "Vault", "BURN_ROLE", BURN_ROLE, userAddress);
    await grantRoleToUser(vault, "Vault", "PAUSE_ROLE", PAUSE_ROLE, userAddress);
  }
}

/**
 * Grant Crowdsale contract roles
 */
async function grantCrowdsaleRoles(crowdsaleAddress, users) {
  if (!crowdsaleAddress) return;
  
  console.log(`\n💰 Processing Crowdsale Contract: ${crowdsaleAddress}`);
  const crowdsale = await ethers.getContractAt("Crowdsale", crowdsaleAddress);
  
  const MANAGER_ROLE = await crowdsale.MANAGER_ROLE();
  const PAUSER_ROLE = await crowdsale.PAUSER_ROLE();
  const OFFCHAIN_MANAGER_ROLE = await crowdsale.OFFCHAIN_MANAGER_ROLE();
  const WITHDRAW_ASSET_ROLE = await crowdsale.WITHDRAW_ASSET_ROLE();
  const WITHDRAW_MANAGE_FEE_ROLE = await crowdsale.WITHDRAW_MANAGE_FEE_ROLE();
  
  for (const userAddress of users) {
    await grantRoleToUser(crowdsale, "Crowdsale", "MANAGER_ROLE", MANAGER_ROLE, userAddress);
    await grantRoleToUser(crowdsale, "Crowdsale", "PAUSER_ROLE", PAUSER_ROLE, userAddress);
    await grantRoleToUser(crowdsale, "Crowdsale", "OFFCHAIN_MANAGER_ROLE", OFFCHAIN_MANAGER_ROLE, userAddress);
    await grantRoleToUser(crowdsale, "Crowdsale", "WITHDRAW_ASSET_ROLE", WITHDRAW_ASSET_ROLE, userAddress);
    await grantRoleToUser(crowdsale, "Crowdsale", "WITHDRAW_MANAGE_FEE_ROLE", WITHDRAW_MANAGE_FEE_ROLE, userAddress);
  }
}

/**
 * Grant Yield contract roles
 */
async function grantYieldRoles(yieldAddress, users) {
  if (!yieldAddress) return;
  
  console.log(`\n📈 Processing Yield Contract: ${yieldAddress}`);
  const yieldContract = await ethers.getContractAt("AccumulatedYield", yieldAddress);
  
  const MANAGER_ROLE = await yieldContract.MANAGER_ROLE();
  const PAUSER_ROLE = await yieldContract.PAUSER_ROLE();
  
  for (const userAddress of users) {
    await grantRoleToUser(yieldContract, "Yield", "MANAGER_ROLE", MANAGER_ROLE, userAddress);
    await grantRoleToUser(yieldContract, "Yield", "PAUSER_ROLE", PAUSER_ROLE, userAddress);
  }
}

/**
 * Grant ValidatorRegistry contract roles
 */
async function grantValidatorRegistryRoles(validatorRegistryAddress, users) {
  if (!validatorRegistryAddress) return;
  
  console.log(`\n🔐 Processing ValidatorRegistry Contract: ${validatorRegistryAddress}`);
  const validatorRegistry = await ethers.getContractAt("ValidatorRegistry", validatorRegistryAddress);
  
  const MANAGER_ROLE = await validatorRegistry.MANAGER_ROLE();
  
  for (const userAddress of users) {
    await grantRoleToUser(validatorRegistry, "ValidatorRegistry", "MANAGER_ROLE", MANAGER_ROLE, userAddress);
  }
}

// ============ Main Function ============

async function main() {
  const { deployments } = require("hardhat");
  const network = require("hardhat").network.name;
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`🚀 Using account: ${deployer.address}`);
  console.log(`🌐 Network: ${network}`);
  
  // List of user addresses to grant roles to
  const usersToGrant = [
    // "0xE8053153E0559213EfF9B3a4952Eca72B27f35DF", // base
    "0xd2DC0Ad8565470824Fc4813E2239177aAC57965b", // bsc
    // Add more addresses as needed
  ];
  
  console.log(`👥 Users to grant roles: ${usersToGrant.join(", ")}`);
  
  // Get contract addresses from environment variables or deployments
  let creationAddress = process.env.CREATION_ADDRESS;
  let vaultAddress = process.env.VAULT_ADDRESS;
  let crowdsaleAddress = process.env.CROWDSALE_ADDRESS;
  let yieldAddress = process.env.YIELD_ADDRESS;
  let validatorRegistryAddress = process.env.VALIDATOR_REGISTRY_ADDRESS;
  
  // Try to get addresses from deployments if not provided
  if (!creationAddress) {
    try {
      const deployment = await deployments.get("Creation");
      creationAddress = deployment.address;
    } catch (error) {
      console.log("⚠️  Creation contract address not found in deployments");
    }
  }
  
  if (!validatorRegistryAddress) {
    try {
      const deployment = await deployments.get("ValidatorRegistry");
      validatorRegistryAddress = deployment.address;
    } catch (error) {
      console.log("⚠️  ValidatorRegistry contract address not found in deployments");
    }
  }
  
  console.log("\n📋 Contract Addresses:");
  console.log(`Creation: ${creationAddress || "Not provided"}`);
  console.log(`Vault: ${vaultAddress || "Not provided"}`);
  console.log(`Crowdsale: ${crowdsaleAddress || "Not provided"}`);
  console.log(`Yield: ${yieldAddress || "Not provided"}`);
  console.log(`ValidatorRegistry: ${validatorRegistryAddress || "Not provided"}`);
  
  // Grant roles for each contract type
  await grantCreationRoles(creationAddress, usersToGrant);
  await grantVaultRoles(vaultAddress, usersToGrant);
  await grantCrowdsaleRoles(crowdsaleAddress, usersToGrant);
  await grantYieldRoles(yieldAddress, usersToGrant);
  await grantValidatorRegistryRoles(validatorRegistryAddress, usersToGrant);
  
  console.log("\n🎉 Role granting operations completed!");
  console.log("\n💡 Usage Tips:");
  console.log("- Set contract addresses via environment variables for specific contracts");
  console.log("- Example: VAULT_ADDRESS=0x... npx hardhat run scripts/grant-role.js --network localhost");
  console.log("- Add more user addresses to the usersToGrant array as needed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
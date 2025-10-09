const { ethers } = require("hardhat");

/**
 * ValidatorRegistry setValidator Script
 * 
 * This script sets a new validator address in the ValidatorRegistry contract.
 * The validator address is hardcoded for security and consistency.
 * 
 * Usage:
 * npx hardhat run scripts/set-validator.js --network <network>
 * 
 * Environment variables (optional):
 * VALIDATOR_REGISTRY_ADDRESS=0x... - ValidatorRegistry contract address
 */

async function main() {
  const { deployments } = require("hardhat");
  const { get } = deployments;
  const network = require("hardhat").network.name;
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`🔧 Using account: ${deployer.address}`);
  console.log(`🌐 Network: ${network}`);
  
  // Hardcoded validator addresses for different networks
  const VALIDATOR_ADDRESSES = {
    // Testnet validators  
    baseSepolia: "0xa1FE4Ed4D662eCa52DEA7b934E429b98AAFF7533",
    bscTestnet: "0xa1FE4Ed4D662eCa52DEA7b934E429b98AAFF7533",
    
    // Local development validators
    localhost: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Hardhat account #0
    hardhat: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"    // Hardhat account #0
  };
  
  // Get the validator address for current network
  const newValidatorAddress = VALIDATOR_ADDRESSES[network];
  if (!newValidatorAddress) {
    console.error(`❌ No validator address configured for network: ${network}`);
    console.log("Available networks:", Object.keys(VALIDATOR_ADDRESSES).join(", "));
    return;
  }
  
  console.log(`🎯 Target validator address: ${newValidatorAddress}`);
  
  // Get ValidatorRegistry contract address
  let validatorRegistryAddress = process.env.VALIDATOR_REGISTRY_ADDRESS;
  if (!validatorRegistryAddress) {
    try {
      const validatorRegistryDeployment = await get("ValidatorRegistry");
      validatorRegistryAddress = validatorRegistryDeployment.address;
      console.log(`📋 Using deployed ValidatorRegistry address: ${validatorRegistryAddress}`);
    } catch (error) {
      console.error("❌ Unable to get ValidatorRegistry contract address.");
      console.log("Please provide it via VALIDATOR_REGISTRY_ADDRESS environment variable");
      console.log("Example: VALIDATOR_REGISTRY_ADDRESS=0x... npx hardhat run scripts/set-validator.js --network <network>");
      return;
    }
  } else {
    console.log(`📋 Using environment ValidatorRegistry address: ${validatorRegistryAddress}`);
  }
  
  try {
    // Validate contract address
    if (!ethers.isAddress(validatorRegistryAddress)) {
      throw new Error("Invalid ValidatorRegistry contract address");
    }
    
    // Check if contract is deployed
    const code = await ethers.provider.getCode(validatorRegistryAddress);
    if (code === "0x") {
      throw new Error("ValidatorRegistry contract not deployed at the specified address");
    }
    
    // Get ValidatorRegistry contract instance
    const validatorRegistry = await ethers.getContractAt("ValidatorRegistry", validatorRegistryAddress);
    
    // Check current validator
    console.log("\n🔍 Checking current validator...");
    const currentValidator = await validatorRegistry.getValidator();
    console.log(`Current validator: ${currentValidator}`);
    
    // Check if new validator is different from current
    if (currentValidator.toLowerCase() === newValidatorAddress.toLowerCase()) {
      console.log("✅ Validator address is already set to the target address, no action needed.");
      return;
    }
    
    // Check if deployer has MANAGER_ROLE
    console.log("\n🔐 Checking permissions...");
    const MANAGER_ROLE = await validatorRegistry.MANAGER_ROLE();
    const hasManagerRole = await validatorRegistry.hasRole(MANAGER_ROLE, deployer.address);
    
    if (!hasManagerRole) {
      console.error(`❌ Account ${deployer.address} does not have MANAGER_ROLE`);
      console.log("Please use an account with MANAGER_ROLE or grant the role first.");
      return;
    }
    
    console.log("✅ Account has MANAGER_ROLE, proceeding with validator update...");
    
    // Set new validator
    console.log(`\n🚀 Setting new validator: ${newValidatorAddress}`);
    const tx = await validatorRegistry.setValidator(newValidatorAddress);
    console.log(`📝 Transaction submitted: ${tx.hash}`);
    
    // Wait for confirmation
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
    
    // Verify the change
    console.log("\n🔍 Verifying validator update...");
    const updatedValidator = await validatorRegistry.getValidator();
    console.log(`Updated validator: ${updatedValidator}`);
    
    if (updatedValidator.toLowerCase() === newValidatorAddress.toLowerCase()) {
      console.log("🎉 Validator successfully updated!");
    } else {
      console.error("❌ Validator update verification failed!");
    }
    
    // Display summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 VALIDATOR UPDATE SUMMARY");
    console.log("=".repeat(60));
    console.log(`Network: ${network}`);
    console.log(`ValidatorRegistry: ${validatorRegistryAddress}`);
    console.log(`Previous validator: ${currentValidator}`);
    console.log(`New validator: ${updatedValidator}`);
    console.log(`Transaction: ${tx.hash}`);
    console.log(`Block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    console.log("=".repeat(60));
    
  } catch (error) {
    console.error("❌ Failed to set validator:", error.message);
    
    // Provide helpful error messages
    if (error.message.includes("AccessControl")) {
      console.log("💡 This error usually means the account doesn't have MANAGER_ROLE.");
      console.log("   Use the grant-role.js script to grant MANAGER_ROLE first.");
    } else if (error.message.includes("invalid address")) {
      console.log("💡 The validator address is invalid or the same as current validator.");
    } else if (error.message.includes("revert")) {
      console.log("💡 Transaction reverted. Check the contract requirements and your permissions.");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script execution failed:", error);
    process.exit(1);
  });
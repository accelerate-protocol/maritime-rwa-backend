const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// Add delay function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Set different sleep times based on network type
const getSleepTime = (networkName) => {
  if (networkName === 'hardhat' || networkName === 'localhost') {
    return 100; // Local network sleep 100ms
  }
  return 5000; // Other networks sleep 5s
};

const func = async function (hre) {
  // Add id to the function to prevent re-execution
  func.id = "deploy_mock_asset_tokens";
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Only deploy on localhost or hardhat networks
  if (network.name !== 'localhost' && network.name !== 'hardhat') {
    console.log(`⏭️  Skipping MockAssetToken deployment on ${network.name} network`);
    return true;
  }

  console.log("=== Deploying Mock Asset Tokens (USDT & USDC) ===\n");

  // Deploy MockUSDT
  console.log("Deploying MockUSDT...");
  const mockUSDTDeployment = await deploy('MockUSDT', {
    contract: 'contracts/v2/mocks/MockUSDT.sol:MockUSDT',
    from: deployer,
    args: ['Tether USD', 'USDT'],
    log: true,
    waitConfirmations: 1,
    skipIfAlreadyDeployed: false,
  });

  await sleep(getSleepTime(network.name));

  console.log(`✓ MockUSDT deployed to: ${mockUSDTDeployment.address}\n`);

  // Deploy MockUSDC
  console.log("Deploying MockUSDC...");
  const mockUSDCDeployment = await deploy('MockUSDC', {
    contract: 'contracts/v2/mocks/MockUSDC.sol:MockUSDC',
    from: deployer,
    args: ['USD Coin', 'USDC'],
    log: true,
    waitConfirmations: 1,
    skipIfAlreadyDeployed: false,
  });

  await sleep(getSleepTime(network.name));

  console.log(`✓ MockUSDC deployed to: ${mockUSDCDeployment.address}\n`);

  // Get contract instances for minting
  const mockUSDT = await ethers.getContractAt('contracts/v2/mocks/MockUSDT.sol:MockUSDT', mockUSDTDeployment.address);
  const mockUSDC = await ethers.getContractAt('contracts/v2/mocks/MockUSDC.sol:MockUSDC', mockUSDCDeployment.address);

  // Mint tokens to all available addresses for testing
  console.log("Minting 100M tokens for Hardhat addresses...");
  
  const signers = await ethers.getSigners();
  const mintUSDTAmount = ethers.parseUnits('100000000', 6); 
  const mintUSDCAmount = ethers.parseUnits('100000000', 18); 
  
  for (let i = 0; i < signers.length; i++) {
    const signer = signers[i];
    console.log(`  Minting tokens for address ${i}: ${signer.address}`);
    
    try {
      // Mint USDT
      const usdtMintTx = await mockUSDT.mint(signer.address, mintUSDTAmount);
      await usdtMintTx.wait();
      console.log(`    ✓ Minted 100M USDT to ${signer.address}`);
      
      // Mint USDC
      const usdcMintTx = await mockUSDC.mint(signer.address, mintUSDCAmount);
      await usdcMintTx.wait();
      console.log(`    ✓ Minted 100M USDC to ${signer.address}`);
    } catch (error) {
      console.log(`    ✗ Failed to mint tokens for ${signer.address}: ${error.message}`);
    }
  }

  console.log("\n✓ Mock Asset Token Deployment Complete!\n");

  return true;
};

func.tags = ["MockAssetToken", "mocks"];
func.dependencies = [];

module.exports = func;
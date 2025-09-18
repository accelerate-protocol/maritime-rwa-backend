const { ethers } = require("hardhat");

/**
 * Proxy Contract Upgrade Script
 * 
 * Usage:
 * npx hardhat run scripts/proxy-update.js --network <network>
 */
async function main() {
  const { deployments } = require("hardhat");
  const { get } = deployments;
  const network = require("hardhat").network.name;
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  // Hardcoded addresses
  // ProxyAdmin address
  const proxyAdminAddress = "0x51660D9A5A1afdc38e9f71E680d9450b818097F5";
  console.log(`Using ProxyAdmin contract address: ${proxyAdminAddress}`);
  
  // Proxy contract address
  const proxyAddress = "0xbA75BD6E851DEE41aFCfD7376a29aE459299dcF8";
  console.log(`Target proxy contract address: ${proxyAddress}`);
  
  // New implementation contract address
  const newImplementationAddress = "0x50a5d1E88e7D527e3f6cB177b6bCdcaeAB822f01";
  console.log(`New implementation contract address: ${newImplementationAddress}`);
  
  try {
    // Validate address format - using ethers.isAddress or skip validation directly
    const isValidAddress = (address) => {
      // Simple validation: check if the address is a 42-character hexadecimal string (0x + 40 characters)
      return /^0x[0-9a-fA-F]{40}$/.test(address);
    };
    
    if (!isValidAddress(proxyAdminAddress)) {
      throw new Error(`Invalid ProxyAdmin address: ${proxyAdminAddress}`);
    }
    if (!isValidAddress(proxyAddress)) {
      throw new Error(`Invalid proxy contract address: ${proxyAddress}`);
    }
    if (!isValidAddress(newImplementationAddress)) {
      throw new Error(`Invalid new implementation contract address: ${newImplementationAddress}`);
    }
    
    // Check if contracts exist
    const proxyAdminCode = await ethers.provider.getCode(proxyAdminAddress);
    if (proxyAdminCode === '0x') {
      throw new Error(`ProxyAdmin contract at address ${proxyAdminAddress} does not exist`);
    }
    
    const proxyCode = await ethers.provider.getCode(proxyAddress);
    if (proxyCode === '0x') {
      throw new Error(`Proxy contract at address ${proxyAddress} does not exist`);
    }
    
    const implementationCode = await ethers.provider.getCode(newImplementationAddress);
    if (implementationCode === '0x') {
      throw new Error(`New implementation contract at address ${newImplementationAddress} does not exist`);
    }
    
    // Get ProxyAdmin contract instance
    console.log(`Connecting to ProxyAdmin contract...`);
    const proxyAdmin = await ethers.getContractAt("ProxyAdmin", proxyAdminAddress);
    
    try {
      // Check current implementation address
      const currentImplementation = await proxyAdmin.getProxyImplementation(proxyAddress);
      console.log(`Current implementation contract address: ${currentImplementation}`);
      
      // Check current admin
      const currentAdmin = await proxyAdmin.getProxyAdmin(proxyAddress);
      console.log(`Current proxy admin address: ${currentAdmin}`);
      
      // Check ProxyAdmin owner
      const owner = await proxyAdmin.owner();
      console.log(`ProxyAdmin contract owner: ${owner}`);
      
      // Confirm if current account is the ProxyAdmin owner
      if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error(`Current account is not the ProxyAdmin owner, cannot perform upgrade operation`);
        return;
      }
      
      // Execute upgrade
      console.log(`Upgrading proxy contract to new implementation...`);
      const tx = await proxyAdmin.upgrade(proxyAddress, newImplementationAddress);
      console.log(`Transaction submitted, waiting for confirmation...`);
      const receipt = await tx.wait();
      console.log(`Transaction confirmed, transaction hash: ${receipt.transactionHash}`);
      
      // Verify if upgrade was successful
      const newImplementation = await proxyAdmin.getProxyImplementation(proxyAddress);
      console.log(`Implementation contract address after upgrade: ${newImplementation}`);
      
      if (newImplementation.toLowerCase() === newImplementationAddress.toLowerCase()) {
        console.log(`Upgrade successful!`);
      } else {
        console.error(`Upgrade failed, implementation address does not match`);
      }
    } catch (innerError) {
      if (innerError.message.includes('could not decode result data')) {
        console.error(`Contract call failed: ProxyAdmin contract interface may not match or the proxy contract is not managed by this ProxyAdmin`);
      } else {
        throw innerError;
      }
    }
  } catch (error) {
    console.error(`Error occurred during upgrade:`, error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
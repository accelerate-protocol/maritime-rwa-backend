import { ethers } from "hardhat";
import { parseUSDT } from "../utils/usdt";

// Constants definition
export const SHARE_TOKEN_DECIMALS = 6;
export const BPS_DENOMINATOR = 10000;

// Crowdsale parameters
export const sharePrice = ethers.parseUnits("1", 8); // 1 USDT per share
export const minDepositAmount = parseUSDT("10"); // 10 USDT
export const expectedShareAmount = ethers.parseUnits("90", 6); // 90 shares

export const currentTime = Math.floor(Date.now() / 1000);
export const startTime = BigInt(currentTime);
export const endTime = BigInt(currentTime + 86400); // Ends after 24 hours
export const maxFundingAmount = parseUSDT("10000"); // Maximum funding amount
export const softCap = parseUSDT("9000"); // Soft cap
export const manageFeeBps = BigInt(1000); // 10% management fee

// Role constants
export const TOKEN_TRANSFER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TOKEN_TRANSFER_ROLE"));
export const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
export const DEFAULT_ADMIN_ROLE = ethers.ZeroHash; // DEFAULT_ADMIN_ROLE in AccessControl is 0x00

// Deploy MockUSDT contract
export async function deployMockUSDT() {
  const MockUSDTFactory = await ethers.getContractFactory("contracts/v2/mocks/MockUSDT.sol:MockUSDT");
  const mockUSDT = await MockUSDTFactory.deploy("Mock USDT", "USDT");
  return mockUSDT;
}

// Deploy ValidatorRegistry contract
export async function deployValidatorRegistry(validator: any, manager: any) {
  const ValidatorRegistryFactory = await ethers.getContractFactory("ValidatorRegistry");
  const validatorRegistry = await ValidatorRegistryFactory.deploy(validator.address, manager.address);
  await validatorRegistry.waitForDeployment();
  return validatorRegistry;
}

// Deploy CoreVault through factory contract
export async function createVault(manager: any, validatorRegistry: any, whitelistEnabled: boolean = true, initialWhitelist: string[] = []) {
  // Deploy CoreVaultTemplateFactory
  const CoreVaultTemplateFactoryFactory = await ethers.getContractFactory("CoreVaultTemplateFactory");
  const coreVaultTemplateFactory = await CoreVaultTemplateFactoryFactory.deploy();
  await coreVaultTemplateFactory.waitForDeployment();
  
  // Initialize CoreVault, enable whitelist
  const vaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "bool", "address[]"],
    [manager.address, await validatorRegistry.getAddress(), whitelistEnabled, initialWhitelist]
  );
  
  // Deploy vault using factory, set guardian as manager
  const deployTx = await coreVaultTemplateFactory.newVault(vaultInitData, manager.address);
  const receipt = await deployTx.wait();
  
  if (!receipt) {
    throw new Error("Failed to get transaction receipt");
  }
  
  // Get deployed contract address from event
  const deployEvent = receipt.logs.find((log: any) => {
    try {
      const parsedLog = coreVaultTemplateFactory.interface.parseLog(log);
      return parsedLog && parsedLog.name === "VaultDeployed";
    } catch (e) {
      return false;
    }
  });
  
  if (!deployEvent) {
    throw new Error("Failed to deploy CoreVault through factory");
  }
  
  const parsedLog = coreVaultTemplateFactory.interface.parseLog(deployEvent);
  if (!parsedLog) {
    throw new Error("Failed to parse VaultDeployed event");
  }
  
  const [vaultAddress, proxyAdminAddress, vaultImplAddress] = parsedLog.args;
  
  // Get contract instance
  const coreVault = await ethers.getContractAt("CoreVault", vaultAddress);
  const proxyAdmin = await ethers.getContractAt("ProxyAdmin", proxyAdminAddress);
  const vaultImpl = await ethers.getContractAt("CoreVault", vaultImplAddress);
  
  return { coreVault, proxyAdmin, vaultImpl, coreVaultTemplateFactory };
}

// Deploy ShareToken contract
export async function deployShareToken(vault: any) {
  const ShareTokenFactory = await ethers.getContractFactory("ShareToken");
  const shareToken = await ShareTokenFactory.deploy();
  await shareToken.waitForDeployment();
  
  // Initialize ShareToken
  const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["string", "string", "uint8"],
    ["Test Share Token", "TST", SHARE_TOKEN_DECIMALS]
  );
  await shareToken.initiate(await vault.getAddress(), tokenInitData);
  
  return shareToken;
}

// Deploy ShareToken through factory contract
export async function createShareToken(coreVault: any, manager: any) {
  // Deploy ShareTokenTemplateFactory
  const ShareTokenTemplateFactoryFactory = await ethers.getContractFactory("ShareTokenTemplateFactory");
  const shareTokenTemplateFactory = await ShareTokenTemplateFactoryFactory.deploy();
  await shareTokenTemplateFactory.waitForDeployment();
  
  // Deploy ShareToken using ShareTokenTemplateFactory
  const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["string", "string", "uint8"],
    ["Test Share Token", "TST", SHARE_TOKEN_DECIMALS]
  );
  
  const tokenDeployTx = await shareTokenTemplateFactory.newToken(
    await coreVault.getAddress(),
    tokenInitData,
    manager.address
  );
  const tokenReceipt = await tokenDeployTx.wait();
  
  if (!tokenReceipt) {
    throw new Error("Failed to get transaction receipt");
  }
  
  // Get deployed ShareToken contract address from event
  const tokenDeployEvent = tokenReceipt.logs.find((log: any) => {
    try {
      const parsedLog = shareTokenTemplateFactory.interface.parseLog(log);
      return parsedLog && parsedLog.name === "TokenDeployed";
    } catch (e) {
      return false;
    }
  });
  
  if (!tokenDeployEvent) {
    throw new Error("Failed to deploy ShareToken through factory");
  }
  
  const parsedLog = shareTokenTemplateFactory.interface.parseLog(tokenDeployEvent);
  if (!parsedLog) {
    throw new Error("Failed to parse TokenDeployed event");
  }
  
  const shareTokenAddress = parsedLog.args[0]; // proxy address
  
  // Get ShareToken contract instance
  const shareToken = await ethers.getContractAt("ShareToken", shareTokenAddress);
  
  return { shareToken, shareTokenTemplateFactory };
}

// Deploy Crowdsale contract through factory
export async function createCrowdsale(coreVault: any, shareToken: any, manager: any, crowdsaleInitData: any) {
  // Deploy CrowdsaleTemplateFactory
  const CrowdsaleTemplateFactoryFactory = await ethers.getContractFactory("CrowdsaleTemplateFactory");
  const crowdsaleTemplateFactory = await CrowdsaleTemplateFactoryFactory.deploy();
  await crowdsaleTemplateFactory.waitForDeployment();

  const crowdsaleDeployTx = await crowdsaleTemplateFactory.newFund(
    await coreVault.getAddress(),
    await shareToken.getAddress(),
    crowdsaleInitData,
    manager.address
  );
  const crowdsaleReceipt = await crowdsaleDeployTx.wait();
  
  if (!crowdsaleReceipt) {
    throw new Error("Failed to get transaction receipt");
  }
  
  // Get deployed Crowdsale contract address from event
  const crowdsaleDeployEvent = crowdsaleReceipt.logs.find((log: any) => {
    try {
      const parsedLog = crowdsaleTemplateFactory.interface.parseLog(log);
      return parsedLog && parsedLog.name === "FundDeployed";
    } catch (e) {
      return false;
    }
  });
  
  if (!crowdsaleDeployEvent) {
    throw new Error("Failed to deploy Crowdsale through factory");
  }
  
  const parsedLog = crowdsaleTemplateFactory.interface.parseLog(crowdsaleDeployEvent);
  if (!parsedLog) {
    throw new Error("Failed to parse CrowdsaleDeployed event");
  }
  
  const crowdsaleAddress = parsedLog.args[0]; // proxy address
  // Get Crowdsale contract instance
  const crowdsale = await ethers.getContractAt("Crowdsale", crowdsaleAddress);
  
  return { crowdsale, crowdsaleTemplateFactory };
}

// Create complete test environment
export async function createVaultEnvironment(deployer: any, manager: any, validator: any, funding: any, whitelistEnabled: boolean = true, initialWhitelist: string[] = []) {
  // Deploy ValidatorRegistry
  const validatorRegistry = await deployValidatorRegistry(validator, manager);
  
  // Deploy CoreVault and related contracts
  const { coreVault, proxyAdmin, vaultImpl, coreVaultTemplateFactory } = await createVault(manager, validatorRegistry, whitelistEnabled, initialWhitelist);
  
  // Deploy ShareToken
  const { shareToken, shareTokenTemplateFactory } = await createShareToken(coreVault, manager);
  
  // Configure modules
  await coreVault.connect(manager).configureModules(
    await shareToken.getAddress(),
    funding.address,
    ethers.ZeroAddress
  );
  
  return {
    validatorRegistry,
    coreVault,
    proxyAdmin,
    vaultImpl,
    shareToken,
    coreVaultTemplateFactory,
    shareTokenTemplateFactory
  };
}

export async function deployAccumulatedYield(vault: string, vaultToken: string, manager: any, rewardToken: string, dividendTreasury: any) {
  // Deploy AccumulatedYieldTemplateFactory
  const AccumulatedYieldTemplateFactory = await ethers.getContractFactory("AccumulatedYieldTemplateFactory");
  const accumulatedYieldTemplateFactory = await AccumulatedYieldTemplateFactory.deploy();
  
  // Encode initialization data
  const initData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address"],
    [rewardToken, await manager.getAddress(), dividendTreasury]
  );
  
  // Deploy AccumulatedYield through factory contract
  const tx = await accumulatedYieldTemplateFactory.newYield(
    vault,
    vaultToken,
    initData,
    await manager.getAddress()
  );
  
  const receipt = await tx.wait();
  
  if (!receipt) {
    throw new Error("Transaction receipt is null");
  }
  
  const event = receipt.logs.find((log: any) => {
    try {
      const parsedLog = accumulatedYieldTemplateFactory.interface.parseLog(log);
      return parsedLog && parsedLog.name === "YieldDeployed";
    } catch (e) {
      return false;
    }
  });
  
  if (!event) {
    throw new Error("Failed to deploy AccumulatedYield");
  }
  
  const parsedEvent = accumulatedYieldTemplateFactory.interface.parseLog(event);
  if (!parsedEvent || !parsedEvent.args) {
    throw new Error("Failed to parse YieldDeployed event");
  }
  
  const accumulatedYieldAddress = parsedEvent.args[0];
  
  // Get AccumulatedYield contract instance
  const AccumulatedYield = await ethers.getContractFactory("AccumulatedYield");
  const accumulatedYield = AccumulatedYield.attach(accumulatedYieldAddress);
  
  return { accumulatedYield, accumulatedYieldTemplateFactory };
}

export async function createAccumulatedYield(manager: any, validator: any, dividendTreasury: any, mockUSDT: any) {
   // Deploy ValidatorRegistry
  const validatorRegistry = await deployValidatorRegistry(validator, manager);
  
  // Deploy CoreVault and related contracts
  const { coreVault, proxyAdmin, vaultImpl, coreVaultTemplateFactory } = await createVault(manager, validatorRegistry, false, []);
  
  // Deploy ShareToken
  const { shareToken, shareTokenTemplateFactory } = await createShareToken(coreVault, manager);
  
    const crowdsaleInitData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint256", "address", "uint256", "uint256", "uint256", "uint256", "uint256", "address", "address", "address", "address"],
      [startTime, endTime, await mockUSDT.getAddress(), maxFundingAmount, softCap, sharePrice, minDepositAmount, manageFeeBps, manager.address, manager.address, manager.address, manager.address]
    );
  
  // Deploy Crowdsale
  const { crowdsale, crowdsaleTemplateFactory } = await createCrowdsale(coreVault, shareToken, manager, crowdsaleInitData);
  
  // Deploy AccumulatedYield
  const { accumulatedYield, accumulatedYieldTemplateFactory } = await deployAccumulatedYield(
    await coreVault.getAddress(),
    await shareToken.getAddress(),
    manager,
    await mockUSDT.getAddress(),
    await dividendTreasury.getAddress()
  );

  // Initialize modules
  await coreVault.connect(manager).configureModules(
    await shareToken.getAddress(),
    await crowdsale.getAddress(),
    await accumulatedYield.getAddress()
  );

  return {
    validatorRegistry,
    coreVault,
    shareToken,
    crowdsale,
    accumulatedYield,
  };
}

// Generate signature
export async function generateDepositSignature(signer: any, operation: string, amount: bigint, receiver: string, nonce: number, chainId: bigint, contractAddress: string) {
  // Create signature data
  const sigData = {
    operation,
    amount,
    receiver,
    nonce,
    chainId,
    contractAddress
  };
  
  // Encode signature data - use encodePacked method to match contract
  // Note: We need to use solidityPacked to simulate Solidity's abi.encodePacked
  const encodedData = ethers.solidityPacked(
    ["string", "uint256", "address", "uint256", "uint256", "address"],
    [sigData.operation, sigData.amount, sigData.receiver, sigData.nonce, sigData.chainId, sigData.contractAddress]
  );
  
  // Calculate hash
  const messageHash = ethers.keccak256(encodedData);
  
  // Sign
  const signature = await signer.signMessage(ethers.getBytes(messageHash));
  
  return signature;
}
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// Add delay function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Set different sleep times based on network type
const getSleepTime = (networkName: string): number => {
  if (networkName === 'hardhat' || networkName === 'localhost') {
    return 100; // Local network sleep 100ms
  }
  return 5000; // Other networks sleep 5s
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("=== Deploying V2 Template Registries ===\n");

  // 1. Deploy VaultTemplateRegistry
  console.log("Deploying VaultTemplateRegistry...");
  const vaultRegistry = await deploy("VaultTemplateRegistry", {
    contract: "contracts/v2/templateRegistry/VaultTemplateRegistry.sol:VaultTemplateRegistry",
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
    skipIfAlreadyDeployed: false,
  });
  console.log(`✓ VaultTemplateRegistry deployed to: ${vaultRegistry.address}\n`);
  
  // Add delay to avoid nonce errors
  const sleepTime = getSleepTime(network.name);
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);

  // 2. Deploy TokenTemplateRegistry
  console.log("Deploying TokenTemplateRegistry...");
  const tokenRegistry = await deploy("TokenTemplateRegistry", {
    contract: "contracts/v2/templateRegistry/TokenTemplateRegistry.sol:TokenTemplateRegistry",
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
    skipIfAlreadyDeployed: false,
  });
  console.log(`✓ TokenTemplateRegistry deployed to: ${tokenRegistry.address}\n`);
  
  // Add delay to avoid nonce errors
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);

  // 3. Deploy FundTemplateRegistry
  console.log("Deploying FundTemplateRegistry...");
  const fundRegistry = await deploy("FundTemplateRegistry", {
    contract: "contracts/v2/templateRegistry/FundTemplateRegistry.sol:FundTemplateRegistry",
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
    skipIfAlreadyDeployed: false,
  });
  console.log(`✓ FundTemplateRegistry deployed to: ${fundRegistry.address}\n`);
  
  // Add delay to avoid nonce errors
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);

  // 4. Deploy YieldTemplateRegistry
  console.log("Deploying YieldTemplateRegistry...");
  const yieldRegistry = await deploy("YieldTemplateRegistry", {
    contract: "contracts/v2/templateRegistry/YieldTemplateRegistry.sol:YieldTemplateRegistry",
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
    skipIfAlreadyDeployed: false,
  });
  console.log(`✓ YieldTemplateRegistry deployed to: ${yieldRegistry.address}\n`);
  
  // Add delay to avoid nonce errors
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);

  // Get deployed template factories
  const coreVaultFactory = await get("CoreVaultTemplateFactory");
  const fundVaultFactory = await get("FundVaultTemplateFactory");
  const shareTokenFactory = await get("ShareTokenTemplateFactory");
  const crowdsaleFactory = await get("CrowdsaleTemplateFactory");
  const accumulatedYieldFactory = await get("AccumulatedYieldTemplateFactory");
  const fundYieldFactory = await get("FundYieldTemplateFactory");

  console.log("=== Adding Template Factories to Corresponding Template Registries ===\n");

  // 5. Add template factories to corresponding registries
  // 5.1.1 Add CoreVaultTemplateFactory to VaultTemplateRegistry
  console.log("Adding CoreVaultTemplateFactory to VaultTemplateRegistry...");
  const vaultRegistryContract = await ethers.getContractAt("VaultTemplateRegistry", vaultRegistry.address);
  await vaultRegistryContract.addTemplate(1,coreVaultFactory.address);
  console.log(`✓ CoreVaultTemplateFactory added to VaultTemplateRegistry\n`);
  // Add delay to avoid nonce errors
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);

  // 5.1.2 Add FundVaultTemplateFactory to VaultTemplateRegistry
  await vaultRegistryContract.addTemplate(2,fundVaultFactory.address);
  console.log(`✓ FundVaultTemplateFactory added to VaultTemplateRegistry\n`);
  // Add delay to avoid nonce errors
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);


  // 5.2 Add ShareTokenTemplateFactory to TokenTemplateRegistry
  console.log("Adding ShareTokenTemplateFactory to TokenTemplateRegistry...");
  const tokenRegistryContract = await ethers.getContractAt("TokenTemplateRegistry", tokenRegistry.address);
  await tokenRegistryContract.addTemplate(1, shareTokenFactory.address);
  console.log(`✓ ShareTokenTemplateFactory added to TokenTemplateRegistry\n`);
  // Add delay to avoid nonce errors
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);

  // 5.3 Add CrowdsaleTemplateFactory to FundTemplateRegistry
  console.log("Adding CrowdsaleTemplateFactory to FundTemplateRegistry...");
  const fundRegistryContract = await ethers.getContractAt("FundTemplateRegistry", fundRegistry.address);
  await fundRegistryContract.addTemplate(1, crowdsaleFactory.address);
  console.log(`✓ CrowdsaleTemplateFactory added to FundTemplateRegistry\n`);
  // Add delay to avoid nonce errors
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);

  // 5.4.1 Add AccumulatedYieldTemplateFactory to YieldTemplateRegistry
  console.log("Adding AccumulatedYieldTemplateFactory to YieldTemplateRegistry...");
  const yieldRegistryContract = await ethers.getContractAt("YieldTemplateRegistry", yieldRegistry.address);
  await yieldRegistryContract.addTemplate(1, accumulatedYieldFactory.address);
  console.log(`✓ AccumulatedYieldTemplateFactory added to YieldTemplateRegistry\n`);
  // Add delay to avoid nonce errors
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);


  // 5.4.2 Add FundYieldTemplateFactory to YieldTemplateRegistry
  console.log("Adding FundYieldTemplateFactory to YieldTemplateRegistry...");
  await yieldRegistryContract.addTemplate(2, fundYieldFactory.address);
  console.log(`✓ FundYieldTemplateFactory added to YieldTemplateRegistry\n`);
  // Add delay to avoid nonce errors
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);
};

export default func;
func.tags = ["v2-template-registry"];
func.dependencies = ["v2-template-factories"];
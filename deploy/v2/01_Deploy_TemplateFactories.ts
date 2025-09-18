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
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("=== Deploying V2 Template Factories ===\n");

  // Get deployed template contracts
  const coreVault = await get("CoreVault");
  const shareToken = await get("ShareToken");
  const crowdsale = await get("Crowdsale");
  const accumulatedYield = await get("AccumulatedYield");

  // 1. Deploy CoreVaultTemplateFactory
  console.log("Deploying CoreVaultTemplateFactory...");
  const coreVaultFactory = await deploy("CoreVaultTemplateFactory", {
    contract: "contracts/v2/factories/vault/CoreVaultTemplateFactory.sol:CoreVaultTemplateFactory",
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
    skipIfAlreadyDeployed: false,
  });
  console.log(`✓ CoreVaultTemplateFactory deployed to: ${coreVaultFactory.address}\n`);
  
  // Add delay to avoid nonce errors
  const sleepTime = getSleepTime(network.name);
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);

  // 2. Deploy ShareTokenTemplateFactory
  console.log("Deploying ShareTokenTemplateFactory...");
  const shareTokenFactory = await deploy("ShareTokenTemplateFactory", {
    contract: "contracts/v2/factories/token/ShareTokenTemplateFactory.sol:ShareTokenTemplateFactory",
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
    skipIfAlreadyDeployed: false,
  });
  console.log(`✓ ShareTokenTemplateFactory deployed to: ${shareTokenFactory.address}\n`);
  
  // Add delay to avoid nonce errors
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);

  // 3. Deploy CrowdsaleTemplateFactory
  console.log("Deploying CrowdsaleTemplateFactory...");
  const crowdsaleFactory = await deploy("CrowdsaleTemplateFactory", {
    contract: "contracts/v2/factories/funding/CrowdsaleTemplateFactory.sol:CrowdsaleTemplateFactory",
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
    skipIfAlreadyDeployed: false,
  });
  console.log(`✓ CrowdsaleTemplateFactory deployed to: ${crowdsaleFactory.address}\n`);
  
  // Add delay to avoid nonce errors
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);

  // 4. Deploy AccumulatedYieldTemplateFactory
  console.log("Deploying AccumulatedYieldTemplateFactory...");
  const accumulatedYieldFactory = await deploy("AccumulatedYieldTemplateFactory", {
    contract: "contracts/v2/factories/yield/AccumulatedYieldTemplateFactory.sol:AccumulatedYieldTemplateFactory",
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
    skipIfAlreadyDeployed: false,
  });
  console.log(`✓ AccumulatedYieldTemplateFactory deployed to: ${accumulatedYieldFactory.address}\n`);

  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);
};

export default func;
func.tags = ["v2-template-factories"];
func.dependencies = [];
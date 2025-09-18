import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// Add delay function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get sleep time based on network type
const getSleepTime = (networkName: string): number => {
  // Local networks use shorter delay
  if (networkName === "hardhat" || networkName === "localhost") {
    return 100; // 100 milliseconds
  }
  // Other networks use longer delay
  return 5000; // 5 seconds
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();
  
  // Set sleep time based on network type
  const sleepTime = getSleepTime(network.name);

  console.log("=== Deploying V2 Creation Contract ===\n");

  // Get deployed template registries
  const vaultRegistry = await get("VaultTemplateRegistry");
  const tokenRegistry = await get("TokenTemplateRegistry");
  const fundRegistry = await get("FundTemplateRegistry");
  const yieldRegistry = await get("YieldTemplateRegistry");

  // Deploy Creation contract
  console.log("Deploying Creation contract...");
  const creation = await deploy("Creation", {
    contract: "contracts/v2/creation/Creation.sol:Creation",
    from: deployer,
    args: [
      vaultRegistry.address,
      tokenRegistry.address,
      fundRegistry.address,
      yieldRegistry.address,
      [] // initialManagers
    ],
    log: true,
    waitConfirmations: 1,
    skipIfAlreadyDeployed: false,
  });
  console.log(`✓ Creation contract deployed to: ${creation.address}\n`);
  
  // Add delay to avoid nonce errors
  console.log(`Waiting ${sleepTime/1000} seconds...`);
  await sleep(sleepTime);
  
  console.log("V2 deployment completed!");
};

export default func;
func.tags = ["v2-creation"];
func.dependencies = ["v2-template-registry"];
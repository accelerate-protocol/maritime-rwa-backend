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
  // Add id to the function to prevent re-execution
  func.id = "deploy_validator_registry";
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("=== Deploying ValidatorRegistry Contract ===\n");


  // Set validator based on network type
  let validator: string;
  if (network.name === 'localhost' || network.name === 'hardhat') {
    validator = deployer;
  } else {
    validator = process.env.VALIDATOR_ADDRESS || deployer;
  }
  
  const manager = process.env.MANAGER_ADDRESS || deployer;

  console.log(`Deploying ValidatorRegistry with validator: ${validator} and manager: ${manager}`);
  
  const validatorRegistry = await deploy("ValidatorRegistry", {
    contract: "contracts/v2/common/ValidatorRegistry.sol:ValidatorRegistry",
    from: deployer,
    args: [validator, manager],
    log: true,
    waitConfirmations: 1,
    skipIfAlreadyDeployed: false,
  });

  await sleep(getSleepTime(network.name));

  console.log(`ValidatorRegistry deployed at: ${validatorRegistry.address}\n`);

  return true;
};

func.tags = ["ValidatorRegistry"];
func.dependencies = [];

export default func;
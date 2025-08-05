import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("=== 部署 V2 Creation 部署器 ===");

  // ============ 获取工厂地址 ============
  console.log("获取工厂地址...");
  
  // 获取已部署的工厂合约地址
  const vaultFactory = await get("VaultFactory");
  const tokenFactory = await get("TokenFactory");
  const fundFactory = await get("FundFactory");
  const accumulatedYieldFactory = await get("AccumulatedYieldFactory");

  console.log("VaultFactory:", vaultFactory.address);
  console.log("TokenFactory:", tokenFactory.address);
  console.log("FundFactory:", fundFactory.address);
  console.log("AccumulatedYieldFactory:", accumulatedYieldFactory.address);

  // ============ 部署Creation合约 ============
  
  const creation = await deploy("Creation", {
    from: deployer,
    contract: "contracts/v2/creation/Creation.sol:Creation",
    args: [
      vaultFactory.address,
      tokenFactory.address,
      fundFactory.address,
      accumulatedYieldFactory.address
    ],
    log: true,
    waitConfirmations: 1,
  });

  console.log("✓ Creation合约部署完成");

  // ============ 验证配置 ============
  console.log("\n=== 验证 Creation 配置 ===");
  
  const creationContract = await ethers.getContractAt("Creation", creation.address);
  const factories = await creationContract.getFactories();
  console.log("VaultFactory:", factories[0]);
  console.log("TokenFactory:", factories[1]); 
  console.log("FundFactory:", factories[2]);
  console.log("AccumulatedYieldFactory:", factories[3]);

  console.log("=== V2 Creation 部署完成 ===");
  console.log("Creation:", creation.address);
};

export default func;
func.tags = ["v2-creation"];
func.dependencies = ["v2-factories"]; // 依赖工厂部署 
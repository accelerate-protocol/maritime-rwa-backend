import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("=== 部署 V2 工厂合约 ===");

  // 1. 部署 VaultFactory
  console.log("部署 VaultFactory...");
  const vaultFactory = await deploy("VaultFactory", {
    contract: "contracts/v2/factories/VaultFactory.sol:VaultFactory",
    from: deployer,
    args: [],
    log: true,
  });
  console.log("VaultFactory 地址:", vaultFactory.address);

  // 2. 部署 TokenFactory
  console.log("部署 TokenFactory...");
  const tokenFactory = await deploy("TokenFactory", {
    contract: "contracts/v2/factories/TokenFactory.sol:TokenFactory",
    from: deployer,
    args: [],
    log: true,
  });
  console.log("TokenFactory 地址:", tokenFactory.address);

  // 3. 部署 FundFactory
  console.log("部署 FundFactory...");
  const fundFactory = await deploy("FundFactory", {
    contract: "contracts/v2/factories/FundFactory.sol:FundFactory",
    from: deployer,
    args: [],
    log: true,
  });
  console.log("FundFactory 地址:", fundFactory.address);

  // 4. 部署 YieldFactory
  console.log("部署 YieldFactory...");
  const YieldFactory = await deploy("YieldFactory", {
    contract: "contracts/v2/factories/YieldFactory.sol:YieldFactory",
    from: deployer,
    args: [],
    log: true,
  });
  console.log("YieldFactory 地址:", YieldFactory.address);

  console.log("=== 添加 Mock 模板到工厂 ===");

  // 获取已部署的模板合约
  const mockBasicVault = await get("MockBasicVault");
  const mockERC20 = await get("MockERC20");
  const mockCrowdsale = await get("MockCrowdsale");
  const mockAccumulatedYield = await get("MockAccumulatedYield");

  // 5. 添加模板到 VaultFactory
  console.log("添加 MockBasicVault 到 VaultFactory...");
  const vaultFactoryContract = await hre.ethers.getContractAt("contracts/v2/factories/VaultFactory.sol:VaultFactory", vaultFactory.address);
  await (await vaultFactoryContract.addTemplate(0, mockBasicVault.address)).wait();
  console.log("MockBasicVault 已添加到 VaultFactory (templateId: 0)");

  // 6. 添加模板到 TokenFactory
  console.log("添加 MockERC20 到 TokenFactory...");
  const tokenFactoryContract = await hre.ethers.getContractAt("contracts/v2/factories/TokenFactory.sol:TokenFactory", tokenFactory.address);
  await (await tokenFactoryContract.addTemplate(0, mockERC20.address)).wait();
  console.log("MockERC20 已添加到 TokenFactory (templateId: 0)");

  // 7. 添加模板到 FundFactory
  console.log("添加 MockCrowdsale 到 FundFactory...");
  const fundFactoryContract = await hre.ethers.getContractAt("contracts/v2/factories/FundFactory.sol:FundFactory", fundFactory.address);
  await (await fundFactoryContract.addTemplate(0, mockCrowdsale.address)).wait();
  console.log("MockCrowdsale 已添加到 FundFactory (templateId: 0)");

  // 8. 添加模板到 YieldFactory
  console.log("添加 MockAccumulatedYield 到 YieldFactory...");
  const YieldFactoryContract = await hre.ethers.getContractAt("contracts/v2/factories/YieldFactory.sol:YieldFactory", YieldFactory.address);
  await (await YieldFactoryContract.addTemplate(0, mockAccumulatedYield.address)).wait();
  console.log("MockAccumulatedYield 已添加到 YieldFactory (templateId: 0)");

  console.log("=== V2 工厂合约部署完成 ===");
};

export default func;
func.tags = ["v2-factories"];
func.dependencies = ["v2-templates"]; // 依赖模板部署 
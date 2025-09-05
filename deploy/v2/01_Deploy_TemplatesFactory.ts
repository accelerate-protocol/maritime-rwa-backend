import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("=== 部署 V2 模板合约 ===");

  // 1. 部署 BasicVault 模板
  console.log("部署 BasicVaultFactory 模板...");
  const basicVault = await deploy("BasicVaultFactory", {
    contract: "contracts/v2/templateFactories/vault/BasicVaultFactory.sol:BasicVaultFactory",
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });
  console.log("BasicVault 模板地址:", basicVault.address);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2. 部署 VaultToken 模板
  console.log("部署 VaultTokenFactory 模板...");
  const vaultToken = await deploy("VaultTokenFactory", {
    contract: "contracts/v2/templateFactories/token/VaultTokenFactory.sol:VaultTokenFactory",
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });
  console.log("VaultToken 模板地址:", vaultToken.address);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 3. 部署 funding 模板
  console.log("部署 funding 模板...");
  const crowdsale = await deploy("CrowdsaleFactory", {
    contract: "contracts/v2/templateFactories/funding/CrowdsaleFactory.sol:CrowdsaleFactory",
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });
  console.log("funding 模板地址:", crowdsale.address);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 4. 部署 Yield 模板
  console.log("部署 Yield 模板...");
  const accumulatedYield = await deploy("AccumulatedYieldFactory", {
    contract: "contracts/v2/templateFactories/yield/AccumulatedYieldFactory.sol:AccumulatedYieldFactory",
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });
  console.log("Yield 模板地址:", accumulatedYield.address);
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 5. 部署 MockUSDT（仅非主网环境）
  if (hre.network.name !== "mainnet" && hre.network.name !== "bsc" && hre.network.name !== "bscmainnet") {
    console.log("部署 MockUSDT...");
    const mockUSDT = await deploy("MockUSDT", {
      contract: "contracts/v2/mocks/MockUSDT.sol:MockUSDT",
      from: deployer,
      args: ["Mock USDT", "USDT"],
      log: true,
      waitConfirmations: 1,
    });
    console.log("MockUSDT 地址:", mockUSDT.address);
    await new Promise(resolve => setTimeout(resolve, 2000));
  } else {
    console.log("主网环境，跳过 MockUSDT 部署");
  }

  console.log("=== V2 模板部署完成 ===");
};

export default func;
func.tags = ["v2-infrastructure", "v2-templates"]; 
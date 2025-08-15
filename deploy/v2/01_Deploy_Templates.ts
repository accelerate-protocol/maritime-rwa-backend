import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("=== 部署 V2 模板合约 ===");

  // 1. 部署 BasicVault 模板
  console.log("部署 BasicVault 模板...");
  const basicVault = await deploy("BasicVault", {
    contract: "contracts/v2/templates/vault/BasicVault.sol:BasicVault",
    from: deployer,
    args: [],
    log: true,
  });
  console.log("BasicVault 模板地址:", basicVault.address);

  // 2. 部署 VaultToken 模板
  console.log("部署 VaultToken 模板...");
  const vaultToken = await deploy("VaultToken", {
    contract: "contracts/v2/templates/token/VaultToken.sol:VaultToken",
    from: deployer,
    args: [],
    log: true,
  });
  console.log("VaultToken 模板地址:", vaultToken.address);

  // 3. 部署 funding 模板
  console.log("部署 funding 模板...");
  const crowdsale = await deploy("Crowdsale", {
    contract: "contracts/v2/templates/funding/Crowdsale.sol:Crowdsale",
    from: deployer,
    args: [],
    log: true,
  });
  console.log("funding 模板地址:", crowdsale.address);

  // 4. 部署 Yield 模板
  console.log("部署 Yield 模板...");
  const accumulatedYield = await deploy("AccumulatedYield", {
    contract: "contracts/v2/templates/yield/AccumulatedYield.sol:AccumulatedYield",
    from: deployer,
    args: [],
    log: true,
  });
  console.log("Yield 模板地址:", accumulatedYield.address);

  // 5. 部署 MockUSDT（仅非主网环境）
  if (hre.network.name !== "mainnet" && hre.network.name !== "bsc" && hre.network.name !== "bscmainnet") {
    console.log("部署 MockUSDT...");
    const mockUSDT = await deploy("MockUSDT", {
      contract: "contracts/v2/mocks/MockUSDT.sol:MockUSDT",
      from: deployer,
      args: ["Mock USDT", "USDT"],
      log: true,
    });
    console.log("MockUSDT 地址:", mockUSDT.address);
  } else {
    console.log("主网环境，跳过 MockUSDT 部署");
  }

  console.log("=== V2 模板部署完成 ===");
};

export default func;
func.tags = ["v2-templates"]; 
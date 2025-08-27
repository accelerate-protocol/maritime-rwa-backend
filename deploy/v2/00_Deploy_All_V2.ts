import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();

  console.log("==========================================");
  console.log("      开始部署 Accelerate V2 架构         ");
  console.log("==========================================");
  console.log("部署账户 (deployer):", deployer);
  console.log("网络 (network):", hre.network.name);
  console.log("区块号 (block number):", await hre.ethers.provider.getBlockNumber());
  console.log("==========================================");
  console.log(`
  V2架构部署顺序：
  
  1. 📄 部署模板合约 (Templates)
     ├── Vault 模板（如 BasicVault 等）
     ├── Token 模板（如 VaultToken 等）
     ├── Fund 模板（如 Crowdsale 等）
     └── Yield 模板（如 AccumulatedYield 等）
  
  2. 🏭 部署工厂合约 (Factories)
     ├── VaultFactory
     ├── TokenFactory
     ├── FundFactory
     └── YieldFactory
  
  3. 🔗 添加模板到工厂
     └── 为每个模板分配ID
  
  4. 🚀 部署 Creation 部署器
     └── 设置工厂地址，支持白名单权限
  开始执行...
  `);
};

export default func;
func.tags = ["v2-overview"];
func.dependencies = []; // 最先执行
func.runAtTheEnd = false; 
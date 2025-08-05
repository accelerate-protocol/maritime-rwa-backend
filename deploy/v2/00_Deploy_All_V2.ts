import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();

  console.log("==========================================");
  console.log("      开始部署 Accelerate V2 架构         ");
  console.log("==========================================");
  console.log("部署账户:", deployer);
  console.log("网络:", hre.network.name);
  console.log("区块号:", await hre.ethers.provider.getBlockNumber());
  console.log("==========================================");

  console.log(`
  V2架构部署顺序:
  
  1. 📄 部署模板合约 (Templates)
     ├── Vault 模板 (BasicVault, MultiSigVault, UpgradeableVault)
     ├── Token 模板 (StandardToken, GovernanceToken, TaxToken)  
     ├── Fund 模板 (Crowdsale, DutchAuction, BondingCurve)
     └── Yield 模板 (Dividend, Staking, LiquidityMining)
  
  2. 🏭 部署工厂合约 (Factories)
     ├── VaultFactory
     ├── TokenFactory
     ├── FundFactory
     └── DividendFactory
  
  3. 🔗 添加模板到工厂
     └── 为每个模板分配ID
  
  4. 🚀 部署Creation部署器
     └── 设置工厂地址
  
  5. ✅ 部署示例项目
     ├── 标准众筹项目
     └── 治理DAO项目
  
  开始执行...
  `);
};

export default func;
func.tags = ["v2-overview"];
func.dependencies = []; // 最先执行
func.runAtTheEnd = false; 
# V2部署命令参考

## Package.json Scripts 配置

在你的 `package.json` 中添加以下脚本：

```json
{
  "scripts": {
    "deploy:v2": "hardhat deploy --tags v2",
    "deploy:v2:local": "hardhat deploy --tags v2 --network localhost",
    "deploy:v2:testnet": "hardhat deploy --tags v2 --network goerli",
    "deploy:v2:mainnet": "hardhat deploy --tags v2 --network mainnet",
    
    "deploy:v2:templates": "hardhat deploy --tags v2-templates",
    "deploy:v2:factories": "hardhat deploy --tags v2-factories", 
    "deploy:v2:creation": "hardhat deploy --tags v2-creation",
    "deploy:v2:example": "hardhat deploy --tags v2-example",
    
    "verify:v2": "hardhat run scripts/verify-v2-deployment.js",
    "test:v2": "hardhat test test/v2/*.test.js",
    
    "clean:deployments": "rm -rf deployments/",
    "node": "hardhat node",
    
    "deploy:v2:reset": "npm run clean:deployments && npm run deploy:v2:local"
  }
}
```

## 完整部署流程

### 1. 本地开发环境

```bash
# 启动本地节点
npm run node

# 新终端窗口 - 部署V2架构  
npm run deploy:v2:local

# 验证部署
npm run verify:v2 -- --network localhost

# 运行测试
npm run test:v2
```

### 2. 测试网部署

```bash
# 部署到Goerli测试网
npm run deploy:v2:testnet

# 验证合约
npx hardhat verify --network goerli <contract_address>
```

### 3. 主网部署

```bash
# ⚠️ 谨慎操作 - 主网部署
npm run deploy:v2:mainnet

# 验证关键合约
npx hardhat verify --network mainnet <creation_address>
```

## 分步部署命令

### 基础组件部署

```bash
# 1. 部署模板合约
npm run deploy:v2:templates

# 2. 部署工厂合约并注册模板
npm run deploy:v2:factories

# 3. 部署Creation部署器
npm run deploy:v2:creation

# 4. 部署示例项目（可选）
npm run deploy:v2:example
```

### 自定义部署

```bash
# 只部署特定组件
npx hardhat deploy --tags v2-templates --network localhost
npx hardhat deploy --tags v2-factories --network localhost

# 跳过示例项目
SKIP_EXAMPLE=true npm run deploy:v2:local

# 指定gas价格
npx hardhat deploy --tags v2 --network mainnet --gas-price 20000000000
```

## 环境变量配置

创建 `.env` 文件：

```bash
# 网络配置
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
GOERLI_RPC_URL=https://goerli.infura.io/v3/YOUR_PROJECT_ID
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# 私钥（谨慎保管）
PRIVATE_KEY=your_private_key_here
DEPLOYER_PRIVATE_KEY=your_deployer_private_key

# 验证密钥
ETHERSCAN_API_KEY=your_etherscan_api_key

# 部署配置
SKIP_EXAMPLE=false
GAS_LIMIT=8000000
GAS_PRICE=20000000000

# 项目配置
DEFAULT_VAULT_VALIDATOR=0x1234567890123456789012345678901234567890
DEFAULT_FUNDING_RECEIVER=0x1234567890123456789012345678901234567890
DEFAULT_MANAGEMENT_FEE_BPS=250
```

## Hardhat配置

更新 `hardhat.config.ts`：

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "hardhat-deploy-ethers";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 5,
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1,
      gasPrice: parseInt(process.env.GAS_PRICE || "20000000000"),
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
      localhost: 0,
      goerli: 0,
      mainnet: 0,
    },
    validator: {
      default: 1,
      localhost: 1,
      goerli: process.env.DEFAULT_VAULT_VALIDATOR || 1,
      mainnet: process.env.DEFAULT_VAULT_VALIDATOR || 1,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  paths: {
    deploy: "deploy/v2",
    deployments: "deployments",
  },
};

export default config;
```

## 部署后验证脚本

创建 `scripts/verify-v2-deployment.js`：

```javascript
const hre = require("hardhat");

async function main() {
  const { deployments, getNamedAccounts } = hre;
  const { deployer } = await getNamedAccounts();
  
  console.log("=== V2架构部署验证 ===");
  console.log("网络:", hre.network.name);
  console.log("部署账户:", deployer);
  
  try {
    // 验证关键合约
    const creation = await deployments.get("Creation");
    const vaultFactory = await deployments.get("VaultFactory");
    const tokenFactory = await deployments.get("TokenFactory");
    
    console.log("\n=== 关键合约地址 ===");
    console.log("Creation:", creation.address);
    console.log("VaultFactory:", vaultFactory.address);
    console.log("TokenFactory:", tokenFactory.address);
    
    // 验证配置
    const creationContract = await hre.ethers.getContractAt("Creation", creation.address);
    const factories = await creationContract.getFactories();
    
    console.log("\n=== Creation配置验证 ===");
    console.log("VaultFactory:", factories[0]);
    console.log("TokenFactory:", factories[1]);
    console.log("FundFactory:", factories[2]);
    console.log("DividendFactory:", factories[3]);
    
    // 验证项目数量
    const projectCount = await creationContract.getProjectCount();
    console.log("已部署项目数量:", projectCount.toString());
    
    console.log("\n✅ V2架构验证完成");
    
  } catch (error) {
    console.error("验证失败:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

## 常用操作命令

```bash
# 重置并重新部署
npm run deploy:v2:reset

# 查看部署状态
npx hardhat deploy --network localhost --dry-run

# 导出ABI
npx hardhat export --export-all ./deployments/abi.json

# 查看gas使用情况
npx hardhat deploy --network localhost --report-gas

# 清理部署文件
npm run clean:deployments

# 验证所有合约
for contract in VaultFactory TokenFactory FundFactory DividendFactory Creation; do
  npx hardhat verify --network goerli $(jq -r ".$contract.address" deployments/goerli.json)
done
```

这套完整的部署系统让V2架构的部署和管理变得非常简单和可靠！ 
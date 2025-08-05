# V2架构部署脚本说明

## 概览

V2架构采用模块化的工厂模式设计，部署脚本按以下顺序执行：

```
00_Deploy_All_V2.ts       - 部署概览和说明
01_Deploy_Templates.ts    - 部署模板合约
02_Deploy_Factories.ts    - 部署工厂合约并注册模板
03_Deploy_Creation.ts     - 部署Creation部署器
04_Deploy_Example_Project.ts - 部署示例项目
```

## 部署顺序

### 1. 模板合约部署 (Templates)

部署各种功能模板：

**Vault模板**:
- `BasicVault` (ID: 0) - 基础权限管理
- `MultiSigVault` (ID: 1) - 多签名管理  
- `UpgradeableVault` (ID: 2) - 可升级合约

**Token模板**:
- `StandardToken` (ID: 0) - 标准ERC20
- `GovernanceToken` (ID: 1) - 治理代币
- `TaxToken` (ID: 2) - 带税收代币

**Fund模板**:
- `Crowdsale` (ID: 0) - 众筹
- `DutchAuction` (ID: 1) - 荷兰拍
- `BondingCurve` (ID: 2) - 联合曲线

**Yield模板**:
- `Dividend` (ID: 0) - 派息
- `Staking` (ID: 1) - 质押
- `LiquidityMining` (ID: 2) - 流动性挖矿

### 2. 工厂合约部署 (Factories)

部署四个工厂合约：
- `VaultFactory` - 管理Vault模板
- `TokenFactory` - 管理Token模板
- `FundFactory` - 管理Fund模板
- `DividendFactory` - 管理Dividend模板

每个工厂都会添加对应的模板并分配ID。

### 3. Creation部署器

部署`Creation`合约并设置工厂地址，提供一键部署功能。

### 4. 示例项目

部署两个示例项目展示系统功能：
- 标准众筹项目
- 治理DAO项目

## 使用方法

### 基础部署

```bash
# 部署所有V2组件
npx hardhat deploy --tags v2

# 或分步部署
npx hardhat deploy --tags v2-templates
npx hardhat deploy --tags v2-factories  
npx hardhat deploy --tags v2-creation

# 部署示例项目（可选）
npx hardhat deploy --tags v2-example
```

### 环境变量

```bash
# 跳过示例项目部署
export SKIP_EXAMPLE=true

# 指定网络
npx hardhat deploy --network localhost
npx hardhat deploy --network goerli
npx hardhat deploy --network mainnet
```

### 验证部署

```bash
# 验证合约
npx hardhat verify --network <network> <contract_address>

# 查看部署结果
npx hardhat run scripts/verify-v2-deployment.js --network <network>
```

## 部署后配置

### 1. 设置权限

```javascript
// 设置工厂权限
await vaultFactory.transferOwnership(newOwner);
await tokenFactory.transferOwnership(newOwner);
await fundFactory.transferOwnership(newOwner);
await dividendFactory.transferOwnership(newOwner);

// 设置Creation权限
await creation.transferOwnership(newOwner);
```

### 2. 添加新模板

```javascript
// 添加新的Vault模板
await vaultFactory.addTemplate(3, newVaultTemplate);

// 添加新的Token模板
await tokenFactory.addTemplate(3, newTokenTemplate);
```

### 3. 部署自定义项目

```javascript
const creation = await ethers.getContractAt("Creation", creationAddress);

// 准备初始化数据
const vaultInitData = ethers.utils.defaultAbiCoder.encode(
  ["address", "bool", "address[]"],
  [manager, true, whitelistAddresses]
);

const tokenInitData = ethers.utils.defaultAbiCoder.encode(
  ["string", "string", "uint8"],
  ["My Project Token", "MPT", 18]
);

// 部署项目
const result = await creation.deployAll(
  0, vaultInitData,    // BasicVault
  0, tokenInitData,    // StandardToken
  0, fundInitData,     // Crowdsale
  0, dividendInitData  // Dividend
);
```

## 网络配置

### 本地测试网

```bash
# 启动本地节点
npx hardhat node

# 部署到本地网络
npx hardhat deploy --network localhost
```

### 测试网部署

```bash
# Goerli测试网
npx hardhat deploy --network goerli

# Sepolia测试网  
npx hardhat deploy --network sepolia
```

### 主网部署

```bash
# 主网部署（谨慎操作）
npx hardhat deploy --network mainnet
```

## 故障排除

### 常见问题

1. **Gas估算失败**
   ```bash
   # 增加gas限制
   npx hardhat deploy --network <network> --gas-limit 8000000
   ```

2. **Nonce错误**
   ```bash
   # 重置账户nonce
   npx hardhat run scripts/reset-nonce.js --network <network>
   ```

3. **合约验证失败**
   ```bash
   # 手动验证
   npx hardhat verify --network <network> <address> <constructor-args>
   ```

### 日志查看

部署过程中的详细日志会保存在：
- `deployments/<network>/` - 合约部署信息
- `deployments/<network>.json` - 部署结果总览

## 扩展功能

### 添加新模板

1. 创建新模板合约
2. 部署模板合约
3. 添加到对应工厂
4. 更新文档

### 自定义部署流程

可以创建自定义的部署脚本：

```typescript
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // 自定义部署逻辑
};

export default func;
func.tags = ["custom"];
func.dependencies = ["v2-creation"];
```

这样就能构建完全定制化的项目部署流程！ 
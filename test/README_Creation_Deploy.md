# Creation合约部署测试文档

## 概述

这个测试套件提供了完整的V2架构Creation合约部署验证，专门为后端调用测试而设计。

## 测试文件结构

```
test/
├── Creation.deploy.test.js          # 主要的Creation部署测试
├── AccumulatedYield.simple.test.js  # AccumulatedYield功能测试
└── README_Creation_Deploy.md        # 本文档
```

## V2架构组件

### 核心合约
- **Creation.sol** - 一键部署器，协调所有模块的部署
- **VaultFactory.sol** - Vault模块工厂
- **TokenFactory.sol** - Token模块工厂  
- **AccumulatedYieldFactory.sol** - 收益分配模块工厂
- **FundFactory.sol** - 融资模块工厂（可选）

### 模板合约
- **MockBasicVault.sol** - Vault模板实现
- **MockStandardToken.sol** - Token模板实现
- **AccumulatedYield.sol** - 收益分配模板实现
- **MockCrowdsale.sol** - 融资模板实现（测试版本）

## 部署流程

### 步骤1: 部署模板合约
```javascript
// 部署所有模板
const vaultTemplate = await MockBasicVault.deploy();
const tokenTemplate = await MockStandardToken.deploy();
const yieldTemplate = await AccumulatedYield.deploy();
```

### 步骤2: 部署工厂合约
```javascript
// 部署所有工厂
const vaultFactory = await VaultFactory.deploy();
const tokenFactory = await TokenFactory.deploy();
const yieldFactory = await AccumulatedYieldFactory.deploy();
```

### 步骤3: 注册模板到工厂
```javascript
// 注册模板（templateId = 0）
await vaultFactory.addTemplate(0, vaultTemplate.address);
await tokenFactory.addTemplate(0, tokenTemplate.address);
await yieldFactory.addTemplate(0, yieldTemplate.address);
```

### 步骤4: 部署Creation合约
```javascript
// 部署Creation并设置工厂地址
const creation = await Creation.deploy();
await creation.setFactories(
    vaultFactory.address,
    tokenFactory.address,
    ethers.ZeroAddress, // fundFactory (可选)
    yieldFactory.address
);
```

### 步骤5: 一键部署项目
```javascript
// 准备初始化数据
const vaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(...);
const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(...);
const yieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(...);

// 执行一键部署
const result = await creation.deployAll(
    0, vaultInitData,  // vault templateId和初始化数据
    0, tokenInitData,  // token templateId和初始化数据
    0, fundInitData,   // fund templateId和初始化数据
    0, yieldInitData   // yield templateId和初始化数据
);
```

## 后端API接口

### 1. 查询接口

#### 获取工厂地址
```javascript
const factories = await creation.getFactories();
// 返回: [vaultFactory, tokenFactory, fundFactory, yieldFactory]
```

#### 获取模板数量
```javascript
const vaultTemplateCount = await vaultFactory.getTemplateCount();
const tokenTemplateCount = await tokenFactory.getTemplateCount();
const yieldTemplateCount = await yieldFactory.getTemplateCount();
```

#### 获取模板地址
```javascript
const vaultTemplate = await vaultFactory.getTemplate(templateId);
const tokenTemplate = await tokenFactory.getTemplate(templateId);
const yieldTemplate = await yieldFactory.getTemplate(templateId);
```

### 2. 管理接口

#### 添加新模板（仅owner）
```javascript
await vaultFactory.addTemplate(templateId, templateAddress);
await tokenFactory.addTemplate(templateId, templateAddress);
await yieldFactory.addTemplate(templateId, templateAddress);
```

#### 设置工厂地址（仅owner）
```javascript
await creation.setFactories(
    vaultFactoryAddress,
    tokenFactoryAddress,
    fundFactoryAddress,
    yieldFactoryAddress
);
```

### 3. 部署接口

#### 单独部署模块
```javascript
// 部署Vault
const vaultAddress = await vaultFactory.createVault(templateId, initData);

// 部署Token
const tokenAddress = await tokenFactory.createToken(templateId, vaultAddress, initData);

// 部署AccumulatedYield
const yieldAddress = await yieldFactory.createAccumulatedYield(templateId, vaultAddress, tokenAddress, initData);
```

#### 一键部署完整项目
```javascript
const deployResult = await creation.deployAll(
    vaultTemplateId, vaultInitData,
    tokenTemplateId, tokenInitData,
    fundTemplateId, fundInitData,
    yieldTemplateId, yieldInitData
);

// 解析事件获取部署的合约地址
const events = deployResult.logs;
```

## 初始化数据格式

### Vault初始化
```javascript
// 函数签名: initVault(address manager, address validator, bool whitelistEnabled)
const vaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "bool"],
    [managerAddress, validatorAddress, false]
);

// 完整calldata
const vaultCalldata = ethers.concat([
    "0x8129fc1c", // initVault函数选择器
    vaultInitData
]);
```

### Token初始化
```javascript
// 函数签名: initToken(address vault, string name, string symbol, uint8 decimals)
const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "string", "string", "uint8"],
    [vaultAddress, "Token Name", "SYMBOL", 18]
);

const tokenCalldata = ethers.concat([
    "0x4cd88b76", // initToken函数选择器
    tokenInitData
]);
```

### AccumulatedYield初始化
```javascript
// 函数签名: initGlobalPool(address vault, address manager, address dividendTreasury, address shareToken, address rewardToken)
const yieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "address", "address"],
    [vaultAddress, managerAddress, dividendTreasuryAddress, shareTokenAddress, rewardTokenAddress]
);

const yieldCalldata = ethers.concat([
    "0x696a437e", // initGlobalPool函数选择器
    yieldInitData
]);
```

## 函数选择器参考

```javascript
// 获取正确的函数选择器
const initVaultSelector = ethers.id("initVault(address,address,bool)").substring(0, 10);
const initTokenSelector = ethers.id("initToken(address,string,string,uint8)").substring(0, 10);
const initGlobalPoolSelector = ethers.id("initGlobalPool(address,address,address,address,address)").substring(0, 10);

console.log("initVault:", initVaultSelector);     // 0x8129fc1c
console.log("initToken:", initTokenSelector);     // 0x4cd88b76  
console.log("initGlobalPool:", initGlobalPoolSelector); // 0x696a437e
```

## 运行测试

### 环境要求
```bash
npm install @openzeppelin/contracts
npm install @nomicfoundation/hardhat-ethers
npm install ethers@^6.0.0
npm install chai
```

### 执行测试
```bash
# 运行Creation部署测试
npx hardhat test test/Creation.deploy.test.js

# 运行所有V2测试
npx hardhat test test/Creation.deploy.test.js test/AccumulatedYield.simple.test.js
```

### 期望输出
```
=== 开始部署V2架构 ===

步骤1: 部署模板合约
✓ VaultTemplate部署: 0x1234...
✓ TokenTemplate部署: 0x5678...
✓ AccumulatedYieldTemplate部署: 0x9abc...

步骤2: 部署工厂合约
✓ VaultFactory部署: 0xdef0...
✓ TokenFactory部署: 0x1234...
✓ AccumulatedYieldFactory部署: 0x5678...

步骤3: 注册模板到工厂
✓ BasicVault模板注册为ID 0
✓ StandardToken模板注册为ID 0
✓ AccumulatedYield模板注册为ID 0

步骤4: 部署Creation合约
✓ Creation部署: 0x9abc...
✓ 工厂地址设置完成

=== V2架构部署完成 ===
```

## 事件监听

### 重要事件
```javascript
// VaultFactory事件
event VaultCreated(uint256 indexed templateId, address indexed vault, address indexed creator);

// TokenFactory事件  
event TokenCreated(uint256 indexed templateId, address indexed token, address indexed creator);

// AccumulatedYieldFactory事件
event AccumulatedYieldCreated(uint256 indexed templateId, address indexed accumulatedYield, address indexed creator);

// Creation事件
event FullDeployment(address indexed deployer, address vault, address token, address fund, address accumulatedYield);
```

### 监听示例
```javascript
// 监听创建事件
creation.on("FullDeployment", (deployer, vault, token, fund, accumulatedYield) => {
    console.log("新项目部署:", {
        deployer,
        vault,
        token,
        fund,
        accumulatedYield
    });
});
```

## 错误处理

### 常见错误
1. **"template not found"** - 模板ID不存在
2. **"initialization failed"** - 初始化数据格式错误
3. **"OwnableUnauthorizedAccount"** - 权限不足
4. **"template already exists"** - 模板ID重复

### 调试建议
1. 验证函数选择器正确性
2. 检查初始化参数类型和顺序
3. 确认调用者权限
4. 验证模板合约部署状态

## 生产环境注意事项

1. **权限管理**: 确保只有授权地址能添加模板和设置工厂
2. **Gas优化**: 考虑批量操作减少交易费用
3. **升级策略**: 预留模板升级机制
4. **监控告警**: 设置关键事件监听
5. **备份恢复**: 保存关键配置和地址信息

## 扩展功能

未来可以添加的功能：
- 多版本模板支持
- 模板权限控制
- 批量部署接口
- 部署状态查询
- Gas费用优化
- 跨链部署支持 
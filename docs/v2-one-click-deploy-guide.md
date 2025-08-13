# V2架构一键部署指南

## 🚀 快速开始

### **一键部署命令**

```bash
# 完整一键部署（推荐）
npm run deploy:v2-all

# 或者使用yarn
yarn deploy:v2-all

# 或者直接使用hardhat
npx hardhat deploy --tags v2-templates,v2-factories,v2-creation --reset
```

## 📋 分步部署命令

### **1. 查看部署概览**
```bash
npm run deploy:v2-overview
```
显示V2架构的完整部署计划和环境信息。

### **2. 部署模板合约**
```bash
npm run deploy:v2-templates
```
部署所有模板合约：
- ✅ BasicVault (Vault模板)
- ✅ StandardToken (Token模板)  
- ✅ MockUSDT (测试资产代币)
- ✅ Crowdsale (Fund模板)
- ✅ AccumulatedYield (Yield模板)

### **3. 部署工厂合约**
```bash
npm run deploy:v2-factories
```
部署工厂合约并添加模板：
- ✅ VaultFactory → BasicVault (ID: 0)
- ✅ TokenFactory → StandardToken (ID: 0)
- ✅ FundFactory → Crowdsale (ID: 0)
- ✅ YieldFactory → AccumulatedYield (ID: 0)

### **4. 部署Creation合约**
```bash
npm run deploy:v2-creation
```
部署Creation一键部署器并配置工厂地址。

## 🎯 部署结果

### **已部署的合约地址**

一键部署成功后，您将看到类似以下的合约地址：

```
=== V2 模板合约部署完成 ===
BasicVault: 0x5FbDB2315678afecb367f032d93F642f64180aa3
StandardToken: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
MockUSDT: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Crowdsale: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
AccumulatedYield: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9

=== V2 工厂合约部署完成 ===
VaultFactory: 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
TokenFactory: 0x0165878A594ca255338adfa4d48449f69242Eb8F
FundFactory: 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
YieldFactory: 0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6

=== V2 Creation 部署完成 ===
Creation: 0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82
```

### **验证部署**

部署脚本会自动验证：
- ✅ 模板已正确添加到工厂 (每个工厂模板数量: 1)
- ✅ Creation合约已配置工厂地址
- ✅ 所有合约编译和部署成功

## 🛠️ 本地开发流程

### **1. 启动本地网络**
```bash
# 选项1：使用内置Hardhat网络（推荐）
npm run deploy:v2-all

# 选项2：启动持久本地节点
npx hardhat node
# 在新终端执行部署
npm run deploy:local
```

### **2. 测试部署结果**
```bash
# 运行Creation部署测试
npx hardhat test test/Creation.deploy.test.js

# 运行AccumulatedYield功能测试  
npx hardhat test test/AccumulatedYield.simple.test.js

# 运行所有测试
npm test
```

### **3. 与合约交互**
```bash
# 打开Hardhat控制台
npx hardhat console

# 在控制台中交互
const creation = await ethers.getContractAt("Creation", "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82");
const factories = await creation.getFactories();
console.log("工厂地址:", factories);
```

## 🌐 网络部署

### **部署到测试网**
```bash
# BSC测试网
npx hardhat deploy --tags v2-templates,v2-factories,v2-creation --network bscTestnet

# Base Sepolia测试网  
npx hardhat deploy --tags v2-templates,v2-factories,v2-creation --network baseSepolia
```

### **部署到主网**
```bash
# BSC主网
npx hardhat deploy --tags v2-templates,v2-factories,v2-creation --network bscMainnet

# Base主网
npx hardhat deploy --tags v2-templates,v2-factories,v2-creation --network baseMainnet
```

## ⚙️ 配置说明

### **环境变量**
```bash
# .env文件配置
PRIVATE_KEY=your_private_key_here
MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key
```

### **网络配置**
Hardhat配置支持以下网络：
- `hardhat` - 本地测试网络（默认）
- `localhost` - 本地节点
- `bscTestnet` - BSC测试网
- `bscMainnet` - BSC主网
- `baseSepolia` - Base测试网
- `baseMainnet` - Base主网

## 🔍 故障排除

### **常见问题**

**Q: 部署失败："contract name conflicts"**
```bash
# 清理缓存重新编译
npx hardhat clean
npx hardhat compile
npm run deploy:v2-all
```

**Q: Gas费用过高**
```bash
# 调整gas价格（在hardhat.config.ts中）
gasPrice: 20000000000, // 20 gwei
```

**Q: 网络连接超时**
```bash
# 检查网络配置和RPC URL
npx hardhat config
```

**Q: 私钥错误**
```bash
# 确保.env文件中的PRIVATE_KEY正确
echo $PRIVATE_KEY
```

### **调试技巧**

1. **查看详细日志**
```bash
npx hardhat deploy --tags v2-templates --verbose
```

2. **验证合约状态**
```bash
npx hardhat console
const vault = await ethers.getContractAt("BasicVault", "vault_address");
console.log("Manager:", await vault.manager());
```

3. **检查gas使用**
```bash
REPORT_GAS=true npm test
```

## 📚 相关文档

- [V2架构说明](./v2-architecture.md)
- [Creation部署测试](../test/README_Creation_Deploy.md)
- [AccumulatedYield测试](../test/README_AccumulatedYield.md)
- [Hardhat本地EVM指南](./hardhat-local-env-guide.md)

## 🚀 下一步

部署完成后，您可以：

1. **使用Creation合约** - 一键部署项目实例
2. **测试模块功能** - 验证Vault、Token、Fund、Yield功能
3. **集成前端** - 连接Web3前端应用
4. **部署到主网** - 生产环境部署

恭喜！您已成功完成V2架构的一键部署！🎉 
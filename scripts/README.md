# Scripts 目录说明

本目录包含了用于部署和测试 Accelerate Protocol V2 的脚本文件。

## 脚本文件

### 1. deploy-example-project.js
部署示例项目的脚本，对应 `deploy/v2/04_Deploy_Example_Project.ts` 的逻辑。

**功能：**
- 部署一个完整的示例项目
- 包含 Vault、Token、Fund 和 AccumulatedYield 组件
- 支持环境变量配置

**使用方法：**
```bash
# 使用默认配置部署
npx hardhat run scripts/deploy-example-project.js --network <network-name>

# 使用环境变量配置
PROJECT_NAME="MyProject" USDT_ADDRESS="0x..." DRDS_ADDRESS="0x..." npx hardhat run scripts/deploy-example-project.js --network <network-name>
```

**环境变量：**
- `PROJECT_NAME`: 项目名称（可选，本地网络使用固定名称，测试网支持配置）
- `USDT_ADDRESS`: USDT合约地址（可选，本地网络使用MockUSDT）
- `DRDS_ADDRESS`: DRDS地址（可选，本地网络使用deployer地址）
- `MAINNET_USDT_ADDRESS`: 主网USDT地址（主网部署时必需）

### 2. start-invest.js
启动投资流程的脚本，对应 `deploy/v2/05_Start_Invest.ts` 的逻辑。

**功能：**
- 为测试账户铸造USDT
- 检查众筹状态
- 模拟投资流程
- 解锁代币（如果达到软顶）

**使用方法：**
```bash
# 启动投资流程
npx hardhat run scripts/start-invest.js --network <network-name>
```

**注意事项：**
- 需要先运行 `deploy-example-project.js` 部署项目
- 本地网络使用固定项目名称，测试网支持环境变量配置
- 会自动为deployer账户铸造100,000 USDT用于测试

### 3. deploy-v2.js
一键部署V2版本所有合约的脚本。

**使用方法：**
```bash
npx hardhat run scripts/deploy-v2.js --network <network-name>
```

### 4. redeploy-project.js
重新部署项目的脚本。

**使用方法：**
```bash
npx hardhat run scripts/redeploy-project.js --network <network-name>
```

### 5. run-complete-flow.js
一键执行完整部署和投资流程的脚本。

**使用方法：**
```bash
# 使用默认网络 (localhost)
node scripts/run-complete-flow.js

# 指定网络
node scripts/run-complete-flow.js baseSepolia
```

**功能：**
- 自动按顺序执行所有步骤
- 包含适当的等待时间
- 错误处理和状态反馈

## 部署流程

### 完整部署流程

#### 方法一：一键执行（推荐）
```bash
node scripts/run-complete-flow.js <network-name>
```

#### 方法二：分步执行
1. **部署基础合约：**
   ```bash
   npx hardhat run scripts/deploy-v2.js --network <network-name>
   ```

2. **部署示例项目：**
   ```bash
   npx hardhat run scripts/deploy-example-project.js --network <network-name>
   ```

3. **启动投资流程：**
   ```bash
   npx hardhat run scripts/start-invest.js --network <network-name>
   ```

### 环境配置

在 `.env` 文件中配置以下变量：

```env
# 主网USDT地址（主网部署时必需）
MAINNET_USDT_ADDRESS=0x...

# 项目配置（可选）
PROJECT_NAME=MyProject
USDT_ADDRESS=0x...
DRDS_ADDRESS=0x...

# 网络配置
PRIVATE_KEY=your_private_key
RPC_URL=your_rpc_url
```

## 网络支持

脚本支持以下网络：
- `localhost`: 本地开发网络
- `baseSepolia`: Base Sepolia 测试网
- `bscTestnet`: BSC 测试网
- `bsc`: BSC 主网
- `mainnet`: Ethereum 主网

## 故障排除

### 常见问题

1. **Nonce 错误：**
   - 脚本已包含自动重试机制
   - 如果仍有问题，可以等待几分钟后重试

2. **项目不存在：**
   - 确保先运行 `deploy-example-project.js`
   - 检查项目名称是否正确

3. **众筹未开始：**
   - 检查项目部署时间
   - 重新部署项目，确保开始时间比当前时间早

### 调试信息

脚本会输出详细的调试信息，包括：
- 合约地址
- 交易哈希
- 投资状态
- 错误信息

## 注意事项

1. 确保有足够的ETH支付gas费用
2. 测试网部署时使用MockUSDT，主网部署时需要真实USDT地址
3. 投资流程需要manager签名，确保使用正确的账户
4. 脚本包含适当的延迟以避免nonce冲突

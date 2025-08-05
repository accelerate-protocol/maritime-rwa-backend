#!/bin/bash

# ==============================================
# V2架构合约ABI提取脚本
# 按照部署流程顺序：1.模板合约(Mock) 2.工厂合约 3.Creation合约
# ==============================================

echo "🚀 开始提取V2架构合约ABI..."

# 创建abis目录
mkdir -p abis
mkdir -p abis/templates
mkdir -p abis/factories
mkdir -p abis/creation
mkdir -p abis/mocks

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📁 创建目录结构...${NC}"

# ==============================================
# 1. 提取模板合约ABI (Mock版本)
# ==============================================

echo -e "${YELLOW}📄 1. 提取模板合约ABI (Mock版本)...${NC}"

# 1.1 MockBasicVault (Vault模板)
if [ -f "artifacts/contracts/mocks/MockBasicVault.sol/MockBasicVault.json" ]; then
    jq '.abi' artifacts/contracts/mocks/MockBasicVault.sol/MockBasicVault.json > abis/templates/Vault.json
    echo -e "${GREEN}✅ Vault.json (MockBasicVault)${NC}"
else
    echo "❌ MockBasicVault artifact not found"
fi

# 1.2 MockERC20 (Token模板)
if [ -f "artifacts/contracts/mocks/MockERC20.sol/MockERC20.json" ]; then
    jq '.abi' artifacts/contracts/mocks/MockERC20.sol/MockERC20.json > abis/templates/Token.json
    echo -e "${GREEN}✅ Token.json (MockERC20)${NC}"
else
    echo "❌ MockERC20 artifact not found"
fi

# 1.3 MockCrowdsale (Fund模板)
if [ -f "artifacts/contracts/mocks/MockCrowdsale.sol/MockCrowdsale.json" ]; then
    jq '.abi' artifacts/contracts/mocks/MockCrowdsale.sol/MockCrowdsale.json > abis/templates/Crowdsale.json
    echo -e "${GREEN}✅ Crowdsale.json (MockCrowdsale)${NC}"
else
    echo "❌ MockCrowdsale artifact not found"
fi

# 1.4 MockAccumulatedYield (Yield模板)
if [ -f "artifacts/contracts/mocks/MockAccumulatedYield.sol/MockAccumulatedYield.json" ]; then
    jq '.abi' artifacts/contracts/mocks/MockAccumulatedYield.sol/MockAccumulatedYield.json > abis/templates/AccumulatedYield.json
    echo -e "${GREEN}✅ AccumulatedYield.json (MockAccumulatedYield)${NC}"
else
    echo "❌ MockAccumulatedYield artifact not found"
fi

# ==============================================
# 2. 提取工厂合约ABI
# ==============================================

echo -e "${YELLOW}🏭 2. 提取工厂合约ABI...${NC}"

# 2.1 VaultFactory合约
if [ -f "artifacts/contracts/v2/factories/VaultFactory.sol/VaultFactory.json" ]; then
    jq '.abi' artifacts/contracts/v2/factories/VaultFactory.sol/VaultFactory.json > abis/factories/VaultFactory.json
    echo -e "${GREEN}✅ VaultFactory.json${NC}"
else
    echo "❌ VaultFactory artifact not found"
fi

# 2.2 TokenFactory合约
if [ -f "artifacts/contracts/v2/factories/TokenFactory.sol/TokenFactory.json" ]; then
    jq '.abi' artifacts/contracts/v2/factories/TokenFactory.sol/TokenFactory.json > abis/factories/TokenFactory.json
    echo -e "${GREEN}✅ TokenFactory.json${NC}"
else
    echo "❌ TokenFactory artifact not found"
fi

# 2.3 FundFactory合约
if [ -f "artifacts/contracts/v2/factories/FundFactory.sol/FundFactory.json" ]; then
    jq '.abi' artifacts/contracts/v2/factories/FundFactory.sol/FundFactory.json > abis/factories/FundFactory.json
    echo -e "${GREEN}✅ FundFactory.json${NC}"
else
    echo "❌ FundFactory artifact not found"
fi

# 2.4 AccumulatedYieldFactory合约
if [ -f "artifacts/contracts/v2/factories/AccumulatedYieldFactory.sol/AccumulatedYieldFactory.json" ]; then
    jq '.abi' artifacts/contracts/v2/factories/AccumulatedYieldFactory.sol/AccumulatedYieldFactory.json > abis/factories/AccumulatedYieldFactory.json
    echo -e "${GREEN}✅ AccumulatedYieldFactory.json${NC}"
else
    echo "❌ AccumulatedYieldFactory artifact not found"
fi

# ==============================================
# 3. 提取Creation合约ABI
# ==============================================

echo -e "${YELLOW}🚀 3. 提取Creation合约ABI...${NC}"

# 3.1 Creation合约
if [ -f "artifacts/contracts/v2/creation/Creation.sol/Creation.json" ]; then
    jq '.abi' artifacts/contracts/v2/creation/Creation.sol/Creation.json > abis/creation/Creation.json
    echo -e "${GREEN}✅ Creation.json${NC}"
else
    echo "❌ Creation artifact not found"
fi

# ==============================================
# 4. 提取Mock合约ABI (用于测试)
# ==============================================

echo -e "${YELLOW}🧪 4. 提取Mock合约ABI (用于测试)...${NC}"

# 4.1 MockUSDT合约
if [ -f "artifacts/contracts/v1/MockUSDT.sol/MockUSDT.json" ]; then
    jq '.abi' artifacts/contracts/v1/MockUSDT.sol/MockUSDT.json > abis/mocks/MockUSDT.json
    echo -e "${GREEN}✅ MockUSDT.json${NC}"
else
    echo "❌ MockUSDT artifact not found"
fi

# 4.2 其他Mock合约
if [ -f "artifacts/contracts/mocks/MockERC20.sol/MockERC20.json" ]; then
    jq '.abi' artifacts/contracts/mocks/MockERC20.sol/MockERC20.json > abis/mocks/MockERC20.json
    echo -e "${GREEN}✅ MockERC20.json (mocks)${NC}"
fi

if [ -f "artifacts/contracts/mocks/MockBasicVault.sol/MockBasicVault.json" ]; then
    jq '.abi' artifacts/contracts/mocks/MockBasicVault.sol/MockBasicVault.json > abis/mocks/MockBasicVault.json
    echo -e "${GREEN}✅ MockBasicVault.json (mocks)${NC}"
fi

if [ -f "artifacts/contracts/mocks/MockCrowdsale.sol/MockCrowdsale.json" ]; then
    jq '.abi' artifacts/contracts/mocks/MockCrowdsale.sol/MockCrowdsale.json > abis/mocks/MockCrowdsale.json
    echo -e "${GREEN}✅ MockCrowdsale.json (mocks)${NC}"
fi

if [ -f "artifacts/contracts/mocks/MockAccumulatedYield.sol/MockAccumulatedYield.json" ]; then
    jq '.abi' artifacts/contracts/mocks/MockAccumulatedYield.sol/MockAccumulatedYield.json > abis/mocks/MockAccumulatedYield.json
    echo -e "${GREEN}✅ MockAccumulatedYield.json (mocks)${NC}"
fi

# ==============================================
# 创建ABI索引文件
# ==============================================

echo -e "${YELLOW}📋 创建ABI索引文件...${NC}"

cat > abis/index.json << EOF
{
  "description": "V2架构合约ABI索引",
  "version": "2.0.0",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployment_flow": [
    "1. 模板合约 (Mock版本)",
    "2. 工厂合约", 
    "3. Creation合约",
    "4. Mock合约 (测试用)"
  ],
  "contracts": {
    "templates": {
      "Vault": "templates/Vault.json",
      "Token": "templates/Token.json", 
      "Crowdsale": "templates/Crowdsale.json",
      "AccumulatedYield": "templates/AccumulatedYield.json"
    },
    "factories": {
      "VaultFactory": "factories/VaultFactory.json",
      "TokenFactory": "factories/TokenFactory.json",
      "FundFactory": "factories/FundFactory.json", 
      "AccumulatedYieldFactory": "factories/AccumulatedYieldFactory.json"
    },
    "creation": {
      "Creation": "creation/Creation.json"
    },
    "mocks": {
      "MockUSDT": "mocks/MockUSDT.json",
      "MockERC20": "mocks/MockERC20.json",
      "MockBasicVault": "mocks/MockBasicVault.json",
      "MockCrowdsale": "mocks/MockCrowdsale.json",
      "MockAccumulatedYield": "mocks/MockAccumulatedYield.json"
    }
  },
  "deployment_addresses": {
    "hardhat_local": {
      "MockBasicVault": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      "MockERC20": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      "MockCrowdsale": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      "MockAccumulatedYield": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
      "MockUSDT": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
      "VaultFactory": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
      "TokenFactory": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
      "FundFactory": "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
      "AccumulatedYieldFactory": "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
      "Creation": "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82"
    },
    "example_project": {
      "Vault": "0x61c36a8d610163660E21a8b7359e1Cac0C9133e1",
      "Token": "0x3B02fF1e626Ed7a8fd6eC5299e2C54e1421B626B",
      "Fund": "0x9bd03768a7DCc129555dE410FF8E85528A4F88b5",
      "AccumulatedYield": "0x94099942864EA81cCF197E9D71ac53310b1468D8"
    }
  }
}
EOF

echo -e "${GREEN}✅ index.json${NC}"

# ==============================================
# 创建README文件
# ==============================================

echo -e "${YELLOW}📖 创建ABI使用说明...${NC}"

cat > abis/README.md << 'EOF'
# V2架构合约ABI文件

本目录包含所有V2架构部署合约的ABI文件，按照部署流程顺序组织。

## 📋 部署流程

```
1. 📄 模板合约 (Mock版本)
   ├── Vault.json (MockBasicVault)
   ├── Token.json (MockERC20)
   ├── Crowdsale.json (MockCrowdsale)
   └── AccumulatedYield.json (MockAccumulatedYield)

2. 🏭 工厂合约
   ├── VaultFactory.json
   ├── TokenFactory.json
   ├── FundFactory.json
   └── AccumulatedYieldFactory.json

3. 🚀 Creation合约
   └── Creation.json

4. 🧪 Mock合约 (测试用)
   ├── MockUSDT.json
   ├── MockERC20.json
   ├── MockBasicVault.json
   ├── MockCrowdsale.json
   └── MockAccumulatedYield.json
```

## 📁 目录结构

```
abis/
├── templates/          # 模板合约ABI (Mock版本)
│   ├── Vault.json
│   ├── Token.json
│   ├── Crowdsale.json
│   └── AccumulatedYield.json
├── factories/          # 工厂合约ABI
│   ├── VaultFactory.json
│   ├── TokenFactory.json
│   ├── FundFactory.json
│   └── AccumulatedYieldFactory.json
├── creation/           # Creation合约ABI
│   └── Creation.json
├── mocks/              # Mock合约ABI (测试用)
│   ├── MockUSDT.json
│   ├── MockERC20.json
│   ├── MockBasicVault.json
│   ├── MockCrowdsale.json
│   └── MockAccumulatedYield.json
├── index.json          # ABI索引文件
└── README.md           # 使用说明
```

## 🚀 使用方法

### JavaScript/TypeScript

```javascript
// 使用ethers.js v6
import { ethers } from 'ethers';
import VaultABI from './abis/templates/Vault.json';

const provider = new ethers.JsonRpcProvider('http://localhost:8545');
const vaultContract = new ethers.Contract(
  '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  VaultABI,
  provider
);

// 调用合约方法
const manager = await vaultContract.manager();
console.log('Manager:', manager);
```

### Web3.js

```javascript
import Web3 from 'web3';
import VaultABI from './abis/templates/Vault.json';

const web3 = new Web3('http://localhost:8545');
const vaultContract = new web3.eth.Contract(
  VaultABI,
  '0x5FbDB2315678afecb367f032d93F642f64180aa3'
);

// 调用合约方法
const manager = await vaultContract.methods.manager().call();
console.log('Manager:', manager);
```

### Python (web3.py)

```python
from web3 import Web3
import json

# 连接到本地节点
w3 = Web3(Web3.HTTPProvider('http://localhost:8545'))

# 加载ABI
with open('abis/templates/Vault.json', 'r') as f:
    vault_abi = json.load(f)

# 创建合约实例
vault_contract = w3.eth.contract(
    address='0x5FbDB2315678afecb367f032d93F642f64180aa3',
    abi=vault_abi
)

# 调用合约方法
manager = vault_contract.functions.manager().call()
print(f'Manager: {manager}')
```

## 📋 合约地址

### Hardhat本地网络 (模板合约)

- **MockBasicVault**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **MockERC20**: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- **MockCrowdsale**: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`
- **MockAccumulatedYield**: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
- **MockUSDT**: `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9`

### 工厂合约

- **VaultFactory**: `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707`
- **TokenFactory**: `0x0165878A594ca255338adfa4d48449f69242Eb8F`
- **FundFactory**: `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853`
- **AccumulatedYieldFactory**: `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6`

### Creation合约

- **Creation**: `0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82`

### 示例项目 (通过Creation部署)

- **Vault**: `0x61c36a8d610163660E21a8b7359e1Cac0C9133e1`
- **Token**: `0x3B02fF1e626Ed7a8fd6eC5299e2C54e1421B626B`
- **Fund**: `0x9bd03768a7DCc129555dE410FF8E85528A4F88b5`
- **AccumulatedYield**: `0x94099942864EA81cCF197E9D71ac53310b1468D8`

## 🔄 更新ABI

要重新提取所有ABI文件，运行：

```bash
bash scripts/extract-abis.sh
```

## 📝 注意事项

1. **模板合约**: 使用Mock版本作为模板，简化开发和测试
2. **工厂合约**: 负责部署和管理模板合约的克隆实例
3. **Creation合约**: 统一的项目部署入口，自动处理合约间依赖关系
4. **Mock合约**: 用于测试和开发，不包含复杂业务逻辑
5. 所有ABI文件均为JSON格式，可直接导入使用

## 🛠️ 开发建议

- 在前端项目中，建议将这些ABI文件复制到前端项目的`src/abis/`目录下
- 使用TypeScript时，可以生成类型定义文件以获得更好的开发体验
- 建议为不同的网络环境维护不同的合约地址配置文件
- 模板合约使用Mock版本，便于快速开发和测试
EOF

echo -e "${GREEN}✅ README.md${NC}"

# ==============================================
# 统计结果
# ==============================================

echo ""
echo -e "${BLUE}📊 提取完成统计：${NC}"
echo "模板合约ABI: $(ls abis/templates/*.json 2>/dev/null | wc -l | tr -d ' ') 个"
echo "工厂合约ABI: $(ls abis/factories/*.json 2>/dev/null | wc -l | tr -d ' ') 个"
echo "Creation合约ABI: $(ls abis/creation/*.json 2>/dev/null | wc -l | tr -d ' ') 个"
echo "Mock合约ABI: $(ls abis/mocks/*.json 2>/dev/null | wc -l | tr -d ' ') 个"
echo "总计: $(find abis -name "*.json" -not -name "index.json" 2>/dev/null | wc -l | tr -d ' ') 个ABI文件"

echo ""
echo -e "${GREEN}🎉 所有ABI文件提取完成！${NC}"
echo -e "${BLUE}📁 ABI文件位置: ./abis/${NC}"
echo -e "${BLUE}📋 索引文件: ./abis/index.json${NC}"
echo -e "${BLUE}📖 使用说明: ./abis/README.md${NC}"
echo ""
echo -e "${YELLOW}📋 部署流程顺序：${NC}"
echo "1. 📄 模板合约 (Mock版本)"
echo "2. 🏭 工厂合约"
echo "3. 🚀 Creation合约"
echo "4. 🧪 Mock合约 (测试用)" 
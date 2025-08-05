#!/bin/bash

# ==============================================
# V2架构合约ABI和Bytecode提取脚本
# 按照部署流程顺序：1.模板合约(Mock版本) 2.工厂合约 3.Creation合约
# 只导出实际部署中用到的合约
# ==============================================

echo "🚀 开始提取V2架构合约ABI和Bytecode..."

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
# 1. 提取模板合约ABI和Bytecode (Mock版本)
# ==============================================

echo -e "${YELLOW}📄 1. 提取模板合约ABI和Bytecode (Mock版本)...${NC}"

# 1.1 MockBasicVault -> MockBasicVault
if [ -f "artifacts/contracts/mocks/MockBasicVault.sol/MockBasicVault.json" ]; then
    # 提取ABI
    jq '.abi' artifacts/contracts/mocks/MockBasicVault.sol/MockBasicVault.json > abis/templates/MockBasicVault.json
    # 提取Bytecode
    jq '.bytecode' artifacts/contracts/mocks/MockBasicVault.sol/MockBasicVault.json > abis/templates/MockBasicVault.bytecode
    echo -e "${GREEN}✅ MockBasicVault.json + MockBasicVault.bytecode${NC}"
else
    echo "❌ MockBasicVault artifact not found"
fi

# 1.2 MockERC20 -> MockERC20
if [ -f "artifacts/contracts/mocks/MockERC20.sol/MockERC20.json" ]; then
    # 提取ABI
    jq '.abi' artifacts/contracts/mocks/MockERC20.sol/MockERC20.json > abis/templates/MockERC20.json
    # 提取Bytecode
    jq '.bytecode' artifacts/contracts/mocks/MockERC20.sol/MockERC20.json > abis/templates/MockERC20.bytecode
    echo -e "${GREEN}✅ MockERC20.json + MockERC20.bytecode${NC}"
else
    echo "❌ MockERC20 artifact not found"
fi

# 1.3 MockCrowdsale -> MockCrowdsale
if [ -f "artifacts/contracts/mocks/MockCrowdsale.sol/MockCrowdsale.json" ]; then
    # 提取ABI
    jq '.abi' artifacts/contracts/mocks/MockCrowdsale.sol/MockCrowdsale.json > abis/templates/MockCrowdsale.json
    # 提取Bytecode
    jq '.bytecode' artifacts/contracts/mocks/MockCrowdsale.sol/MockCrowdsale.json > abis/templates/MockCrowdsale.bytecode
    echo -e "${GREEN}✅ MockCrowdsale.json + MockCrowdsale.bytecode${NC}"
else
    echo "❌ MockCrowdsale artifact not found"
fi

# 1.4 MockAccumulatedYield -> MockAccumulatedYield
if [ -f "artifacts/contracts/mocks/MockAccumulatedYield.sol/MockAccumulatedYield.json" ]; then
    # 提取ABI
    jq '.abi' artifacts/contracts/mocks/MockAccumulatedYield.sol/MockAccumulatedYield.json > abis/templates/MockAccumulatedYield.json
    # 提取Bytecode
    jq '.bytecode' artifacts/contracts/mocks/MockAccumulatedYield.sol/MockAccumulatedYield.json > abis/templates/MockAccumulatedYield.bytecode
    echo -e "${GREEN}✅ MockAccumulatedYield.json + MockAccumulatedYield.bytecode${NC}"
else
    echo "❌ MockAccumulatedYield artifact not found"
fi

# ==============================================
# 2. 提取工厂合约ABI和Bytecode
# ==============================================

echo -e "${YELLOW}🏭 2. 提取工厂合约ABI和Bytecode...${NC}"

# 2.1 VaultFactory合约
if [ -f "artifacts/contracts/v2/factories/VaultFactory.sol/VaultFactory.json" ]; then
    # 提取ABI
    jq '.abi' artifacts/contracts/v2/factories/VaultFactory.sol/VaultFactory.json > abis/factories/VaultFactory.json
    # 提取Bytecode
    jq '.bytecode' artifacts/contracts/v2/factories/VaultFactory.sol/VaultFactory.json > abis/factories/VaultFactory.bytecode
    echo -e "${GREEN}✅ VaultFactory.json + VaultFactory.bytecode${NC}"
else
    echo "❌ VaultFactory artifact not found"
fi

# 2.2 TokenFactory合约
if [ -f "artifacts/contracts/v2/factories/TokenFactory.sol/TokenFactory.json" ]; then
    # 提取ABI
    jq '.abi' artifacts/contracts/v2/factories/TokenFactory.sol/TokenFactory.json > abis/factories/TokenFactory.json
    # 提取Bytecode
    jq '.bytecode' artifacts/contracts/v2/factories/TokenFactory.sol/TokenFactory.json > abis/factories/TokenFactory.bytecode
    echo -e "${GREEN}✅ TokenFactory.json + TokenFactory.bytecode${NC}"
else
    echo "❌ TokenFactory artifact not found"
fi

# 2.3 FundFactory合约
if [ -f "artifacts/contracts/v2/factories/FundFactory.sol/FundFactory.json" ]; then
    # 提取ABI
    jq '.abi' artifacts/contracts/v2/factories/FundFactory.sol/FundFactory.json > abis/factories/FundFactory.json
    # 提取Bytecode
    jq '.bytecode' artifacts/contracts/v2/factories/FundFactory.sol/FundFactory.json > abis/factories/FundFactory.bytecode
    echo -e "${GREEN}✅ FundFactory.json + FundFactory.bytecode${NC}"
else
    echo "❌ FundFactory artifact not found"
fi

# 2.4 AccumulatedYieldFactory合约
if [ -f "artifacts/contracts/v2/factories/AccumulatedYieldFactory.sol/AccumulatedYieldFactory.json" ]; then
    # 提取ABI
    jq '.abi' artifacts/contracts/v2/factories/AccumulatedYieldFactory.sol/AccumulatedYieldFactory.json > abis/factories/AccumulatedYieldFactory.json
    # 提取Bytecode
    jq '.bytecode' artifacts/contracts/v2/factories/AccumulatedYieldFactory.sol/AccumulatedYieldFactory.json > abis/factories/AccumulatedYieldFactory.bytecode
    echo -e "${GREEN}✅ AccumulatedYieldFactory.json + AccumulatedYieldFactory.bytecode${NC}"
else
    echo "❌ AccumulatedYieldFactory artifact not found"
fi

# ==============================================
# 3. 提取Creation合约ABI和Bytecode
# ==============================================

echo -e "${YELLOW}🚀 3. 提取Creation合约ABI和Bytecode...${NC}"

# 3.1 Creation合约
if [ -f "artifacts/contracts/v2/creation/Creation.sol/Creation.json" ]; then
    # 提取ABI
    jq '.abi' artifacts/contracts/v2/creation/Creation.sol/Creation.json > abis/creation/Creation.json
    # 提取Bytecode
    jq '.bytecode' artifacts/contracts/v2/creation/Creation.sol/Creation.json > abis/creation/Creation.bytecode
    echo -e "${GREEN}✅ Creation.json + Creation.bytecode${NC}"
else
    echo "❌ Creation artifact not found"
fi

# ==============================================
# 4. 提取Mock合约ABI和Bytecode (只保留MockUSDT)
# ==============================================

echo -e "${YELLOW}🧪 4. 提取Mock合约ABI和Bytecode (只保留MockUSDT)...${NC}"

# 4.1 MockUSDT合约 (独立的测试代币)
if [ -f "artifacts/contracts/v1/MockUSDT.sol/MockUSDT.json" ]; then
    # 提取ABI
    jq '.abi' artifacts/contracts/v1/MockUSDT.sol/MockUSDT.json > abis/mocks/MockUSDT.json
    # 提取Bytecode
    jq '.bytecode' artifacts/contracts/v1/MockUSDT.sol/MockUSDT.json > abis/mocks/MockUSDT.bytecode
    echo -e "${GREEN}✅ MockUSDT.json + MockUSDT.bytecode${NC}"
else
    echo "❌ MockUSDT artifact not found"
fi

# ==============================================
# 创建ABI和Bytecode索引文件
# ==============================================

echo -e "${YELLOW}📋 创建ABI和Bytecode索引文件...${NC}"

cat > abis/index.json << EOF
{
  "description": "V2架构合约ABI和Bytecode索引",
  "version": "2.0.0",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "deployment_flow": [
    "1. 模板合约 (Mock版本)",
    "2. 工厂合约", 
    "3. Creation合约"
  ],
  "contracts": {
    "templates": {
      "MockBasicVault": {
        "abi": "templates/MockBasicVault.json",
        "bytecode": "templates/MockBasicVault.bytecode"
      },
      "MockERC20": {
        "abi": "templates/MockERC20.json",
        "bytecode": "templates/MockERC20.bytecode"
      },
      "MockCrowdsale": {
        "abi": "templates/MockCrowdsale.json",
        "bytecode": "templates/MockCrowdsale.bytecode"
      },
      "MockAccumulatedYield": {
        "abi": "templates/MockAccumulatedYield.json",
        "bytecode": "templates/MockAccumulatedYield.bytecode"
      }
    },
    "factories": {
      "VaultFactory": {
        "abi": "factories/VaultFactory.json",
        "bytecode": "factories/VaultFactory.bytecode"
      },
      "TokenFactory": {
        "abi": "factories/TokenFactory.json",
        "bytecode": "factories/TokenFactory.bytecode"
      },
      "FundFactory": {
        "abi": "factories/FundFactory.json",
        "bytecode": "factories/FundFactory.bytecode"
      },
      "AccumulatedYieldFactory": {
        "abi": "factories/AccumulatedYieldFactory.json",
        "bytecode": "factories/AccumulatedYieldFactory.bytecode"
      }
    },
    "creation": {
      "Creation": {
        "abi": "creation/Creation.json",
        "bytecode": "creation/Creation.bytecode"
      }
    },
    "mocks": {
      "MockUSDT": {
        "abi": "mocks/MockUSDT.json",
        "bytecode": "mocks/MockUSDT.bytecode"
      }
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

echo -e "${YELLOW}📖 创建ABI和Bytecode使用说明...${NC}"

cat > abis/README.md << 'EOF'
# V2架构合约ABI和Bytecode文件

本目录包含所有V2架构部署合约的ABI和Bytecode文件，按照部署流程顺序组织。

## 📋 部署流程

```
1. 📄 模板合约 (Mock版本)
   ├── MockBasicVault.json + MockBasicVault.bytecode
   ├── MockERC20.json + MockERC20.bytecode
   ├── MockCrowdsale.json + MockCrowdsale.bytecode
   └── MockAccumulatedYield.json + MockAccumulatedYield.bytecode

2. 🏭 工厂合约
   ├── VaultFactory.json + VaultFactory.bytecode
   ├── TokenFactory.json + TokenFactory.bytecode
   ├── FundFactory.json + FundFactory.bytecode
   └── AccumulatedYieldFactory.json + AccumulatedYieldFactory.bytecode

3. 🚀 Creation合约
   └── Creation.json + Creation.bytecode
```

## 📁 目录结构

```
abis/
├── templates/          # 模板合约ABI和Bytecode (Mock版本)
│   ├── MockBasicVault.json
│   ├── MockBasicVault.bytecode
│   ├── MockERC20.json
│   ├── MockERC20.bytecode
│   ├── MockCrowdsale.json
│   ├── MockCrowdsale.bytecode
│   ├── MockAccumulatedYield.json
│   └── MockAccumulatedYield.bytecode
├── factories/          # 工厂合约ABI和Bytecode
│   ├── VaultFactory.json
│   ├── VaultFactory.bytecode
│   ├── TokenFactory.json
│   ├── TokenFactory.bytecode
│   ├── FundFactory.json
│   ├── FundFactory.bytecode
│   ├── AccumulatedYieldFactory.json
│   └── AccumulatedYieldFactory.bytecode
├── creation/           # Creation合约ABI和Bytecode
│   ├── Creation.json
│   └── Creation.bytecode
├── mocks/              # Mock合约ABI和Bytecode (测试用)
│   ├── MockUSDT.json
│   └── MockUSDT.bytecode
├── index.json          # ABI和Bytecode索引文件
└── README.md           # 使用说明
```

## 🚀 使用方法

### JavaScript/TypeScript

```javascript
// 使用ethers.js v6
import { ethers } from 'ethers';
import MockBasicVaultABI from './abis/templates/MockBasicVault.json';
import MockBasicVaultBytecode from './abis/templates/MockBasicVault.bytecode';

const provider = new ethers.JsonRpcProvider('http://localhost:8545');

// 创建合约实例
const vaultContract = new ethers.Contract(
  '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  MockBasicVaultABI,
  provider
);

// 调用合约方法
const manager = await vaultContract.manager();
console.log('Manager:', manager);

// 部署新合约
const factory = new ethers.ContractFactory(MockBasicVaultABI, MockBasicVaultBytecode, signer);
const newVault = await factory.deploy();
```

### Web3.js

```javascript
import Web3 from 'web3';
import MockBasicVaultABI from './abis/templates/MockBasicVault.json';
import MockBasicVaultBytecode from './abis/templates/MockBasicVault.bytecode';

const web3 = new Web3('http://localhost:8545');

// 创建合约实例
const vaultContract = new web3.eth.Contract(
  MockBasicVaultABI,
  '0x5FbDB2315678afecb367f032d93F642f64180aa3'
);

// 调用合约方法
const manager = await vaultContract.methods.manager().call();
console.log('Manager:', manager);

// 部署新合约
const newVault = await web3.eth.contract(MockBasicVaultABI).deploy({
  data: MockBasicVaultBytecode,
  arguments: []
}).send({ from: deployer });
```

### Python (web3.py)

```python
from web3 import Web3
import json

# 连接到本地节点
w3 = Web3(Web3.HTTPProvider('http://localhost:8545'))

# 加载ABI和Bytecode
with open('abis/templates/MockBasicVault.json', 'r') as f:
    vault_abi = json.load(f)

with open('abis/templates/MockBasicVault.bytecode', 'r') as f:
    vault_bytecode = f.read().strip('"')

# 创建合约实例
vault_contract = w3.eth.contract(
    address='0x5FbDB2315678afecb367f032d93F642f64180aa3',
    abi=vault_abi
)

# 调用合约方法
manager = vault_contract.functions.manager().call()
print(f'Manager: {manager}')

# 部署新合约
new_vault = w3.eth.contract(abi=vault_abi, bytecode=vault_bytecode)
tx_hash = new_vault.constructor().transact({'from': deployer})
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

## 🔄 更新ABI和Bytecode

要重新提取所有ABI和Bytecode文件，运行：

```bash
bash scripts/extract-abis.sh
```

## 📝 注意事项

1. **模板合约**: 使用Mock版本作为模板，简化开发和测试
2. **工厂合约**: 负责部署和管理模板合约的克隆实例
3. **Creation合约**: 统一的项目部署入口，自动处理合约间依赖关系
4. **Mock合约**: 只保留MockUSDT作为独立的测试代币
5. **Bytecode文件**: 包含合约的编译后字节码，用于合约部署
6. 所有ABI和Bytecode文件均为JSON格式，可直接导入使用

## 🛠️ 开发建议

- 在前端项目中，建议将这些ABI和Bytecode文件复制到前端项目的`src/abis/`目录下
- 使用TypeScript时，可以生成类型定义文件以获得更好的开发体验
- 建议为不同的网络环境维护不同的合约地址配置文件
- 模板合约使用Mock版本，便于快速开发和测试
- Bytecode文件可用于合约验证和重新部署
EOF

echo -e "${GREEN}✅ README.md${NC}"

# ==============================================
# 统计结果
# ==============================================

echo ""
echo -e "${BLUE}📊 提取完成统计：${NC}"
echo "模板合约: $(ls abis/templates/*.json 2>/dev/null | wc -l | tr -d ' ') 个ABI + $(ls abis/templates/*.bytecode 2>/dev/null | wc -l | tr -d ' ') 个Bytecode"
echo "工厂合约: $(ls abis/factories/*.json 2>/dev/null | wc -l | tr -d ' ') 个ABI + $(ls abis/factories/*.bytecode 2>/dev/null | wc -l | tr -d ' ') 个Bytecode"
echo "Creation合约: $(ls abis/creation/*.json 2>/dev/null | wc -l | tr -d ' ') 个ABI + $(ls abis/creation/*.bytecode 2>/dev/null | wc -l | tr -d ' ') 个Bytecode"
echo "Mock合约: $(ls abis/mocks/*.json 2>/dev/null | wc -l | tr -d ' ') 个ABI + $(ls abis/mocks/*.bytecode 2>/dev/null | wc -l | tr -d ' ') 个Bytecode"
echo "总计: $(find abis -name "*.json" -not -name "index.json" 2>/dev/null | wc -l | tr -d ' ') 个ABI文件 + $(find abis -name "*.bytecode" 2>/dev/null | wc -l | tr -d ' ') 个Bytecode文件"

echo ""
echo -e "${GREEN}🎉 所有ABI和Bytecode文件提取完成！${NC}"
echo -e "${BLUE}📁 文件位置: ./abis/${NC}"
echo -e "${BLUE}📋 索引文件: ./abis/index.json${NC}"
echo -e "${BLUE}📖 使用说明: ./abis/README.md${NC}"
echo ""
echo -e "${YELLOW}📋 部署流程顺序：${NC}"
echo "1. 📄 模板合约 (Mock版本)"
echo "2. 🏭 工厂合约"
echo "3. 🚀 Creation合约" 
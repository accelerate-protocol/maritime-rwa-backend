# V2架构合约ABI和Bytecode文件

本目录包含所有V2架构部署合约的ABI和Bytecode文件，按照部署流程顺序组织。

## 📋 部署流程

```
1. 📄 模板合约 (真实版本)
   ├── BasicVault.json + BasicVault.bytecode
   ├── VaultToken.json + VaultToken.bytecode
   ├── Crowdsale.json + Crowdsale.bytecode
   └── AccumulatedYield.json + AccumulatedYield.bytecode

2. 🏭 工厂合约
   ├── VaultFactory.json + VaultFactory.bytecode
   ├── TokenFactory.json + TokenFactory.bytecode
   ├── FundFactory.json + FundFactory.bytecode
   └── YieldFactory.json + YieldFactory.bytecode

3. 🚀 Creation合约
   └── Creation.json + Creation.bytecode
```

## 📁 目录结构

```
abis/
├── templates/          # 模板合约ABI和Bytecode (真实版本)
│   ├── BasicVault.json
│   ├── BasicVault.bytecode
│   ├── VaultToken.json
│   ├── VaultToken.bytecode
│   ├── Crowdsale.json
│   ├── Crowdsale.bytecode
│   ├── AccumulatedYield.json
│   └── AccumulatedYield.bytecode
├── factories/          # 工厂合约ABI和Bytecode
│   ├── VaultFactory.json
│   ├── VaultFactory.bytecode
│   ├── TokenFactory.json
│   ├── TokenFactory.bytecode
│   ├── FundFactory.json
│   ├── FundFactory.bytecode
│   ├── YieldFactory.json
│   └── YieldFactory.bytecode
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
import BasicVaultABI from './abis/templates/BasicVault.json';
import BasicVaultBytecode from './abis/templates/BasicVault.bytecode';

const provider = new ethers.JsonRpcProvider('http://localhost:8545');

// 创建合约实例
const vaultContract = new ethers.Contract(
  '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  BasicVaultABI,
  provider
);

// 调用合约方法
const manager = await vaultContract.manager();
console.log('Manager:', manager);

// 部署新合约
const factory = new ethers.ContractFactory(BasicVaultABI, BasicVaultBytecode, signer);
const newVault = await factory.deploy();
```

### Web3.js

```javascript
import Web3 from 'web3';
import BasicVaultABI from './abis/templates/BasicVault.json';
import BasicVaultBytecode from './abis/templates/BasicVault.bytecode';

const web3 = new Web3('http://localhost:8545');

// 创建合约实例
const vaultContract = new web3.eth.Contract(
  BasicVaultABI,
  '0x5FbDB2315678afecb367f032d93F642f64180aa3'
);

// 调用合约方法
const manager = await vaultContract.methods.manager().call();
console.log('Manager:', manager);

// 部署新合约
const newVault = await web3.eth.contract(BasicVaultABI).deploy({
  data: BasicVaultBytecode,
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
with open('abis/templates/BasicVault.json', 'r') as f:
    vault_abi = json.load(f)

with open('abis/templates/BasicVault.bytecode', 'r') as f:
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

- **BasicVault**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **VaultToken**: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- **Crowdsale**: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`
- **AccumulatedYield**: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
- **MockUSDT**: `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9`

### 工厂合约

- **VaultFactory**: `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707`
- **TokenFactory**: `0x0165878A594ca255338adfa4d48449f69242Eb8F`
- **FundFactory**: `0xa513E6E4b8f2a923D98304ec87F64353C4D5C853`
- **YieldFactory**: `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6`

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

1. **模板合约**: 使用真实版本作为模板，用于生产环境部署
2. **工厂合约**: 负责部署和管理模板合约的克隆实例
3. **Creation合约**: 统一的项目部署入口，自动处理合约间依赖关系
4. **Mock合约**: 只保留MockUSDT作为独立的测试代币
5. **Bytecode文件**: 包含合约的编译后字节码，用于合约部署
6. 所有ABI和Bytecode文件均为JSON格式，可直接导入使用

## 🛠️ 开发建议

- 在前端项目中，建议将这些ABI和Bytecode文件复制到前端项目的`src/abis/`目录下
- 使用TypeScript时，可以生成类型定义文件以获得更好的开发体验
- 建议为不同的网络环境维护不同的合约地址配置文件
- 模板合约使用真实版本，适用于生产环境部署
- Bytecode文件可用于合约验证和重新部署

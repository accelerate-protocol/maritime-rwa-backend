# Hardhat本地EVM环境配置指南

## 🎯 概述

Hardhat提供了多种方式来配置和使用本地EVM环境，本指南将详细介绍各种配置方法和使用场景。

## 🔧 配置方式

### **1. 使用Hardhat内置网络（推荐）**

这是最简单和最常用的方式，无需额外安装：

```typescript
// hardhat.config.ts
networks: {
  hardhat: {
    chainId: 31337,
    accounts: {
      count: 20,
      accountsBalance: "10000000000000000000000", // 10000 ETH
    },
    mining: {
      auto: true,        // 自动挖矿
      interval: 0       // 立即确认交易
    }
  }
}
```

**使用命令：**
```bash
# 运行测试（自动使用hardhat网络）
npx hardhat test

# 启动本地节点
npx hardhat node

# 在另一个终端连接到本地节点
npx hardhat test --network localhost
```

### **2. 连接到Ganache**

先启动Ganache GUI或CLI，然后配置连接：

```bash
# 安装Ganache CLI（可选）
npm install -g ganache

# 启动Ganache
ganache --port 7545 --accounts 10 --gasLimit 12000000
```

```typescript
// hardhat.config.ts
networks: {
  ganache: {
    url: "http://127.0.0.1:7545",
    chainId: 1337,
    accounts: [
      "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
    ]
  }
}
```

**使用命令：**
```bash
# 指定ganache网络运行测试
npx hardhat test --network ganache

# 部署到ganache
npx hardhat run scripts/deploy.js --network ganache
```

### **3. Fork主网环境**

在本地fork主网状态进行测试：

```typescript
// hardhat.config.ts
networks: {
  hardhat_fork: {
    chainId: 31337,
    forking: {
      url: "https://eth-mainnet.alchemyapi.io/v2/YOUR-API-KEY",
      blockNumber: 18500000,  // 可选：指定fork的区块
      enabled: true
    }
  }
}
```

**使用命令：**
```bash
# 使用fork网络运行测试
npx hardhat test --network hardhat_fork

# 启动fork节点
npx hardhat node --fork https://eth-mainnet.alchemyapi.io/v2/YOUR-API-KEY
```

## 📋 常用命令

### **基础命令**
```bash
# 编译合约
npx hardhat compile

# 运行测试（默认使用hardhat网络）
npx hardhat test

# 运行特定测试文件
npx hardhat test test/Creation.deploy.test.js

# 启动本地节点
npx hardhat node

# 检查网络配置
npx hardhat network
```

### **指定网络运行**
```bash
# 使用hardhat网络
npx hardhat test --network hardhat

# 使用localhost网络
npx hardhat test --network localhost

# 使用ganache网络
npx hardhat test --network ganache

# 使用fork网络
npx hardhat test --network hardhat_fork
```

### **部署脚本**
```bash
# 部署到本地网络
npx hardhat run scripts/deploy.js --network localhost

# 部署到fork网络
npx hardhat run scripts/deploy.js --network hardhat_fork

# 部署时显示详细信息
npx hardhat run scripts/deploy.js --network localhost --verbose
```

### **控制台交互**
```bash
# 打开Hardhat控制台
npx hardhat console

# 指定网络打开控制台
npx hardhat console --network localhost
```

在控制台中可以直接与合约交互：
```javascript
// 获取签名者
const [owner] = await ethers.getSigners();

// 部署合约
const Contract = await ethers.getContractFactory("YourContract");
const contract = await Contract.deploy();

// 调用合约函数
await contract.someFunction();
```

## 🛠️ 高级配置

### **1. 自定义Gas配置**
```typescript
networks: {
  hardhat: {
    gas: 12000000,
    gasPrice: 20000000000, // 20 gwei
    blockGasLimit: 12000000,
    allowUnlimitedContractSize: true
  }
}
```

### **2. 挖矿控制**
```typescript
networks: {
  hardhat: {
    mining: {
      auto: false,       // 手动挖矿
      interval: 5000    // 5秒挖一个块
    }
  }
}
```

### **3. 账户配置**
```typescript
networks: {
  hardhat: {
    accounts: [
      {
        privateKey: "0x...",
        balance: "10000000000000000000000"
      },
      {
        privateKey: "0x...",
        balance: "10000000000000000000000"
      }
    ]
  }
}
```

## 🔍 调试和日志

### **启用详细日志**
```typescript
networks: {
  hardhat: {
    loggingEnabled: true,
    chainId: 31337
  }
}
```

### **使用console.log调试**
```solidity
// 在Solidity合约中
import "hardhat/console.sol";

contract MyContract {
    function test() public {
        console.log("Debug message:", someValue);
    }
}
```

### **Gas报告**
```bash
# 安装gas reporter
npm install --save-dev hardhat-gas-reporter

# 运行时显示gas使用
REPORT_GAS=true npx hardhat test
```

## 📊 性能优化

### **1. 并行测试**
```bash
# 并行运行测试
npx hardhat test --parallel

# 指定并行数量
npx hardhat test --parallel --max-workers 4
```

### **2. 缓存优化**
```typescript
// hardhat.config.ts
module.exports = {
  solidity: {
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
```

### **3. 快速重新编译**
```bash
# 强制重新编译
npx hardhat compile --force

# 清理缓存
npx hardhat clean
```

## 🌐 网络切换

### **环境变量方式**
```bash
# 设置默认网络
export HARDHAT_NETWORK=localhost

# 运行测试
npx hardhat test
```

### **配置文件方式**
```typescript
// hardhat.config.ts
export default {
  defaultNetwork: "hardhat", // 设置默认网络
  networks: {
    // ... 网络配置
  }
};
```

## 🚀 实际使用示例

### **本地开发流程**
```bash
# 1. 启动本地节点
npx hardhat node

# 2. 在另一个终端部署合约
npx hardhat run scripts/deploy.js --network localhost

# 3. 运行测试
npx hardhat test --network localhost

# 4. 与合约交互
npx hardhat console --network localhost
```

### **Fork测试流程**
```bash
# 1. 设置环境变量
export MAINNET_RPC_URL="https://eth-mainnet.alchemyapi.io/v2/YOUR-API-KEY"

# 2. 运行fork测试
npx hardhat test --network hardhat_fork

# 3. 启动fork节点
npx hardhat node --fork $MAINNET_RPC_URL
```

## 📝 最佳实践

1. **开发阶段**: 使用Hardhat内置网络，快速且稳定
2. **集成测试**: 使用localhost网络，模拟真实环境
3. **主网测试**: 使用fork网络，测试与现有协议的交互
4. **性能测试**: 使用Ganache，更接近真实的Gas消耗

## ⚠️ 注意事项

- Fork网络需要稳定的RPC连接
- 本地网络重启后所有状态会清空
- 私钥不要提交到代码仓库
- 测试时注意Gas limit设置
- Fork模式会消耗较多内存

## 🔗 相关资源

- [Hardhat网络配置文档](https://hardhat.org/config/#networks-configuration)
- [Hardhat控制台使用](https://hardhat.org/guides/hardhat-console.html)
- [Ganache文档](https://trufflesuite.com/ganache/)
- [以太坊测试最佳实践](https://hardhat.org/tutorial/testing-contracts.html) 
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  
  networks: {
    // ==================== 本地网络配置 ====================
    
    // 1. Hardhat内置网络（默认）
    hardhat: {
      chainId: 31337,
      gas: 12000000,
      gasPrice: 20000000000, // 20 gwei
      blockGasLimit: 12000000,
      accounts: {
        count: 20,           // 创建20个测试账户
        accountsBalance: "10000000000000000000000", // 每个账户10000 ETH
        mnemonic: "test test test test test test test test test test test junk"
      },
      // 启用控制台日志
      loggingEnabled: true,
      // 挖矿配置
      mining: {
        auto: true,          // 自动挖矿
        interval: 0         // 立即挖矿（0延迟）
      }
    },
    
    // 2. 连接到本地Ganache
    ganache: {
      url: "http://127.0.0.1:7545",  // Ganache默认端口
      chainId: 1337,
      gas: 6721975,
      gasPrice: 20000000000,
      accounts: [
        // 在这里放入Ganache提供的私钥
        "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
      ]
    },
    
    // 3. 自定义本地网络
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      timeout: 60000,      // 60秒超时
      gas: "auto",
      gasPrice: "auto"
    },
    
    // 4. 连接到本地Geth节点
    geth_local: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      accounts: [
        // Geth账户的私钥
      ]
    },
    
    // 5. Fork主网到本地进行测试
    hardhat_fork: {
      chainId: 31337,
      gas: 12000000,
      gasPrice: 20000000000,
      accounts: {
        count: 20,
        accountsBalance: "10000000000000000000000",
      },
      forking: {
        url: process.env.MAINNET_RPC_URL || "https://eth-mainnet.alchemyapi.io/v2/your-api-key",
        blockNumber: 18500000,  // 指定fork的区块号（可选）
        enabled: true
      }
    },
    
    // 6. Fork BSC主网
    hardhat_bsc_fork: {
      chainId: 56,
      gas: 12000000,
      gasPrice: 20000000000,
      accounts: {
        count: 20,
        accountsBalance: "10000000000000000000000",
      },
      forking: {
        url: "https://bsc-dataseed1.binance.org/",
        blockNumber: 32000000
      }
    }
  },
  
  // ==================== 其他配置 ====================
  
  mocha: {
    timeout: 40000  // 测试超时时间
  },
  
  // 路径配置
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

export default config; 
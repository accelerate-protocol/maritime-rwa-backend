require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.26",
  
  networks: {
    // 默认的本地网络（推荐用于测试）
    hardhat: {
      chainId: 31337,
      accounts: {
        count: 20,
        accountsBalance: "10000000000000000000000", // 10000 ETH
      }
    },
    
    // 连接到本地启动的节点
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    
    // 连接到Ganache
    ganache: {
      url: "http://127.0.0.1:7545",
      chainId: 1337,
      // 如果使用Ganache，可以在这里放入私钥
      // accounts: ["0x..."]
    },
    
    // Fork主网进行测试（需要设置RPC_URL环境变量）
    fork: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      forking: {
        url: process.env.MAINNET_RPC_URL || "",
        blockNumber: 18500000 // 可选
      }
    }
  },
  
  mocha: {
    timeout: 40000
  }
}; 
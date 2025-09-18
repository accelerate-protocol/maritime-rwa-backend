import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-deploy";
import * as dotenv from 'dotenv';
dotenv.config();

// 配置 vault-status 任务
task("vault-status", "查询 Vault 状态信息")
  .addOptionalParam("vaultAddress", "Vault 合约地址")
  .addOptionalParam("tokenAddress", "Token 合约地址")
  .setAction(async (taskArgs, hre) => {
    // 设置环境变量，以便脚本可以使用
    if (taskArgs.vaultAddress) process.env.VAULT_ADDRESS = taskArgs.vaultAddress;
    if (taskArgs.tokenAddress) process.env.TOKEN_ADDRESS = taskArgs.tokenAddress;
    
    // 运行脚本
    await hre.run("run", { script: "scripts/vault-status.js" });
  });

// 配置 vault-lifecycle 任务
task("vault-lifecycle", "管理 Vault 生命周期的各个阶段")
  .addOptionalParam("stage", "执行阶段: deploy, invest, dividend", "deploy")
  .addOptionalParam("projectName", "项目名称，用于部署阶段")
  .addOptionalParam("vaultAddress", "Vault 合约地址，用于投资和分红阶段")
  .addOptionalParam("tokenAddress", "Token 合约地址，用于投资和分红阶段")
  .addOptionalParam("fundAddress", "Fund 合约地址，用于投资和分红阶段")
  .addOptionalParam("yieldAddress", "Yield 合约地址，用于投资和分红阶段")
  .setAction(async (taskArgs, hre) => {
    // 设置环境变量，以便脚本可以使用
    process.env.VAULT_LIFECYCLE_STAGE = taskArgs.stage;
    if (taskArgs.projectName) process.env.PROJECT_NAME = taskArgs.projectName;
    if (taskArgs.vaultAddress) process.env.VAULT_ADDRESS = taskArgs.vaultAddress;
    if (taskArgs.tokenAddress) process.env.TOKEN_ADDRESS = taskArgs.tokenAddress;
    if (taskArgs.fundAddress) process.env.FUND_ADDRESS = taskArgs.fundAddress;
    if (taskArgs.yieldAddress) process.env.YIELD_ADDRESS = taskArgs.yieldAddress;
    
    // 运行脚本
    await hre.run("run", { script: "scripts/vault-lifecycle.js" });
  });


const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.26",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: true,
            },
          },
        },
      },
    ],
  },

  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    baseMainnet: {
      url: "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532
    },
    bscTestnet: {
      // BSC Testnet RPC
      url: "https://bsc-testnet.bnbchain.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 97
    },
    bscMainnet:{
      url: "https://bsc-dataseed.bnbchain.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 56 
    },
  },
  
  // hardhat-deploy configuration
  namedAccounts: {
    deployer: 0,
    guardian: 1,
    manager: 2,
    rbfSigner: 3,
    depositTreasury: 4,
    feeReceiver: 5,
    investor1: 6,
    investor2: 7,
    investor3: 8,
    investor4: 9,
    investor5: 10,
    drds: 11,
  },
  
  // hardhat-deploy plugin configuration
  paths: {
    deployments: "deployments",
    deploy: "deploy",
    artifacts: "artifacts",
    cache: "cache",
    sources: "contracts",
    tests: "test"
  }
};

export default config;

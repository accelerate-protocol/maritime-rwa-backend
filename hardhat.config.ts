import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-deploy";
import * as dotenv from 'dotenv';
dotenv.config();

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
      // BSC 测试网 RPC
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
  
  // hardhat-deploy 配置
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
  
  // hardhat-deploy 插件配置
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

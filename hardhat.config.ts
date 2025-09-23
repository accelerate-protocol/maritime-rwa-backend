import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-deploy";
import { ethers } from "ethers";
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
    drds:11,
    common: 12,
    rbfSigner2: 13,
    investor6:14,
  },

  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      accounts: {
        count: 210,  // 设置测试账户数量
        accountsBalance: ethers.parseEther("1000000").toString()  // 每个账户的初始余额
      }
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
    bscTestnet:{
      url: "https://bsc-testnet.bnbchain.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 97,
      gasPrice: 5000000000, // 5 Gwei
      gas: 8000000, // 8M gas
      timeout: 120000, // 2 分钟超时
    },
    bscMainnet:{
      url: "https://bsc-dataseed.bnbchain.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 56 
    },
  },
};

export default config;

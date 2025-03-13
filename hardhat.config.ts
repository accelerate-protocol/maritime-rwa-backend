import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-deploy";
import { ethers } from "ethers";

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
  },

  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      accounts: {
        count: 110,  // 设置测试账户数量
        accountsBalance: ethers.parseEther("1000000").toString()  // 每个账户的初始余额
      }
    }
  },
};

export default config;

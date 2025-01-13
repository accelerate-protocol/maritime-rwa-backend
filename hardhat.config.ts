import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-deploy";

const config: HardhatUserConfig = {
  solidity: "0.8.1",
};
export default config;

module.exports = {
  namedAccounts: {
    deployer: 0
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    sepolia:{
      url: "https://sepolia.infura.io/v3/a8fd70fa80a3484ab0afcdcc8935fabd",
      accounts: [],
    },
    axiomLedger:{
      url: "http://127.0.0.1:7545",
      accounts: [],
    },

  },
  solidity: {
    compilers: [
      {
        version: "0.8.1",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: true
            }
          }
        },
      }
    ]
  }

}
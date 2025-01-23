import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const investorParams = require("../config/investor");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const vaultRouterDeployment = await deployments.get("VaultRouter");
  const { deployer } = await getNamedAccounts();
  const vaultRouter = await hre.ethers.getContractAt(
    "VaultRouter",
    vaultRouterDeployment.address
  );
  const investorArr = investorParams[hre.network.name];
  if (!investorArr) return;
  
  var vaultId= await vaultRouter.vaultNonce();
  const vaultInfo = await vaultRouter.getVaultInfo(vaultId-1n);
  console.log("vaultInfo:",vaultInfo.vault);
  const vault = await hre.ethers.getContractAt(
    "Vault", // 替换为你的合约名称
    vaultInfo.vault
  );
  const rbuManagerAddr=await vault.rbuManager();
  console.log("rbuManagerAddr:",rbuManagerAddr);
  const rbuManager = await hre.ethers.getContractAt(
    "RBUManager", // 替换为你的合约名称
    rbuManagerAddr
  );

  console.log("rbuManager添加白名单");
  await rbuManager.addToWhitelist(vaultInfo.vault, {
    from: deployer,
    gasLimit: 1000000,
  });

  console.log("===============金库添加白名单======================)");
  const vaultInvestors = investorArr.investors;
  for (let i = 0; i < vaultInvestors.length; i++) {
    console.log("添加白名单:", vaultInvestors[i]);  
    const tx=await vault.addToWhitelist(vaultInvestors[i], {
      from: deployer,
      gasLimit: 1000000,
    });
    console.log("添加白名单hash:",tx);
  }
};

export default func;
func.tags = ["BASE_VAUlT_ADD_WHITELIST"];

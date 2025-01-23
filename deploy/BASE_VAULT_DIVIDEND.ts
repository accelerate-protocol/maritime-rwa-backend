import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
const investorParams = require("../config/investor");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { execute } = deployments;
  const { deployer } = await getNamedAccounts();

  const vaultRouterDeployment = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
      "VaultRouter", 
      vaultRouterDeployment.address
    );

  var vaultId= await vaultRouter.vaultNonce();

  const vaultInfo = await vaultRouter.getVaultInfo(vaultId-1n);
  console.log("vaultInfo:",vaultInfo);

  const vault = await hre.ethers.getContractAt(
    "Vault", // 替换为你的合约名称
    vaultInfo.vault
  );


  const rbuManagerAddr=await vault.rbuManager();

  const rbuManager = await hre.ethers.getContractAt(
    "RBUManager", // 替换为你的合约名称
    rbuManagerAddr
  );

  console.log("派息金库:",await rbuManager.dividendTreasury());


  console.log("====rbu派息====)");
  const tx=await rbuManager.dividend();
  console.log("rbu派息hash",tx.hash);

  console.log("====金库派息====)");
  const tx2=await vault.dividend();
  console.log("====vault金库派息====)",tx2.hash);
};

export default func;
func.tags = ["BASE_VAULT_DIVIDEND"];

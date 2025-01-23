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

  const vault = await hre.ethers.getContractAt(
    "Vault", // 替换为你的合约名称
    vaultInfo.vault
  );

  const tx=await vault.withdrawFee("0x75a14bCca983B3880E85F4Dbb8aE750a654e17Df",{
    from: deployer,
    gasLimit: 1000000,
  });
  console.log("提取fee的hash",tx.hash);
};

export default func;
func.tags = ["BASE_WITH_FEE"];

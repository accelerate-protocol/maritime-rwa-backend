
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const vaultParams = require("../config/vault");
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts,ethers} = hre;
    const {execute} = deployments;
    const {deployer} = await getNamedAccounts();

    const deployInitParams = vaultParams[hre.network.name];
    if (!deployInitParams) return;
    
    const name=deployInitParams.name;
    const symbol=deployInitParams.symbol;
    const assetToken= await deployments.get("MockUSDT"); 
    const maxSupply=deployInitParams.maxSupply;
    const subStartTime = deployInitParams.subStartTime;
    const subEndTime = deployInitParams.subEndTime;



    const duration = deployInitParams.duration;
    const fundThreshold = deployInitParams.fundThreshold;
    const minDepositAmount = deployInitParams.minDepositAmount;
    const managerFee = deployInitParams.managerFee;
    const manager = deployInitParams.manager;

    const rbuRouterDeployment = await deployments.get("RBURouter");
    const rbuRouter = await hre.ethers.getContractAt(
      "RBURouter", 
      rbuRouterDeployment.address
    );
    const rbuInfo = await rbuRouter.getRBUInfo(0);
    const rbuManager = rbuInfo.rbuManager;
    console.log("name:",name);
    console.log("symbol:",symbol);
    console.log("assetToken:",assetToken.address);
    console.log("rbuManager:",rbuManager);
    console.log("maxSupply:",maxSupply);
    console.log("subStartTime:",subStartTime);
    console.log("subEndTime:",subEndTime);
    console.log("duration:",duration);
    console.log("fundThreshold:",fundThreshold);
    console.log("minDepositAmount:",minDepositAmount);
    console.log("managerFee:",managerFee);
    console.log("manager:",manager);

    const vaultRouterDeployment = await deployments.get("VaultRouter");
    const vaultRouter = await hre.ethers.getContractAt(
      "VaultRouter", 
      vaultRouterDeployment.address
    );

    const vaultDeployData = {
      name: name,
      symbol: symbol,
      assetToken: assetToken.address,
      rbuManager: rbuManager,
      maxSupply: maxSupply,
      subStartTime: subStartTime,
      subEndTime: subEndTime,
      duration: duration, // 转换为秒（365天）
      fundThreshold: fundThreshold,
      minDepositAmount:minDepositAmount,
      managerFee: managerFee,
      manager: manager
    };
    console.log("maxSupply:",maxSupply)
    console.log("minDepositAmount",minDepositAmount)
  
  

  
    await execute(
      'VaultRouter', 
      { from: deployer, log: true,  gasLimit: 10000000  },
      'deployVault',
      vaultDeployData
    );

    const vaultInfo = await vaultRouter.getVaultInfo(0);
    console.log("vaultInfo:",vaultInfo);

};

export default func;
func.tags = ['06_Vault_Deploy'];

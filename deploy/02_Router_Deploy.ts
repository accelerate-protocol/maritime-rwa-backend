
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const rbuRouterParams = require("../config/rbuRouter");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deploy} = deployments;
    const deployInitParams = rbuRouterParams[hre.network.name];
    if (!deployInitParams) return;
  
    const {deployer} = await getNamedAccounts();
    console.log("deployer:",deployer);
    console.log("whiteLists:",deployInitParams.whiteLists,"threshold:",deployInitParams.threshold);


    const escrowFactory = await deployments.get("EscrowFactory"); 
    const priceFeedFactory = await deployments.get("PriceFeedFactory"); 
    const rbfFactory =  await deployments.get("RBFFactory");
    const vaultFactory = await deployments.get("VaultFactory");
  
    const rbuRouter = await deploy('RBFRouter', {
      from: deployer,
      args: [deployInitParams.whiteLists,deployInitParams.threshold,rbfFactory.address,escrowFactory.address,priceFeedFactory.address],
    });
    console.log("RBFRouter:",rbuRouter.address);


    const vaultRouter = await deploy('VaultRouter', {
      from: deployer,
      args: [vaultFactory.address,escrowFactory.address],
    });
    console.log("VaultRouter:",vaultRouter.address);
};

export default func;
func.tags = ['02_Router_Deploy'];

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
    const pricerFactory = await deployments.get("PricerFactory"); 
    const rbuManagerFactory =  await deployments.get("RBUManagerFactory");
    const rbuTokenFactory = await deployments.get("RBUTokenFactory");
    console.log("escrowFactory:",escrowFactory.address);
    console.log("pricerFactory:",pricerFactory.address);
    console.log("rbuManagerFactory:",rbuManagerFactory.address);
    console.log("rbuTokenFactory:",rbuTokenFactory.address);
  
    const rbuRouter = await deploy('RBURouter', {
      from: deployer,
      args: [deployInitParams.whiteLists,deployInitParams.threshold,rbuTokenFactory.address, rbuManagerFactory.address,escrowFactory.address,pricerFactory.address],
    });
    console.log("RBURouter:",rbuRouter.address);
    
};

export default func;
func.tags = ['02_RBURouter_Deploy'];
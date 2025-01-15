
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const rbuRouterParams = require("../config/rbuRouter");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deploy,execute} = deployments;
    const deployInitParams = rbuRouterParams[hre.network.name];
    if (!deployInitParams) return;
  
    const {deployer} = await getNamedAccounts();

    const escrowFactory = await deployments.get("EscrowFactory"); 
    const vaultFactory = await deployments.get("VaultFactory");  
    const vaultRouter = await deploy('VaultRouter', {
      from: deployer,
      args: [escrowFactory.address,vaultFactory.address],
    });
    console.log("VaultRouter:",vaultRouter.address);

    await execute(
        'EscrowFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'rely',
        vaultRouter.address
    );

    await execute(
        'VaultFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'rely',
        vaultRouter.address
    );    
};

export default func;
func.tags = ['05_VaultRouter_Deploy'];
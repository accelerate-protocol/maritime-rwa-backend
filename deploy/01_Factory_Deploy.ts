
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deploy} = deployments;
  
    const {deployer} = await getNamedAccounts();

    await deploy('EscrowFactory', {
      from: deployer,
      args: [deployer],
    });

    await deploy('PricerFactory', {
        from: deployer,
        args: [deployer],
    });

    await deploy('RBUManagerFactory', {
        from: deployer,
        args: [deployer],
    });

    await deploy('RBUTokenFactory', {
        from: deployer,
        args: [deployer],
    });

    
};

export default func;
func.tags = ['01_Factory_Deploy'];
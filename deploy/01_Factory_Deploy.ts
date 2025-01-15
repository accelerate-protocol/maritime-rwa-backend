
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deploy} = deployments;
  
    const {deployer} = await getNamedAccounts();

    const EscrowFactory = await deploy('EscrowFactory', {
      from: deployer,
      args: [deployer],
    });

    const PricerFactory = await deploy('PricerFactory', {
        from: deployer,
        args: [deployer],
    });

    const RBUManagerFactory =await deploy('RBUManagerFactory', {
        from: deployer,
        args: [deployer],
    });

    const RBUTokenFactory = await deploy('RBUTokenFactory', {
        from: deployer,
        args: [deployer],
    });

    const VaultFactory =await deploy('VaultFactory', {
        from: deployer,
        args: [deployer],
    });

    console.log("EscrowFactory:",EscrowFactory.address);
    console.log("PricerFactory:",PricerFactory.address);
    console.log("RBUManagerFactory:",RBUManagerFactory.address);
    console.log("RBUTokenFactory:",RBUTokenFactory.address);
    console.log("VaultFactory:",VaultFactory.address);
};

export default func;
func.tags = ['01_Factory_Deploy'];
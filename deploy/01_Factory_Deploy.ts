
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    // const {deployments, getNamedAccounts} = hre;
    // const {deploy} = deployments;
  
    // const {deployer} = await getNamedAccounts();

    // const EscrowFactory = await deploy('EscrowFactory', {
    //   from: deployer,
    //   args: [deployer],
    // });

    // const PriceFeedFactory = await deploy('PriceFeedFactory', {
    //     from: deployer,
    //     args: [deployer],
    // });

    // const RBFFactory =await deploy('RBFFactory', {
    //     from: deployer,
    //     args: [deployer],
    // });

    // const VaultFactory =await deploy('VaultFactory', {
    //     from: deployer,
    //     args: [deployer],
    // });

    // console.log("EscrowFactory:",EscrowFactory.address);
    // console.log("PriceFeedFactory:",PriceFeedFactory.address);
    // console.log("RBFFactory:",RBFFactory.address);
    // console.log("VaultFactory:",VaultFactory.address);
};


func.tags = ['01_Factory_Deploy'];
export default func;
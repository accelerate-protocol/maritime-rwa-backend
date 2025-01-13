
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deploy,execute} = deployments;
    const {deployer} = await getNamedAccounts();

    const rbuRouter = await deployments.get("RBURouter");
    await execute(
        'EscrowFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'rely',
        rbuRouter.address
    );
    await execute(
        'PricerFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'rely',
        rbuRouter.address
    );
    await execute(
        'RBUManagerFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'rely',
        rbuRouter.address
    );
    await execute(
        'RBUTokenFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'rely',
        rbuRouter.address
    );

};

export default func;
func.tags = ['02_RBURouter_Deploy'];
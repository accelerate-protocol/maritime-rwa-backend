
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deploy,execute} = deployments;
    const {deployer} = await getNamedAccounts();

    const rbuRouter = await deployments.get("RBURouter");
    var tx=await execute(
        'EscrowFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'rely',
        rbuRouter.address
    );
    console.log("tx:",tx.transactionHash)
    tx=await execute(
        'PricerFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'rely',
        rbuRouter.address
    );
    console.log("tx:",tx.transactionHash)
    tx=await execute(
        'RBUManagerFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'rely',
        rbuRouter.address
    );
    console.log("tx:",tx.transactionHash)
    tx=await execute(
        'RBUTokenFactory', 
        { from: deployer, log: true,  gasLimit: 10000000  },
        'rely',
        rbuRouter.address
    );
    console.log("tx:",tx.transactionHash)

};

export default func;
func.tags = ['03_Factory_Auth'];
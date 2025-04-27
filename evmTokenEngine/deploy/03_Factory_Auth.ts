
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deploy,execute} = deployments;
    const {deployer} = await getNamedAccounts();

    const rbfRouter = await deployments.get("RBFRouter");
    const vaultRouter = await deployments.get("VaultRouter");


    var tx=await execute(
        'EscrowFactory', 
        { from: deployer, log: true,  gasLimit: 1000000  },
        'rely',
        rbfRouter.address
    );
    console.log("tx:",tx.transactionHash)
    tx=await execute(
        'PriceFeedFactory', 
        { from: deployer, log: true,  gasLimit: 1000000  },
        'rely',
        rbfRouter.address
    );
    console.log("tx:",tx.transactionHash)
    tx=await execute(
        'RBFFactory', 
        { from: deployer, log: true,  gasLimit: 1000000  },
        'rely',
        rbfRouter.address
    );
    console.log("tx:",tx.transactionHash)

    

    tx=await execute(
        'EscrowFactory', 
        { from: deployer, log: true,  gasLimit: 1000000  },
        'rely',
        vaultRouter.address
    );
    console.log("tx:",tx.transactionHash)
    tx=await execute(
        'VaultFactory', 
        { from: deployer, log: true,  gasLimit: 1000000  },
        'rely',
        vaultRouter.address
    )
    console.log("tx:",tx.transactionHash)

};

export default func;
func.tags = ['03_Factory_Auth'];
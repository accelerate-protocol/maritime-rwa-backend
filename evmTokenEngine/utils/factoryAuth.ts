import hre from "hardhat";
import { deployments } from 'hardhat';
const { deploy } = deployments;
import { getNamedAccounts } from 'hardhat';
export async function factoryAuth() {

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
}

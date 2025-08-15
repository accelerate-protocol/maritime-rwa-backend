
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts,ethers} = hre;
    const {deploy,execute} = deployments;
    const {deployer} = await getNamedAccounts();

    const rbfRouter = await deployments.get("RBFRouter");
    const vaultRouter = await deployments.get("VaultRouter");

    var nonce = await ethers.provider.getTransactionCount(deployer, "pending");
    var tx=await execute(
        'EscrowFactory', 
        { from: deployer, log: true,  gasLimit: 1000000,nonce: nonce },
        'rely',
        rbfRouter.address
    );
    console.log("tx:",tx.transactionHash)
    var nonce = await ethers.provider.getTransactionCount(deployer, "pending");

    tx=await execute(
        'PriceFeedFactory', 
        { from: deployer, log: true,  gasLimit: 1000000 ,nonce: nonce  },
        'rely',
        rbfRouter.address
    );
    console.log("tx:",tx.transactionHash)

    var nonce = await ethers.provider.getTransactionCount(deployer, "pending");
    tx=await execute(
        'RBFFactory', 
        { from: deployer, log: true,  gasLimit: 1000000,nonce: nonce   },
        'rely',
        rbfRouter.address
    );
    console.log("tx:",tx.transactionHash)


    var nonce = await ethers.provider.getTransactionCount(deployer, "pending");
    tx=await execute(
        'EscrowFactory', 
        { from: deployer, log: true,  gasLimit: 1000000  ,nonce: nonce },
        'rely',
        vaultRouter.address
    );
    console.log("tx:",tx.transactionHash)

    const VaultFactory =await deploy('VaultFactory', {
        contract: 'contracts/v1/factories/VaultFactory.sol:VaultFactory',
        from: deployer,
        args: [deployer],
    });
    console.log("tx:",tx.transactionHash)
};

export default func;
func.tags = ['03_Factory_Auth'];
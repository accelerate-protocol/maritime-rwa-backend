
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import * as dotenv from 'dotenv';
dotenv.config();
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts,network} = hre;
    const {deploy} = deployments;

  
    const namedAccounts = await getNamedAccounts();
    const deployer=namedAccounts.deployer;
    const rbfSigner=namedAccounts.rbfSigner;

    const escrowFactory = await deployments.get("EscrowFactory"); 
    const priceFeedFactory = await deployments.get("PriceFeedFactory"); 
    const rbfFactory =  await deployments.get("RBFFactory");
    const vaultFactory = await deployments.get("VaultFactory");

    let whiteLists: string[];
    if (network.name === 'hardhat') {
        whiteLists = [rbfSigner];
    } else {
        const drdsAddr = process.env.DRDS_ADDR;
        if (!drdsAddr) {
            throw new Error("Missing environment variable: DRDS_ADDR");
        }
        console.log("DRDS Address:", drdsAddr);
        whiteLists = [drdsAddr];
    }
  
    const rbuRouter = await deploy('RBFRouter', {
      from: deployer,
      args: [whiteLists,1,rbfFactory.address,escrowFactory.address,priceFeedFactory.address],
    });
    console.log("RBFRouter:",rbuRouter.address);


    const vaultRouter = await deploy('VaultRouter', {
      from: deployer,
      args: [escrowFactory.address,vaultFactory.address],
    });
    console.log("VaultRouter:",vaultRouter.address);
};

func.tags = ['02_Router_Deploy'];
export default func;
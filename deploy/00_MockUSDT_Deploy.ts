
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();
    const usdt=await deploy('MockUSDT', {
      from: deployer,
      args: ["USDT","USDT"],
    });

    console.log("MockUSDT:",usdt.address);
};


export default func;
func.tags = ['00_MockUSDT_Deploy'];
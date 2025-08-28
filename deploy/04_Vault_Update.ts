import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts,ethers} = hre;
    // const {deploy} = deployments;
    // const {deployer} = await getNamedAccounts();
    let guardian: HardhatEthersSigner;
    [guardian] = await ethers.getSigners();

    
    const VaultV2 = await ethers.getContractFactory("VaultV2");
    var newImplementation = await VaultV2.deploy();
    await newImplementation.waitForDeployment();

    var vault="0x4D2401c7e8E0118Aa9e80f5Aa55771CF415C228a";
    var vaultProxyAdmin="0x99a613cE15020258fd50df2dC49f5b5528eD7Cd3";
    const proxyAdmin = await ethers.getContractAt("ProxyAdmin", vaultProxyAdmin);
    await proxyAdmin.connect(guardian).upgrade(vault, newImplementation);
    const currentImplementation = await proxyAdmin.getProxyImplementation(vault);
    console.log("currentImplementation:",currentImplementation)
}

export default func;
func.tags = ['04_Vault_Update'];
import { deployments } from 'hardhat';
const { deploy } = deployments;
import { getNamedAccounts } from 'hardhat';

export async function deployFactories() {
    const { deployer,rbfSigner,rbfSigner2 } = await getNamedAccounts();
    

    // 部署工厂合约
    const EscrowFactory = await deploy('EscrowFactory', {
        from: deployer,
        args: [deployer],
    });

    const PriceFeedFactory = await deploy('PriceFeedFactory', {
        from: deployer,
        args: [deployer],
    });

    const RBFFactory = await deploy('RBFFactory', {
        from: deployer,
        args: [deployer],
    });

    const whiteLists = [rbfSigner,rbfSigner2];
    const rbuRouter = await deploy('RBFRouter', {
        from: deployer,
        args: [whiteLists, 2, RBFFactory.address, EscrowFactory.address, PriceFeedFactory.address],
    });

    const VaultFactory = await deploy('VaultFactory', {
        from: deployer,
        args: [deployer],
    });

    const vaultRouter = await deploy('VaultRouter', {
        from: deployer,
        args: [EscrowFactory.address, VaultFactory.address],
    });

    return {
        EscrowFactory,
        PriceFeedFactory,
        RBFFactory,
        rbuRouter,
        VaultFactory,
        vaultRouter
    };
}
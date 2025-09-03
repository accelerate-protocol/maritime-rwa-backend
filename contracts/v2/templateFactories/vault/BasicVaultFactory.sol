// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import "../../interfaces/IVaultTempFactory.sol";
import "../../templates/vault/BasicVault.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";


contract BasicVaultFactory is IVaultTempFactory {

    constructor()  {}

    function newVault(
        bytes memory initData,
        address guardian
    ) public override returns (address,address,address) { 
        BasicVault vaultImpl = new BasicVault();
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        TransparentUpgradeableProxy vaultProxy = new TransparentUpgradeableProxy(
                address(vaultImpl),
                address(proxyAdmin),
                ""
        );
        BasicVault vaultProxied = BasicVault(address(vaultProxy));
        vaultProxied.initiate(initData);
        proxyAdmin.transferOwnership(guardian);
        emit VaultDeployed(address(vaultProxied),address(proxyAdmin),address(vaultImpl),guardian);
        return (address(vaultProxied),address(proxyAdmin),address(vaultImpl));
    }

}
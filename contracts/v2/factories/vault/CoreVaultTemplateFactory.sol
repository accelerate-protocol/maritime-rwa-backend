// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "../../templates/vault/CoreVault.sol";
import "../../interfaces/factories/IVaultTemplateFactory.sol";


contract CoreVaultTemplateFactory is IVaultTemplateFactory {

    constructor()  {}

    function newVault(
        bytes memory initData,
        address guardian
    ) public override returns (address,address,address) { 
        require(guardian != address(0), "CoreVaultFactory: guardian can not be zero address");
        CoreVault vaultImpl = new CoreVault();
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        TransparentUpgradeableProxy vaultProxy = new TransparentUpgradeableProxy(
                address(vaultImpl),
                address(proxyAdmin),
                ""
        );
        CoreVault vaultProxied = CoreVault(address(vaultProxy));
        vaultProxied.initiate(initData);
        proxyAdmin.transferOwnership(guardian);
        emit VaultDeployed(address(vaultProxied),address(proxyAdmin),address(vaultImpl),guardian);
        return (address(vaultProxied),address(proxyAdmin),address(vaultImpl));
    }

}
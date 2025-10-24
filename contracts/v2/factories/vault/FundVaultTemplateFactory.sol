// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/
*/
pragma solidity ^0.8.26;


import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "../../templates/vault/FundVault.sol";
import "../../interfaces/factories/IVaultTemplateFactory.sol";

contract FundVaultTemplateFactory is IVaultTemplateFactory { 

    constructor()  {}

    function newVault(
        bytes memory initData,
        address guardian
    ) public override returns (address,address,address) { 
        require(guardian != address(0), "FundVaultFactory: guardian can not be zero address");
        FundVault vaultImpl = new FundVault();
        ProxyAdmin proxyAdmin = new ProxyAdmin(guardian);
        TransparentUpgradeableProxy vaultProxy = new TransparentUpgradeableProxy(
                address(vaultImpl),
                address(proxyAdmin),
                ""
        );
        FundVault vaultProxied = FundVault(address(vaultProxy));
        vaultProxied.initiate(initData);
        emit VaultDeployed(address(vaultProxied),address(proxyAdmin),address(vaultImpl),guardian);
        return (address(vaultProxied),address(proxyAdmin),address(vaultImpl));
    }



}
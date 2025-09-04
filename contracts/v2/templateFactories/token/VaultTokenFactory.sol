// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import "../../interfaces/ITokenTempFactory.sol";

import "../../templates/token/VaultToken.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";


contract VaultTokenFactory is ITokenTempFactory {

    constructor()  {}

    function newToken(
        address vault,
        bytes memory initData,
        address guardian
    ) public override returns (address,address,address) { 
        require(guardian != address(0), "VaultTokenFactory: guardian can not be zero address");
        VaultToken tokenImpl = new VaultToken();
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        TransparentUpgradeableProxy tokenProxy = new TransparentUpgradeableProxy(
                address(tokenImpl),
                address(proxyAdmin),
                ""
        );
        VaultToken tokenProxied = VaultToken(address(tokenProxy));
        tokenProxied.initiate(vault, initData);
        proxyAdmin.transferOwnership(guardian);
        emit TokenDeployed(address(tokenProxied),address(proxyAdmin),address(tokenImpl),guardian);
        return (address(tokenProxied),address(proxyAdmin),address(tokenImpl));
    }






}
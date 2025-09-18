// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "../../interfaces/factories/IYieldTemplateFactory.sol";
import "../../templates/yield/AccumulatedYield.sol";


contract AccumulatedYieldTemplateFactory is IYieldTemplateFactory {

    constructor()  {}

    function newYield(
        address vault, 
        address vaultToken, 
        bytes memory initData,
        address guardian
    ) public override returns (address,address,address) { 
        require(guardian != address(0), "AccumulatedYieldTemplateFactory: guardian can not be zero address");
        AccumulatedYield yieldImpl = new AccumulatedYield();
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        TransparentUpgradeableProxy vaultProxy = new TransparentUpgradeableProxy(
                address(yieldImpl),
                address(proxyAdmin),
                ""
        );
        AccumulatedYield yieldProxied = AccumulatedYield(address(vaultProxy));
        yieldProxied.initiate(vault,vaultToken,initData);
        proxyAdmin.transferOwnership(guardian);
        emit YieldDeployed(address(yieldProxied),address(proxyAdmin),address(yieldImpl),guardian);
        return (address(yieldProxied),address(proxyAdmin),address(yieldImpl));
    }

}
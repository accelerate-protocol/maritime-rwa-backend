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
        ProxyAdmin proxyAdmin = new ProxyAdmin(guardian);
        TransparentUpgradeableProxy vaultProxy = new TransparentUpgradeableProxy(
                address(yieldImpl),
                address(proxyAdmin),
                ""
        );
        AccumulatedYield yieldProxied = AccumulatedYield(address(vaultProxy));
        yieldProxied.initiate(vault,vaultToken,initData);
        emit YieldDeployed(address(yieldProxied),address(proxyAdmin),address(yieldImpl),guardian);
        return (address(yieldProxied),address(proxyAdmin),address(yieldImpl));
    }

}
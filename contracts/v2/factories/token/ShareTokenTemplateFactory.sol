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
import "../../interfaces/factories/ITokenTemplateFactory.sol";
import "../../templates/token/ShareToken.sol";


contract ShareTokenTemplateFactory is ITokenTemplateFactory {

    constructor()  {}

    function newToken(
        address vault,
        bytes memory initData,
        address guardian
    ) public override returns (address,address,address) { 
        require(guardian != address(0), "ShareTokenFactory: guardian can not be zero address");
        ShareToken tokenImpl = new ShareToken();
        ProxyAdmin proxyAdmin = new ProxyAdmin(guardian);
        TransparentUpgradeableProxy tokenProxy = new TransparentUpgradeableProxy(
                address(tokenImpl),
                address(proxyAdmin),
                ""
        );
        ShareToken tokenProxied = ShareToken(address(tokenProxy));
        tokenProxied.initiate(vault, initData);
        emit TokenDeployed(address(tokenProxied),address(proxyAdmin),address(tokenImpl),guardian);
        return (address(tokenProxied),address(proxyAdmin),address(tokenImpl));
    }

}
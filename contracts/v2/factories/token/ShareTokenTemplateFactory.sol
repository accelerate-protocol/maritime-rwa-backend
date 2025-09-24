// SPDX-License-Identifier: MIT
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
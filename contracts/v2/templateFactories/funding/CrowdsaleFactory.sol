// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import "../../interfaces/IFundTempFactory.sol";

import "../../templates/funding/Crowdsale.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";


contract CrowdsaleFactory is IFundTempFactory {

    constructor()  {}

    function newFund(
        address vault, 
        address token, 
        bytes memory initData,
        address guardian
    ) public override returns (address,address,address) { 
        Crowdsale fundImpl = new Crowdsale();
        ProxyAdmin proxyAdmin = new ProxyAdmin();
        TransparentUpgradeableProxy tokenProxy = new TransparentUpgradeableProxy(
                address(fundImpl),
                address(proxyAdmin),
                ""
        );
        Crowdsale fundProxied = Crowdsale(address(tokenProxy));
        fundProxied.initiate(vault,token,initData);
        proxyAdmin.transferOwnership(guardian);
        emit FundDeployed(address(fundProxied),address(proxyAdmin),address(fundImpl),guardian);
        return (address(fundProxied),address(proxyAdmin),address(fundImpl));
    }






}
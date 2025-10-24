// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/
*/
pragma solidity ^0.8.26;


import "../../templates/funding/Crowdsale.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "../../interfaces/factories/IFundTemplateFactory.sol";


contract CrowdsaleTemplateFactory is IFundTemplateFactory {

    constructor()  {}

    function newFund(
        address vault, 
        address token, 
        bytes memory initData,
        address guardian
    ) public override returns (address,address,address) { 
        require(guardian != address(0), "CrowdsaleTemplateFactory: guardian can not be zero address");
        Crowdsale fundImpl = new Crowdsale();
        ProxyAdmin proxyAdmin = new ProxyAdmin(guardian);
        TransparentUpgradeableProxy tokenProxy = new TransparentUpgradeableProxy(
                address(fundImpl),
                address(proxyAdmin),
                ""
        );
        Crowdsale fundProxied = Crowdsale(address(tokenProxy));
        fundProxied.initiate(vault,token,initData);
        emit FundDeployed(address(fundProxied),address(proxyAdmin),address(fundImpl),guardian);
        return (address(fundProxied),address(proxyAdmin),address(fundImpl));
    }

}
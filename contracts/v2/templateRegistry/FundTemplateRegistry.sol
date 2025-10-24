// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/
*/
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/factories/IFundTemplateFactory.sol";
import "../interfaces/registry/IRegistry.sol";

contract FundTemplateRegistry is IFundRegistry, Ownable {
    
    mapping(uint256 => address) public templates;
    uint256 public templateCount;

    constructor() Ownable(msg.sender)  {}
    
    function addTemplate(uint256 templateId, address template) external override onlyOwner {
        require(templateId != 0, "FundTemplateRegistry: invalid templateId");
        require(template != address(0), "FundTemplateRegistry: invalid template");
        require(templates[templateId] == address(0), "FundTemplateRegistry: template already exists");
        
        templates[templateId] = template;
        if (templateId >= templateCount) {
            templateCount = templateId + 1;
        }
        emit TemplateAdded(templateId, template);
    }
    
    function createFund(uint256 templateId, address vault,address token,bytes memory initData,address guardian) external override returns (address fund, address admin) {
        //if templateID is 0, then No need to create a contract
        if (templateId == 0) {
            return (address(0), address(0));
        }
        address template = templates[templateId];
        require(template != address(0), "FundTemplateRegistry: template not found");

        (address proxy,address proxyAdmin,) = IFundTemplateFactory(template).newFund(vault,token,initData,guardian);
        
        emit FundCreated(templateId, proxy, vault);
        return (proxy, proxyAdmin);
    }
    
    function getTemplate(uint256 templateId) external view override returns (address) {
        return templates[templateId];
    }
    
    function getTemplateCount() external view override returns (uint256) {
        return templateCount;
    }
}
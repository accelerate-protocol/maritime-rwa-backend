// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/registry/IRegistry.sol";
import "../interfaces/factories/IYieldTemplateFactory.sol";


contract YieldTemplateRegistry is IYieldRegistry, Ownable {
    
    mapping(uint256 => address) public templates;
    uint256 public templateCount;

     constructor() Ownable(msg.sender)  {}
    
    function addTemplate(uint256 templateId, address template) external override onlyOwner {
        require(templateId != 0, "YieldTemplateRegistry: invalid templateId");
        require(template != address(0), "YieldTemplateRegistry: invalid template");
        require(templates[templateId] == address(0), "YieldTemplateRegistry: template already exists");
        
        templates[templateId] = template;
        if (templateId >= templateCount) {
            templateCount = templateId + 1;
        }
        emit TemplateAdded(templateId, template);
    }
    
    function createYield(uint256 templateId, address vault, address vaultToken, bytes memory initData,address guardian) external override returns (address yield, address admin) {
        //if templateID is 0, then No need to create a contract
        if (templateId == 0) {
            return (address(0), address(0));
        }
        address template = templates[templateId];
        require(template != address(0), "YieldTemplateRegistry: template not found");

        (address proxy,address proxyAdmin,) = IYieldTemplateFactory(template).newYield(vault,vaultToken,initData,guardian);
        
        emit YieldCreated(templateId, proxy, vault);
        return (proxy, proxyAdmin);
    }
    
    function getTemplate(uint256 templateId) external view override returns (address) {
        return templates[templateId];
    }
    
    function getTemplateCount() external view override returns (uint256) {
        return templateCount;
    }
}
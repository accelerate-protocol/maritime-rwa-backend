// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/registry/IRegistry.sol";
import "../interfaces/factories/IVaultTemplateFactory.sol";

contract VaultTemplateRegistry is IVaultRegistry, Ownable {
    
    mapping(uint256 => address) public templates;
    uint256 public templateCount;

    constructor() Ownable(msg.sender)  {}
    
    function addTemplate(uint256 templateId, address template) external override onlyOwner {
        require(templateId != 0, "VaultTemplateRegistry: invalid templateId");
        require(template != address(0), "VaultTemplateRegistry: invalid template");
        require(templates[templateId] == address(0), "VaultTemplateRegistry: template already exists");
        
        templates[templateId] = template;
        if (templateId >= templateCount) {
            templateCount = templateId + 1;
        }
        
        emit TemplateAdded(templateId, template);
    }
    
    function createVault(uint256 templateId, bytes memory initData,address guardian) external override returns (address vault, address admin) {
        //if templateID is 0, then No need to create a contract
        if (templateId == 0) {
            return (address(0), address(0));
        }
        address template = templates[templateId];
        require(template != address(0), "VaultTemplateRegistry: template not found");
        
        // Use transparent proxy pattern
        (address proxy, address proxyAdmin,) = IVaultTemplateFactory(template).newVault(initData, guardian);
        
        emit VaultCreated(templateId, proxy, msg.sender);
        return (proxy, proxyAdmin);
    }
    
    function getTemplate(uint256 templateId) external view override returns (address) {
        return templates[templateId];
    }
    
    function getTemplateCount() external view override returns (uint256) {
        return templateCount;
    }
}
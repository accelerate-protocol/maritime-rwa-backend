// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/registry/IRegistry.sol";
import "../interfaces/factories/ITokenTemplateFactory.sol";

contract TokenTemplateRegistry is ITokenRegistry, Ownable {
    
    mapping(uint256 => address) public templates;
    uint256 public templateCount;

     constructor() Ownable(msg.sender)  {}
    
    function addTemplate(uint256 templateId, address template) external override onlyOwner {
        require(templateId != 0, "TokenTemplateRegistry: invalid templateId");
        require(template != address(0), "TokenTemplateRegistry: invalid template");
        require(templates[templateId] == address(0), "TokenTemplateRegistry: template already exists");
        
        templates[templateId] = template;
        if (templateId >= templateCount) {
            templateCount = templateId + 1;
        }
        
        emit TemplateAdded(templateId, template);
    }
    
    function createToken(uint256 templateId, address vault, bytes memory initData, address guardian) external override returns (address token, address admin) {
        //if templateID is 0, then No need to create a contract
        if (templateId == 0) {
            return (address(0), address(0));
        }
        address template = templates[templateId];
        require(template != address(0), "TokenTemplateRegistry: template not found");
        
        // Use transparent proxy pattern
        (address proxy, address proxyAdmin,) = ITokenTemplateFactory(template).newToken(vault, initData, guardian);
        
        emit TokenCreated(templateId, proxy, vault);
        return (proxy, proxyAdmin);
    }
    
    function getTemplate(uint256 templateId) external view override returns (address) {
        return templates[templateId];
    }
    
    function getTemplateCount() external view override returns (uint256) {
        return templateCount;
    }
}
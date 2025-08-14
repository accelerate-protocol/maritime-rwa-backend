// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFactory.sol";

contract FundFactory is IFundFactory, Ownable {
    using Clones for address;
    
    mapping(uint256 => address) public templates;
    uint256 public templateCount;
    
    function addTemplate(uint256 templateId, address template) external override onlyOwner {
        require(template != address(0), "FundFactory: invalid template");
        require(templates[templateId] == address(0), "FundFactory: template already exists");
        
        templates[templateId] = template;
        if (templateId >= templateCount) {
            templateCount = templateId + 1;
        }
        emit TemplateAdded(templateId, template);
    }
    
    function createFund(uint256 templateId, address vault, bytes memory initData) external override returns (address fund) {
        address template = templates[templateId];
        require(template != address(0), "FundFactory: template not found");
        
        fund = template.clone();
        
        bytes memory fullInitData = abi.encodeWithSignature(
            "initiate(address,bytes)",
            vault, initData
        );
        
        (bool success, ) = fund.call(fullInitData);
        require(success, "FundFactory: initialization failed");
        
        emit FundCreated(templateId, fund, msg.sender);
        
        return fund;
    }
    
    function getTemplate(uint256 templateId) external view override returns (address) {
        return templates[templateId];
    }
    
    function getTemplateCount() external view override returns (uint256) {
        return templateCount;
    }
} 
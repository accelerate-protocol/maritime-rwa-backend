// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFactory.sol";

contract VaultFactory is IVaultFactory, Ownable {
    using Clones for address;
    
    mapping(uint256 => address) public templates;
    uint256 public templateCount;
    
    function addTemplate(uint256 templateId, address template) external override onlyOwner {
        require(template != address(0), "VaultFactory: invalid template");
        require(templates[templateId] == address(0), "VaultFactory: template already exists");
        
        templates[templateId] = template;
        if (templateId >= templateCount) {
            templateCount = templateId + 1;
        }
        
        // emit TemplateAdded(templateId, template);
    }
    
    function createVault(uint256 templateId, bytes memory initData) external override returns (address vault) {
        address template = templates[templateId];
        require(template != address(0), "VaultFactory: template not found");
        
        vault = template.clone();
        
        // 解码initData为VaultUserParams结构体
        (address validator, bool whitelistEnabled, address[] memory initialWhitelist) = 
            abi.decode(initData, (address, bool, address[]));
        
        // 构造完整的初始化数据，包含manager
        bytes memory fullInitData = abi.encodeWithSignature(
            "initVault(address,address,bool,address[])",
            msg.sender, // manager
            validator,
            whitelistEnabled,
            initialWhitelist
        );
        
        // 调用初始化函数
        (bool success, ) = vault.call(fullInitData);
        require(success, "VaultFactory: initialization failed");
        
        emit VaultCreated(templateId, vault, msg.sender);
        
        return vault;
    }
    
    function getTemplate(uint256 templateId) external view override returns (address) {
        return templates[templateId];
    }
    
    function getTemplateCount() external view override returns (uint256) {
        return templateCount;
    }
} 
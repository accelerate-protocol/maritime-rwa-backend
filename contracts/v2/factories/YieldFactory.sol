// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFactory.sol";

contract YieldFactory is IYieldFactory, Ownable {
    using Clones for address;
    
    mapping(uint256 => address) public templates;
    uint256 public templateCount;
    
    function addTemplate(uint256 templateId, address template) external override onlyOwner {
        require(template != address(0), "YieldFactory: invalid template");
        require(templates[templateId] == address(0), "YieldFactory: template already exists");
        
        templates[templateId] = template;
        if (templateId >= templateCount) {
            templateCount = templateId + 1;
        }
    }
    
    function createYield(uint256 templateId, address vault, address token, bytes memory initData) external override returns (address accumulatedYield) {
        address template = templates[templateId];
        require(template != address(0), "YieldFactory: template not found");
        
        accumulatedYield = template.clone();
        
        // 使用统一的 initiate(address, bytes) 接口
        // 将 vault 和 token 信息编码到 initData 中
        bytes memory fullInitData = abi.encodeWithSignature(
            "initiate(address,bytes)",
            vault, 
            abi.encode(token, initData)
        );
        
        // 调用初始化函数
        (bool success, ) = accumulatedYield.call(fullInitData);
        require(success, "YieldFactory: initialization failed");
        
        emit YieldCreated(templateId, accumulatedYield, msg.sender);
        
        return accumulatedYield;
    }
    
    function getTemplate(uint256 templateId) external view override returns (address) {
        return templates[templateId];
    }
    
    function getTemplateCount() external view override returns (uint256) {
        return templateCount;
    }
} 
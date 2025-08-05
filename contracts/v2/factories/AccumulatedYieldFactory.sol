// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFactory.sol";

contract AccumulatedYieldFactory is IAccumulatedYieldFactory, Ownable {
    using Clones for address;
    
    mapping(uint256 => address) public templates;
    uint256 public templateCount;
    
    function addTemplate(uint256 templateId, address template) external override onlyOwner {
        require(template != address(0), "AccumulatedYieldFactory: invalid template");
        require(templates[templateId] == address(0), "AccumulatedYieldFactory: template already exists");
        
        templates[templateId] = template;
        if (templateId >= templateCount) {
            templateCount = templateId + 1;
        }
    }
    
    function createAccumulatedYield(uint256 templateId, address vault, address token, bytes memory initData) external override returns (address accumulatedYield) {
        address template = templates[templateId];
        require(template != address(0), "AccumulatedYieldFactory: template not found");
        
        accumulatedYield = template.clone();
        
        // 解码initData为AccumulatedYieldUserParams结构体
        (address rewardToken, address rewardManager) = 
            abi.decode(initData, (address, address));
        
        // 构造完整的初始化数据，包含vault和shareToken
        bytes memory fullInitData = abi.encodeWithSignature(
            "initGlobalPool(address,address,address,address,address)",
            vault, rewardManager, rewardManager, token, rewardToken
        );
        
        // 调用初始化函数
        (bool success, ) = accumulatedYield.call(fullInitData);
        require(success, "AccumulatedYieldFactory: initialization failed");
        
        emit AccumulatedYieldCreated(templateId, accumulatedYield, msg.sender);
        
        return accumulatedYield;
    }
    
    function getTemplate(uint256 templateId) external view override returns (address) {
        return templates[templateId];
    }
    
    function getTemplateCount() external view override returns (uint256) {
        return templateCount;
    }
} 
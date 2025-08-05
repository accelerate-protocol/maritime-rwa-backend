// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
    }
    
    function createFund(uint256 templateId, address vault, address token, bytes memory initData) external override returns (address fund) {
        address template = templates[templateId];
        require(template != address(0), "FundFactory: template not found");
        
        fund = template.clone();
        
        // 解码initData为FundUserParams结构体
        (uint256 startTime, uint256 endTime, address assetToken, uint256 maxSupply, uint256 softCap, 
         uint256 sharePrice, uint256 minDepositAmount, uint256 manageFeeBps, address fundingReceiver, 
         address manageFeeReceiver, uint256 decimalsMultiplier) = 
            abi.decode(initData, (uint256, uint256, address, uint256, uint256, uint256, uint256, uint256, address, address, uint256));
        
        // 构造完整的初始化数据，包含vault和token
        bytes memory fullInitData = abi.encodeWithSignature(
            "initCrowdsale(address,address,uint256,uint256,address,uint256,uint256,uint256,uint256,uint256,address,address,uint256,address)",
            vault, token, startTime, endTime, assetToken, maxSupply, softCap, sharePrice, minDepositAmount, manageFeeBps, fundingReceiver, manageFeeReceiver, decimalsMultiplier, msg.sender
        );
        
        // 调用初始化函数
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
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "../interfaces/ICreation.sol";
import "../factories/VaultFactory.sol";
import "../factories/TokenFactory.sol";
import "../factories/FundFactory.sol";
import "../factories/YieldFactory.sol";

contract Creation is ICreation, Ownable {
    VaultFactory public vaultFactory;
    TokenFactory public tokenFactory;
    FundFactory public fundFactory;
    YieldFactory public yieldFactory;
    
    // 用户传入的初始化参数结构体（不包含上下文合约地址）
    struct VaultUserParams {
        address validator;
        bool whitelistEnabled;
        address[] initialWhitelist;
    }
    
    struct TokenUserParams {
        string name;
        string symbol;
        uint8 decimals;
    }
    
    struct FundUserParams {
        uint256 startTime;
        uint256 endTime;
        address assetToken;
        uint256 maxSupply;
        uint256 softCap;
        uint256 sharePrice;
        uint256 minDepositAmount;
        uint256 manageFeeBps;
        address fundingReceiver;
        address manageFeeReceiver;
        uint256 decimalsMultiplier;
    }
    
    struct AccumulatedYieldUserParams {
        address rewardToken;
        address rewardManager;
    }
    
    // 项目结构
    struct Project {
        address vault;
        address token;
        address fund;
        address accumulatedYield;
        uint256 createdAt;
    }
    
    Project[] public projects;
    
    event ProjectCreated(uint256 indexed projectId, address vault, address token, address fund, address accumulatedYield);
    
    constructor(
        address _vaultFactory,
        address _tokenFactory,
        address _fundFactory,
        address _YieldFactory
    ) {
        vaultFactory = VaultFactory(_vaultFactory);
        tokenFactory = TokenFactory(_tokenFactory);
        fundFactory = FundFactory(_fundFactory);
        yieldFactory = YieldFactory(_YieldFactory);
        
        // 确保 owner 被正确设置
        _transferOwnership(msg.sender);
    }
    
    // 实现接口的deployAll方法
    function deployAll(
        uint256 vaultTemplateId,
        bytes memory vaultInitData,
        uint256 tokenTemplateId,
        bytes memory tokenInitData,
        uint256 fundTemplateId,
        bytes memory fundInitData,
        uint256 dividendTemplateId,
        bytes memory dividendInitData
    ) external override returns (DeploymentResult memory result) {
        // 1. 部署Vault
        address vault = vaultFactory.createVault(vaultTemplateId, vaultInitData);
        require(vault != address(0), "Creation: vault creation failed");
        
        // 2. 部署Token（需要vault参数）
        address token = tokenFactory.createToken(tokenTemplateId, vault, tokenInitData);
        require(token != address(0), "Creation: token creation failed");
        
        // 3. 部署Fund
        address fund = fundFactory.createFund(fundTemplateId, vault, fundInitData);
        require(fund != address(0), "Creation: fund creation failed");
        
        // 4. 部署AccumulatedYield
        address accumulatedYield = yieldFactory.createYield(
            dividendTemplateId,
            vault,
            token,
            dividendInitData
        );
        require(accumulatedYield != address(0), "Creation: accumulatedYield creation failed");
        
        // 5. 配置模块间的依赖关系
        _configureModules(vault, token, fund, accumulatedYield);
        
        // 6. 创建项目记录
        uint256 projectId = projects.length;
        projects.push(Project({
            vault: vault,
            token: token,
            fund: fund,
            accumulatedYield: accumulatedYield,
            createdAt: block.timestamp
        }));
        
        // 7. 构造返回结果
        result = DeploymentResult({
            vault: vault,
            token: token,
            fund: fund,
            accumulatedYield: accumulatedYield
        });
        
        emit ProjectCreated(projectId, vault, token, fund, accumulatedYield);
        emit FullDeployment(msg.sender, vault, token, fund, accumulatedYield);
        
        return result;
    }
    
    // 新增：使用用户参数结构体的deployAll方法
    function deployAllWithUserParams(
        uint256 vaultTemplateId,
        bytes memory vaultParams,
        uint256 tokenTemplateId,
        bytes memory tokenParams,
        uint256 fundTemplateId,
        bytes memory fundParams,
        uint256 accumulatedYieldTemplateId,
        bytes memory accumulatedYieldParams
    ) external returns (uint256 projectId) {
        // 1. 部署Vault
        address vault = vaultFactory.createVault(vaultTemplateId, vaultParams);
        require(vault != address(0), "Creation: vault creation failed");
        
        // 2. 部署Token（需要vault参数）
        address token = tokenFactory.createToken(tokenTemplateId, vault, tokenParams);
        require(token != address(0), "Creation: token creation failed");
        
        // 3. 部署Fund
        address fund = fundFactory.createFund(fundTemplateId, vault, fundParams);
        require(fund != address(0), "Creation: fund creation failed");
        
        // 4. 部署AccumulatedYield
        address accumulatedYield = yieldFactory.createYield(
            accumulatedYieldTemplateId,
            vault,
            token,
            accumulatedYieldParams
        );
        require(accumulatedYield != address(0), "Creation: accumulatedYield creation failed");
        
        // 5. 配置模块间的依赖关系
        _configureModules(vault, token, fund, accumulatedYield);
        
        // 6. 创建项目记录
        projectId = projects.length;
        projects.push(Project({
            vault: vault,
            token: token,
            fund: fund,
            accumulatedYield: accumulatedYield,
            createdAt: block.timestamp
        }));
        
        emit ProjectCreated(projectId, vault, token, fund, accumulatedYield);
        
        return projectId;
    }
    
    function _configureModules(address vault, address token, address fund, address accumulatedYield) internal {
        // 注意：在 Clones 模式下，这些配置函数需要在初始化后由 manager 调用
        // 由于 Creation 合约不是 manager，我们需要在部署后由用户手动配置
        // 或者修改这些函数的权限控制
        
        // 暂时跳过自动配置，让用户手动配置
        // 这样可以确保正确的权限控制
    }
    
    // 实现接口的其他方法
    function setFactories(
        address _vaultFactory,
        address _tokenFactory,
        address _fundFactory,
        address _dividendFactory
    ) external override onlyOwner {
        vaultFactory = VaultFactory(_vaultFactory);
        tokenFactory = TokenFactory(_tokenFactory);
        fundFactory = FundFactory(_fundFactory);
        yieldFactory = YieldFactory(_dividendFactory);
        
        emit FactoriesUpdated(_vaultFactory, _tokenFactory, _fundFactory, _dividendFactory);
    }
    
    function getFactories() external view override returns (
        address,
        address,
        address,
        address
    ) {
        return (address(vaultFactory), address(tokenFactory), address(fundFactory), address(yieldFactory));
    }
    
    function deployVault(uint256 templateId, bytes memory initData) external override returns (address vault) {
        vault = vaultFactory.createVault(templateId, initData);
        emit VaultCreated(vault);
        return vault;
    }
    
    function deployToken(uint256 templateId, address vault, bytes memory initData) external override returns (address token) {
        token = tokenFactory.createToken(templateId, vault, initData);
        emit TokenCreated(token);
        return token;
    }
    
    function deployFund(uint256 templateId, address vault, bytes memory initData) external override returns (address fund) {
        fund = fundFactory.createFund(templateId, vault, initData);
        emit FundCreated(fund);
        return fund;
    }
    
    function deployDividend(uint256 templateId, address vault, address token, bytes memory initData) external override returns (address dividend) {
        dividend = yieldFactory.createYield(templateId, vault, token, initData);
        emit YieldCreated(dividend);
        return dividend;
    }
    
    function getProjectCount() external view override returns (uint256) {
        return projects.length;
    }
    
    function getProject(uint256 index) external view override returns (DeploymentResult memory result) {
        require(index < projects.length, "Creation: project not found");
        Project memory project = projects[index];
        return DeploymentResult({
            vault: project.vault,
            token: project.token,
            fund: project.fund,
            accumulatedYield: project.accumulatedYield
        });
    }
    
    function getUserProjects(address user) external view override returns (DeploymentResult[] memory userProjects) {
        // 简化实现：返回所有项目
        // 实际应该根据用户地址过滤
        uint256 count = this.getProjectCount();
        userProjects = new DeploymentResult[](count);
        for (uint256 i = 0; i < count; i++) {
            userProjects[i] = this.getProject(i);
        }
        return userProjects;
    }
    
    // 新增：获取项目详情的方法
    function getProjectDetails(uint256 projectId) external view returns (Project memory) {
        require(projectId < projects.length, "Creation: project not found");
        return projects[projectId];
    }
} 
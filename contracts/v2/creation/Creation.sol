// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "../interfaces/ICreation.sol";
import "../factories/VaultFactory.sol";
import "../factories/TokenFactory.sol";
import "../factories/FundFactory.sol";
import "../factories/AccumulatedYieldFactory.sol";

contract Creation is ICreation, Ownable {
    VaultFactory public vaultFactory;
    TokenFactory public tokenFactory;
    FundFactory public fundFactory;
    AccumulatedYieldFactory public accumulatedYieldFactory;
    
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
        address _accumulatedYieldFactory
    ) {
        vaultFactory = VaultFactory(_vaultFactory);
        tokenFactory = TokenFactory(_tokenFactory);
        fundFactory = FundFactory(_fundFactory);
        accumulatedYieldFactory = AccumulatedYieldFactory(_accumulatedYieldFactory);
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
        result.vault = vaultFactory.createVault(vaultTemplateId, vaultInitData);
        require(result.vault != address(0), "Creation: vault creation failed");
        
        // 2. 部署Token（需要vault参数）
        result.token = tokenFactory.createToken(tokenTemplateId, result.vault, tokenInitData);
        require(result.token != address(0), "Creation: token creation failed");
        
        // 3. 部署Fund
        result.fund = fundFactory.createFund(fundTemplateId, result.vault, fundInitData);
        require(result.fund != address(0), "Creation: fund creation failed");
        
        // 4. 部署AccumulatedYield
        result.accumulatedYield = accumulatedYieldFactory.createAccumulatedYield(
            dividendTemplateId,
            result.vault,
            result.token,
            dividendInitData
        );
        require(result.accumulatedYield != address(0), "Creation: accumulatedYield creation failed");
        
        // 5. 配置模块间的依赖关系
        _configureModules(result.vault, result.token, result.fund, result.accumulatedYield);
        
        // 6. 创建项目记录
        uint256 projectId = projects.length;
        projects.push(Project({
            vault: result.vault,
            token: result.token,
            fund: result.fund,
            accumulatedYield: result.accumulatedYield,
            createdAt: block.timestamp
        }));
        
        emit ProjectCreated(projectId, result.vault, result.token, result.fund, result.accumulatedYield);
        emit FullDeployment(msg.sender, result.vault, result.token, result.fund, result.accumulatedYield);
        
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
        address accumulatedYield = accumulatedYieldFactory.createAccumulatedYield(
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
        // 配置Vault的token
        if (vault != address(0) && token != address(0)) {
            (bool success, ) = vault.call(
                abi.encodeWithSignature("setVaultToken(address)", token)
            );
            require(success, "Creation: setVaultToken failed");
        }
        
        // 配置Vault的模块地址
        if (vault != address(0)) {
            if (fund != address(0)) {
                (bool success, ) = vault.call(
                    abi.encodeWithSignature("setFundingModule(address)", fund)
                );
                require(success, "Creation: setFundingModule failed");
            }
            
            if (accumulatedYield != address(0)) {
                (bool success, ) = vault.call(
                    abi.encodeWithSignature("setDividendModule(address)", accumulatedYield)
                );
                require(success, "Creation: setDividendModule failed");
            }
        }
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
        accumulatedYieldFactory = AccumulatedYieldFactory(_dividendFactory);
        
        emit FactoriesUpdated(_vaultFactory, _tokenFactory, _fundFactory, _dividendFactory);
    }
    
    function getFactories() external view override returns (
        address,
        address,
        address,
        address
    ) {
        return (address(vaultFactory), address(tokenFactory), address(fundFactory), address(accumulatedYieldFactory));
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
        dividend = accumulatedYieldFactory.createAccumulatedYield(templateId, vault, token, initData);
        emit AccumulatedYieldCreated(dividend);
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
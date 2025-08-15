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
    
    // User-supplied initialization parameter struct (excluding context contract addresses)
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
        address dividendTreasury;
    }

    // Project mapping: project name => project details
    mapping(string => Project) public projects;
    
    // User project mapping: deployer => projectName[]
    mapping(address => string[]) public userProjects;
    
    // Whitelist permission
    mapping(address => bool) public whitelist;

    modifier onlyWhitelisted() {
        require(whitelist[msg.sender], "Creation: not whitelisted");
        _;
    }

    function addToWhitelist(address user) external onlyOwner {
        whitelist[user] = true;
    }
    function removeFromWhitelist(address user) external onlyOwner {
        whitelist[user] = false;
    }

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
        
        // Ensure owner is set correctly
        _transferOwnership(msg.sender);
        whitelist[msg.sender] = true;
    }
    
    // Implementation of the deployAll method in the interface
    function deployAll(
        string memory projectName,
        uint256 vaultTemplateId,
        bytes memory vaultInitData,
        uint256 tokenTemplateId,
        bytes memory tokenInitData,
        uint256 fundTemplateId,
        bytes memory fundInitData,
        uint256 dividendTemplateId,
        bytes memory dividendInitData
    ) external override onlyWhitelisted returns (DeploymentResult memory result) {
        // Parameter validation
        require(bytes(projectName).length > 0, "Creation: project name cannot be empty");
        require(bytes(projects[projectName].name).length == 0, "Creation: project name already exists");
        
        // Validate Vault initialization data
        require(vaultInitData.length > 0, "Creation: vault init data cannot be empty");
        try this.validateVaultInitData(vaultInitData) {
            // Validation passed
        } catch {
            revert("Creation: invalid vault init data format");
        }
        
        // Validate Token initialization data
        require(tokenInitData.length > 0, "Creation: token init data cannot be empty");
        try this.validateTokenInitData(tokenInitData) {
            // Validation passed
        } catch {
            revert("Creation: invalid token init data format");
        }
        
        // Validate Fund initialization data
        require(fundInitData.length > 0, "Creation: fund init data cannot be empty");
        try this.validateFundInitData(fundInitData) {
            // Validation passed
        } catch {
            revert("Creation: invalid fund init data format");
        }
        
        // Validate Dividend initialization data
        require(dividendInitData.length > 0, "Creation: dividend init data cannot be empty");
        try this.validateDividendInitData(dividendInitData) {
            // Validation passed
        } catch {
            revert("Creation: invalid dividend init data format");
        }
        // 1. Deploy Vault
        address vault = vaultFactory.createVault(vaultTemplateId, vaultInitData);
        require(vault != address(0), "Creation: vault creation failed");
        
        // 2. Deploy Token (requires vault parameter)
        address token = tokenFactory.createToken(tokenTemplateId, vault, tokenInitData);
        require(token != address(0), "Creation: token creation failed");
        
        // 3. Deploy Fund
        address fund = fundFactory.createFund(fundTemplateId, vault, fundInitData);
        require(fund != address(0), "Creation: fund creation failed");
        
        // 4. Deploy AccumulatedYield
        address accumulatedYield = yieldFactory.createYield(
            dividendTemplateId,
            vault,
            token,
            dividendInitData
        );
        require(accumulatedYield != address(0), "Creation: accumulatedYield creation failed");
        
        // 5. Create project record
        projects[projectName] = Project({
            name: projectName,
            vault: vault,
            token: token,
            fund: fund,
            accumulatedYield: accumulatedYield,
            createdAt: block.timestamp,
            deployer: msg.sender
        });
        
        userProjects[msg.sender].push(projectName);
        
        // 7. Construct return result
        result = DeploymentResult({
            vault: vault,
            token: token,
            fund: fund,
            accumulatedYield: accumulatedYield
        });
        
        emit ProjectCreated(projectName, vault, token, fund, accumulatedYield, msg.sender);
        
        return result;
    }
    
    // Validate Vault initialization data format
    function validateVaultInitData(bytes memory vaultInitData) external pure {
        (address manager, address validator, bool whitelistEnabled, address[] memory initialWhitelist) =
            abi.decode(vaultInitData, (address, address, bool, address[]));
        
        require(manager != address(0), "Creation: vault manager cannot be zero address");
        require(validator != address(0), "Creation: vault validator cannot be zero address");
        
        // If whitelist is enabled, check initial whitelist
        if (whitelistEnabled) {
            require(initialWhitelist.length > 0, "Creation: initial whitelist cannot be empty when whitelist is enabled");
            for (uint256 i = 0; i < initialWhitelist.length; i++) {
                require(initialWhitelist[i] != address(0), "Creation: whitelist address cannot be zero");
            }
        }
    }
    
    // Validate Token initialization data format
    function validateTokenInitData(bytes memory tokenInitData) external pure {
        (string memory name, string memory symbol, uint8 decimals) =
            abi.decode(tokenInitData, (string, string, uint8));
        
        require(bytes(name).length > 0, "Creation: token name cannot be empty");
        require(bytes(symbol).length > 0, "Creation: token symbol cannot be empty");
        require(decimals <= 18, "Creation: token decimals cannot exceed 18");
    }
    
    // Validate Fund initialization data format
    function validateFundInitData(bytes memory fundInitData) external pure {
        (
            uint256 startTime,
            uint256 endTime,
            address assetToken,
            uint256 maxSupply,
            uint256 softCap,
            uint256 sharePrice,
            uint256 minDepositAmount,
            uint256 manageFeeBps,
            address fundingReceiver,
            address manageFeeReceiver,
            uint256 decimalsMultiplier
        ) = abi.decode(fundInitData, (uint256, uint256, address, uint256, uint256, uint256, uint256, uint256, address, address, uint256));
        
        require(startTime > 0, "Creation: start time must be greater than 0");
        require(endTime > startTime, "Creation: end time must be after start time");
        require(assetToken != address(0), "Creation: asset token cannot be zero address");
        require(maxSupply > 0, "Creation: max supply must be greater than 0");
        require(softCap > 0 && softCap <= maxSupply, "Creation: soft cap must be greater than 0 and not exceed max supply");
        require(sharePrice > 0, "Creation: share price must be greater than 0");
        require(minDepositAmount > 0, "Creation: min deposit amount must be greater than 0");
        require(manageFeeBps <= 10000, "Creation: manage fee cannot exceed 100%");
        require(fundingReceiver != address(0), "Creation: funding receiver cannot be zero address");
        require(manageFeeReceiver != address(0), "Creation: manage fee receiver cannot be zero address");
        require(decimalsMultiplier > 0, "Creation: decimals multiplier must be greater than 0");
    }
    
    // Validate Dividend initialization data format
    function validateDividendInitData(bytes memory dividendInitData) external pure {
        (address rewardToken, address rewardManager, address dividendTreasury) =
            abi.decode(dividendInitData, (address, address, address));
        
        require(rewardToken != address(0), "Creation: reward token cannot be zero address");
        require(rewardManager != address(0), "Creation: reward manager cannot be zero address");
        require(dividendTreasury != address(0), "Creation: dividend treasury cannot be zero address");
    }
    
    // Other interface methods
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
    
    function deployDividend(uint256 templateId, address vault, address vaultToken, bytes memory initData) external override returns (address dividend) {
        dividend = yieldFactory.createYield(templateId, vault, vaultToken, initData);
        emit YieldCreated(dividend);
        return dividend;
    }
    
    // Get project details by project name
    function getProjectByName(string memory projectName) external view returns (Project memory) {
        Project memory project = projects[projectName];
        require(bytes(project.name).length > 0, "Creation: project not found");
        return project;
    }
    
    // Get all project details for a user
    function getUserProjectDetails(address user) external view returns (Project[] memory) {
        string[] memory projectNames = userProjects[user];
        Project[] memory userProjectDetails = new Project[](projectNames.length);
        for (uint256 i = 0; i < projectNames.length; i++) {
            userProjectDetails[i] = projects[projectNames[i]];
        }
        return userProjectDetails;
    }
    
    // Get all projects for a user (returns DeploymentResult array)
    function getUserProjects(address user) external view override returns (DeploymentResult[] memory result) {
        string[] memory projectNames = userProjects[user];
        result = new DeploymentResult[](projectNames.length);
        for (uint256 i = 0; i < projectNames.length; i++) {
            Project memory project = projects[projectNames[i]];
            result[i] = DeploymentResult({
                vault: project.vault,
                token: project.token,
                fund: project.fund,
                accumulatedYield: project.accumulatedYield
            });
        }
        return result;
    }
} 
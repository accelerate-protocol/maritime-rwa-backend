// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "../interfaces/ICreation.sol";
import "../interfaces/IVault.sol";
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
        address yieldTreasury;
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
    
    // ============ Management/Deployment Methods ============
    
    /**
     * @notice Deploy a new project with all modules (Vault, Token, Fund, Yield) in one transaction.
     * @dev This function deploys each module via their respective factories and records the project information. Emits ProjectCreated event on success.
     * @param projectName The name of the project to be created.
     * @param vaultTemplateId The template ID for the Vault module.
     * @param vaultInitData The initialization data for the Vault module (encoded as bytes).
     * @param tokenTemplateId The template ID for the Token module.
     * @param tokenInitData The initialization data for the Token module (encoded as bytes).
     * @param fundTemplateId The template ID for the Fund module.
     * @param fundInitData The initialization data for the Fund module (encoded as bytes).
     * @param yieldTemplateId The template ID for the Yield module.
     * @param yieldInitData The initialization data for the Yield module (encoded as bytes).
     */
    function deployAll(
        string memory projectName,
        uint256 vaultTemplateId,
        bytes memory vaultInitData,
        uint256 tokenTemplateId,
        bytes memory tokenInitData,
        uint256 fundTemplateId,
        bytes memory fundInitData,
        uint256 yieldTemplateId,
        bytes memory yieldInitData,
        address guardian
    ) external override onlyWhitelisted {
        require(bytes(projectName).length > 0, "Creation: project name cannot be empty");
        require(bytes(projects[projectName].name).length == 0, "Creation: project name already exists");
        // 1. Deploy Vault
        address vault = vaultFactory.createVault(vaultTemplateId, vaultInitData,guardian);
        require(vault != address(0), "Creation: vault creation failed");
        // 2. Deploy Token (requires vault parameter)
        address token = tokenFactory.createToken(tokenTemplateId, vault, tokenInitData,guardian);
        require(token != address(0), "Creation: token creation failed");
        // 3. Deploy Fund
        address fund = fundFactory.createFund(fundTemplateId, vault,token,fundInitData,guardian);
        require(fund != address(0), "Creation: fund creation failed");
        // 4. Deploy Yield
        address accumulatedYield = yieldFactory.createYield(
            yieldTemplateId,
            vault,
            token,
            yieldInitData,
            guardian
        );
        require(accumulatedYield != address(0), "Creation: yield creation failed");
        
        // 5. Configure Vault modules (cross-contract call)
        IVault(vault).configureModules(token, fund, accumulatedYield);
        
        // 6. Create project record
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
        // 6. Emit event
        emit ProjectCreated(projectName, vault, token, fund, accumulatedYield, msg.sender);
    }
    function setFactories(
        address _vaultFactory,
        address _tokenFactory,
        address _fundFactory,
        address _yieldFactory
    ) external override onlyOwner {
        vaultFactory = VaultFactory(_vaultFactory);
        tokenFactory = TokenFactory(_tokenFactory);
        fundFactory = FundFactory(_fundFactory);
        yieldFactory = YieldFactory(_yieldFactory);
        
        emit FactoriesUpdated(_vaultFactory, _tokenFactory, _fundFactory, _yieldFactory);
    }
    function addToWhitelist(address user) external onlyOwner {
        whitelist[user] = true;
    }
    function removeFromWhitelist(address user) external onlyOwner {
        whitelist[user] = false;
    }

    // ============ Query Methods ============
    function getFactories() external view override returns (
        address,
        address,
        address,
        address
    ) {
        return (address(vaultFactory), address(tokenFactory), address(fundFactory), address(yieldFactory));
    }
    function getProjectByName(string memory projectName) external view returns (Project memory) {
        Project memory project = projects[projectName];
        require(bytes(project.name).length > 0, "Creation: project not found");
        return project;
    }
    function getUserProjectDetails(address user) external view returns (Project[] memory) {
        string[] memory projectNames = userProjects[user];
        Project[] memory userProjectDetails = new Project[](projectNames.length);
        for (uint256 i = 0; i < projectNames.length; i++) {
            userProjectDetails[i] = projects[projectNames[i]];
        }
        return userProjectDetails;
    }    
} 
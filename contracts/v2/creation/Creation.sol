// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../interfaces/core/ICreation.sol";
import "../interfaces/templates/IVault.sol";
import "../interfaces/registry/IRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Creation
 * @dev One-click deployment contract for creating complete projects including Vault, Token, Fund, and Yield modules
 * @notice This contract allows whitelisted users to deploy complete project components in a single transaction
x */
contract Creation is ICreation, Ownable, AccessControl {
    /**
     * @notice Vault template registry instance
     */
    IVaultRegistry public immutable vaultRegistry;
    
    /**
     * @notice Token template registry instance
     */
    ITokenRegistry public immutable tokenRegistry;
    
    /**
     * @notice Fund template registry instance
     */
    IFundRegistry public immutable fundRegistry;
    
    /**
     * @notice Yield template registry instance
     */
    IYieldRegistry public immutable yieldRegistry;


    // ============ Access Role ============
    // Role identifier for whitelist admin role
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    // Role identifier for vault launch role
    bytes32 public constant VAULT_LAUNCH_ROLE = keccak256("VAULT_LAUNCH_ROLE");

    /**
     * @notice Constructor, initializes template registries and sets the owner
     * @param _vaultRegistry Vault template registry address
     * @param _tokenRegistry Token template registry address
     * @param _fundRegistry Fund template registry address
     * @param _yieldRegistry Yield template registry address
     */
    constructor(
        address _vaultRegistry,
        address _tokenRegistry,
        address _fundRegistry,
        address _yieldRegistry,
        address[] memory initialManagers
    ) Ownable(msg.sender) {

        vaultRegistry = IVaultRegistry(_vaultRegistry);
        tokenRegistry = ITokenRegistry(_tokenRegistry);
        fundRegistry = IFundRegistry(_fundRegistry);
        yieldRegistry = IYieldRegistry(_yieldRegistry);


        // Initialize roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(VAULT_LAUNCH_ROLE, msg.sender);
        _setRoleAdmin(MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(VAULT_LAUNCH_ROLE, MANAGER_ROLE);

        // Setup initial managers
        for (uint256 i = 0; i < initialManagers.length; i++) {
            if (initialManagers[i] != address(0)) {
                _grantRole(MANAGER_ROLE, initialManagers[i]);
            }
        }
    }
    
    // ============ Management/Deployment Methods ============
    
    /**
     * @notice Deploy a new project with all modules (Vault, Token, Fund, Yield) in a single transaction
     * @dev This function deploys each module through their respective registries and records project information. Emits ProjectCreated event on success
     * @param params Deployment parameters containing template IDs, initialization data and guardian address
     */
    function deployAll(
        DeployParams memory params
    ) external override onlyRole(VAULT_LAUNCH_ROLE) {
        // 1. Deploy Vault
        (address vault, address vaultProxy) = vaultRegistry.createVault(params.vaultTemplateId, params.vaultInitData, params.guardian);
        require(vault != address(0), "Creation: vault creation failed");
        TemplateResult memory vaultResult = TemplateResult(
            params.vaultTemplateId,
            vault,
            vaultProxy
        );
        // 2. Deploy Token (requires vault parameter)
        (address token, address tokenProxy) = tokenRegistry.createToken(params.tokenTemplateId, vault, params.tokenInitData, params.guardian);
        require(token != address(0), "Creation: token creation failed");
        TemplateResult memory tokenResult = TemplateResult(
            params.tokenTemplateId,
            token,
            tokenProxy
        );
        // 3. Deploy Fund
        (address fund, address fundProxy) = fundRegistry.createFund(params.fundTemplateId, vault, token, params.fundInitData, params.guardian);
        require(fund != address(0), "Creation: fund creation failed");
        TemplateResult memory fundResult = TemplateResult(
            params.fundTemplateId,
            fund,
            fundProxy
        );
        // 4. Deploy Yield
        (address yield, address yieldProxy) = yieldRegistry.createYield(
            params.yieldTemplateId,
            vault,
            token,
            params.yieldInitData,
            params.guardian
        );
        require(yield != address(0), "Creation: yield creation failed");
        TemplateResult memory yieldResult = TemplateResult(
            params.yieldTemplateId,
            yield,
            yieldProxy
        );
        
        // 5. Configure Vault templates (cross-contract call)
        IVault(vault).configureModules(token, fund, yield);

        // 6. Emit event with project name
        emit ProjectCreated(vaultResult, tokenResult, fundResult, yieldResult, msg.sender);
    }

    // ============ Query Methods ============
    /**
     * @notice Get addresses of all registry contracts
     * @return vaultRegistry Vault template registry address
     * @return tokenRegistry Token template registry address
     * @return fundRegistry Fund template registry address
     * @return yieldRegistry Yield template registry address
     */
    function getRegistries() external view override returns (
        address,
        address,
        address,
        address
    ) {
        return (address(vaultRegistry), address(tokenRegistry), address(fundRegistry), address(yieldRegistry));
    }

}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../../interfaces/templates/IVault.sol";
import "../../interfaces/templates/ICrowdsale.sol";
import "../../interfaces/templates/IAccumulatedYield.sol";
import "../../interfaces/templates/IToken.sol";
import "../../interfaces/core/IValidatorRegistry.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title CoreVault
 * @dev Core vault template implementation, providing fundamental storage and permission management
 * @notice This contract does not contain specific business logic, business functions are implemented by other modules
 */
contract CoreVault is
    IVault,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable
{
    // ============ Access Role ============
    // Role identifier for manager role
    bytes32 public constant MANAGER_ROLE=keccak256("MANAGER_ROLE");
    // Role identifier for TokenTransfer role
    bytes32 public constant TOKEN_TRANSFER_ROLE = keccak256("TOKEN_TRANSFER_ROLE");

    // ============ State Variables ============
    bool public whitelistEnabled;
    mapping(address => bool) public isWhitelisted;
    // Validator registry address
    address public validatorRegistry;
    
    // Cross-contract addresses
    address public yield;
    address public vaultToken;
    address public funding;

    // Initialization state
    bool private _initialized;
    
    
    // ============ Modifiers ============
    
    modifier onlyManager() {
        require(hasRole(MANAGER_ROLE, msg.sender), "CoreVault: only manager");
        _;
    }
    
    modifier onlyFunding() {
        require(msg.sender == funding, "CoreVault: only funding");
        _;
    }

    
    modifier whenWhitelisted(address user) {
        if (whitelistEnabled) {
            require(hasRole(TOKEN_TRANSFER_ROLE, user), "CoreVault: not whitelisted");
        }
        _;
    }
    
    modifier onlyInitialized() {
        require(_initialized, "CoreVault: not initialized");
        _;
    }
    
    // ============ Constructor ============
    
     /**
     * @dev  Constructor function to disable initializers
     */
    constructor() {
        _disableInitializers();
    }
    
    // ============ Initialization Function ============
    /**
     * @dev Unified initialization interface
     * @param _initData Encoded initialization data
     */
    function initiate(bytes memory _initData) external initializer {
        require(_initialized == false, "CoreVault: already initialized");
        // decode init data
        (address _manager, address _validator, bool _whitelistEnabled, address[] memory _initialWhitelist) =
        abi.decode(_initData, (address, address, bool, address[]));
        _initVault(_manager, _validator, _whitelistEnabled, _initialWhitelist);
    }
    
    // ============ IVault Interface Implementation ============
    /**
 * @dev Get validator address from validator registry
 * @return Validator address
 */
function getValidator() external view returns (address) {
    return IValidatorRegistry(validatorRegistry).getValidator();
}

// ============ Manager Management Interface ============
/**
 * @dev Set a new manager address
 * @param newManager The new manager address
 */
function setManager(address newManager) external onlyManager {
    require(newManager != address(0) && newManager!=msg.sender, "CoreVault: invalid manager address");
    _grantRole(MANAGER_ROLE, newManager);
    _revokeRole(MANAGER_ROLE, msg.sender);
    _transferOwnership(newManager);
    emit ManagerChanged(msg.sender, newManager);
}
    
    /**
     * @dev Pause token
     */
    function pauseToken() external override onlyInitialized onlyManager whenNotPaused {
        require(vaultToken != address(0), "CoreVault: token not set");
        IToken(vaultToken).pause();
        emit TokenPaused();
    }
    
    /**
     * @dev Unpause token
     */
    function unpauseToken() external override onlyInitialized onlyManager whenNotPaused {
        require(vaultToken != address(0), "CoreVault: token not set");
        IToken(vaultToken).unpause();
        emit TokenUnpaused();
    }
    
    /**
     * @dev Check if token is paused
     * @return Whether token is paused
     */
    function isTokenPaused() external view override returns (bool) {
        if (vaultToken == address(0)) {
            return false;
        }
        return IToken(vaultToken).paused();
    }
    
    /**
     * @dev Mint tokens through vault, Only callable by the funding module
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mintToken(address to, uint256 amount) external override onlyInitialized onlyFunding whenWhitelisted(to) whenNotPaused {
        require(vaultToken != address(0), "CoreVault: token not set");
        IToken(vaultToken).mint(to, amount);
    }
    
    /**
     * @dev Burn tokens through vault, Only callable by the funding module
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burnToken(address from, uint256 amount) external override onlyInitialized onlyFunding whenWhitelisted(from) whenNotPaused{
        require(vaultToken != address(0), "CoreVault: token not set");
        IToken(vaultToken).burnFrom(from, amount);
    }
    
    /**
     * @dev Hook called on token transfer, Only callable by the token module
     * @param from From address
     * @param to To address
     * @param amount Transfer amount
     */
    function onTokenTransfer(address from, address to, uint256 amount) external override onlyInitialized whenWhitelisted(from) whenWhitelisted(to) whenNotPaused {
        require(msg.sender == vaultToken, "CoreVault: only token can call");
        if (yield != address(0) && from != address(0) && to != address(0)) {
            IAccumulatedYield(yield).updateUserPoolsOnTransfer(from, to, amount);
        }
    }
    
    // ============ Vault Token Management ============
    function configureModules(address _vaultToken, address _funding, address _yield) external override onlyInitialized {
        _setVaultToken(_vaultToken);
        _setFundingModule(_funding);
        _setDividendModule(_yield);
    }
    
    // Internal methods
    function _setVaultToken(address _vaultToken) internal {
        require(vaultToken == address(0), "CoreVault: token already set");
        require(_vaultToken != address(0), "CoreVault: invalid token address");
        vaultToken = _vaultToken;
    }
    
    /**
     * @dev Set funding module address (can only be set once)
     * @param _funding Funding module address
     */
    function _setFundingModule(address _funding) internal {
        require(funding == address(0), "CoreVault: funding already set");
        require(_funding != address(0), "CoreVault: invalid funding address");
        funding = _funding;
    }
    
    /**
     * @dev Set dividend module address (can only be set once)
     * @param _dividendModule Dividend module address
     */
    function _setDividendModule(address _dividendModule) internal {
        require(yield == address(0), "CoreVault: dividend module already set");
        yield = _dividendModule;
    }
    
    // ============ Internal Functions ============

    /**
     * @dev Initialize vault (for Clones pattern)
     * @param _manager Manager address
     * @param _validatorRegistry Validator address
     * @param _whitelistEnabled Whether to enable whitelist
     * @param _initialWhitelist Initial whitelist addresses
     */
    function _initVault(
        address _manager,
        address _validatorRegistry,
        bool _whitelistEnabled,
        address[] memory _initialWhitelist
    ) internal {
        require(_manager != address(0), "CoreVault: invalid manager");
        require(_validatorRegistry != address(0), "CoreVault: invalid validator");
        // Check if validator implements IValidatorRegistry interface
        try IValidatorRegistry(_validatorRegistry).getValidator() returns (address) {
        } catch {
            revert("CoreVault: validator does not implement IValidatorRegistry interface");
        }

        __Ownable_init(_manager);
        __ReentrancyGuard_init();
        __Pausable_init();
        validatorRegistry = _validatorRegistry;
        whitelistEnabled = _whitelistEnabled;



        _grantRole(MANAGER_ROLE, _manager);
        _setRoleAdmin(TOKEN_TRANSFER_ROLE, MANAGER_ROLE);
        if (whitelistEnabled) {
            for (uint256 i = 0; i < _initialWhitelist.length; i++) {
                if (_initialWhitelist[i] != address(0)) {
                    _grantRole(TOKEN_TRANSFER_ROLE, _initialWhitelist[i]);
                }
            }
        }
        _initialized = true;
    }

     /**
     * @dev Pause 
     */
    function pause() external onlyInitialized onlyManager {
        _pause();
    }
    
    /**
     * @dev Resume
     */
    function unpause() external onlyInitialized onlyManager  {
        _unpause();
    }
    
}
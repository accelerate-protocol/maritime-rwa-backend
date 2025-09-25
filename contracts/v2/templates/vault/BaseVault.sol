// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../../interfaces/templates/IVault.sol";
import "../../interfaces/templates/ICrowdsale.sol";
import "../../interfaces/templates/IAccumulatedYield.sol";
import "../../interfaces/templates/IToken.sol";
import "../../interfaces/core/IValidatorRegistry.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title Vault
 * @dev vault abstract, providing fundamental storage and permission management
 * @notice This contract does not contain specific business logic, business functions are implemented by other modules
 */
abstract contract BaseVault is
    IVault,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable
{
    // ============ Access Role ============
    // Role identifier for manager role
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    // Role identifier for TokenTransfer role
    bytes32 public constant TOKEN_TRANSFER_ROLE =
        keccak256("TOKEN_TRANSFER_ROLE");

    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");

    // ============ State Variables ============
    bool public whitelistEnabled;

    // Validator registry address
    address public validatorRegistry;

    // Cross-contract addresses
    address public vaultToken;
    address public funding;
    address public yield;

    // Initialization state
    bool public initialized;

    // ============ Modifiers ============

    modifier whenWhitelisted(address user) {
        if (whitelistEnabled) {
            require(
                hasRole(TOKEN_TRANSFER_ROLE, user),
                "Vault: not whitelisted"
            );
        }
        _;
    }

    modifier onlyInitialized() {
        require(initialized, "Vault: not initialized");
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
    function initiate(bytes memory _initData) external virtual initializer {
        // decode init data
        (
            address _manager,
            address _validator,
            bool _whitelistEnabled,
            address[] memory _initialWhitelist
        ) = abi.decode(_initData, (address, address, bool, address[]));
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

    /**
     * @dev Pause token
     */
    function pauseToken()
        external
        virtual
        override
        onlyInitialized
        onlyRole(MANAGER_ROLE)
        whenNotPaused
    {
        require(vaultToken != address(0), "Vault: token not set");
        IToken(vaultToken).pause();
        emit TokenPaused();
    }

    /**
     * @dev Unpause token
     */
    function unpauseToken()
        external
        virtual
        override
        onlyInitialized
        onlyRole(MANAGER_ROLE)
        whenNotPaused
    {
        require(vaultToken != address(0), "Vault: token not set");
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
    function mintToken(
        address to,
        uint256 amount
    )
        external
        virtual
        override
        onlyInitialized
        onlyRole(MINT_ROLE)
        whenWhitelisted(to)
        whenNotPaused
    {
        require(vaultToken != address(0), "Vault: token not set");
        IToken(vaultToken).mint(to, amount);
    }

    /**
     * @dev Burn tokens through vault, Only callable by the funding module
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burnToken(
        address from,
        uint256 amount
    )
        external
        virtual
        override
        onlyInitialized
        onlyRole(BURN_ROLE)
        whenWhitelisted(from)
        whenNotPaused
    {
        require(vaultToken != address(0), "Vault: token not set");
        IToken(vaultToken).burnFrom(from, amount);
    }

    /**
     * @dev Hook called on token transfer, Only callable by the token module
     * @param from From address
     * @param to To address
     * @param amount Transfer amount
     */
    function onTokenTransfer(
        address from,
        address to,
        uint256 amount
    )
        external
        virtual
        override
        onlyInitialized
        whenWhitelisted(from)
        whenWhitelisted(to)
        whenNotPaused
    {
        require(msg.sender == vaultToken, "Vault: only token can call");
        // impl by child contract
    }

    // ============ Vault Token Management ============
    function configureModules(
        address _vaultToken,
        address _funding,
        address _yield
    ) external virtual override onlyInitialized {
        _setVaultToken(_vaultToken);
        _setFundingModule(_funding);
        _setYieldModule(_yield);
    }

    // Internal methods
    function _setVaultToken(address _vaultToken) internal virtual {
        require(vaultToken == address(0), "Vault: token already set");
        require(_vaultToken != address(0), "Vault: invalid token address");
        vaultToken = _vaultToken;
    }

    /**
     * @dev Set funding module address (can only be set once)
     * @param _funding Funding module address
     */
    function _setFundingModule(address _funding) internal virtual {
        require(funding == address(0), "Vault: funding already set");
        require(_funding != address(0), "Vault: invalid funding address");
        funding = _funding;
    }

    /**
     * @dev Set dividend module address (can only be set once)
     * @param _yieldModule Dividend module address
     */
    function _setYieldModule(address _yieldModule) internal virtual {
        require(yield == address(0), "Vault: dividend module already set");
        yield = _yieldModule;
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
    ) internal virtual {
        require(_manager != address(0), "Vault: invalid manager");
        require(_validatorRegistry != address(0), "Vault: invalid validator");
        // Check if validator implements IValidatorRegistry interface
        try IValidatorRegistry(_validatorRegistry).getValidator() returns (
            address
        ) {} catch {
            revert(
                "Vault: validator does not implement IValidatorRegistry interface"
            );
        }

        __Ownable_init(_manager);
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();

        validatorRegistry = _validatorRegistry;
        whitelistEnabled = _whitelistEnabled;

        _grantRole(DEFAULT_ADMIN_ROLE, _manager);
        _grantRole(MANAGER_ROLE, _manager);
        _setRoleAdmin(TOKEN_TRANSFER_ROLE, MANAGER_ROLE);
        // set Mint/Burn role admin to self , avoid mint/burn role granted by default admin
        _setRoleAdmin(MINT_ROLE, MINT_ROLE);
        _setRoleAdmin(BURN_ROLE, BURN_ROLE);
        if (whitelistEnabled) {
            for (uint256 i = 0; i < _initialWhitelist.length; i++) {
                if (_initialWhitelist[i] != address(0)) {
                    _grantRole(TOKEN_TRANSFER_ROLE, _initialWhitelist[i]);
                }
            }
        }
        initialized = true;
    }

    /**
     * @dev Pause
     */
    function pause() external virtual onlyInitialized onlyRole(PAUSE_ROLE) {
        _pause();
    }

    /**
     * @dev Resume
     */
    function unpause() external virtual onlyInitialized onlyRole(PAUSE_ROLE) {
        _unpause();
    }
}

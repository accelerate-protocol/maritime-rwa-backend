// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../../interfaces/IVault.sol";
import "../../interfaces/IToken.sol";
import "../../interfaces/IAccumulatedYield.sol";
import "../../interfaces/ICrowdsale.sol";


/**
 * @title BasicVault
 * @dev Basic vault template implementation, providing fundamental storage and permission management
 * @notice This contract does not contain specific business logic, business functions are implemented by other modules
 */
contract BasicVault is IVault, OwnableUpgradeable, ReentrancyGuardUpgradeable,PausableUpgradeable {
    // ============ State Variables ============
    
    address public manager;
    bool public  whitelistEnabled;
    mapping(address => bool) public isWhitelisted;
    address public validator;
    bytes public dataHash;
    bytes public signature;
    
    // Cross-contract addresses
    address public yield;
    address public vaultToken;
    address public funding;
    
    
    // ============ Modifiers ============
    
    modifier onlyManager() {
        require(msg.sender == manager, "BasicVault: only manager");
        _;
    }
    
    modifier onlyFunding() {
        require(msg.sender == funding, "BasicVault: only funding");
        _;
    }
    
    modifier onlyVaultToken() {
        require(msg.sender == vaultToken, "BasicVault: only vault token");
        _;
    }
    
    modifier whenWhitelisted(address user) {
        if (whitelistEnabled) {
            require(isWhitelisted[user], "BasicVault: not whitelisted");
        }
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
    function initiate(bytes memory _initData) external initializer{
        // decode init data
        (address _manager, address _validator, bool _whitelistEnabled, address[] memory _initialWhitelist) = 
            abi.decode(_initData, (address, address, bool, address[]));
        
        _initVault(_manager, _validator, _whitelistEnabled, _initialWhitelist);
    }
    
    // ============ IVault Interface Implementation ============
    
    /**
     * @dev Add address to whitelistonlyInitializing
     * @param _addr Address to add
     */
    function addToWhitelist(address _addr) external override onlyInitializing onlyManager whenNotPaused{
        _addToWhitelist(_addr);
    }
    
    /**
     * @dev Remove address from whitelist
     * @param _addr Address to remove
     */
    function removeFromWhitelist(address _addr) external override onlyInitializing onlyManager whenNotPaused{
        require(isWhitelisted[_addr], "BasicVault: not whitelisted");
        
        isWhitelisted[_addr] = false;
        emit WhitelistRemoved(_addr);
    }
    
    /**
     * @dev Enable whitelist
     */
    function enableWhitelist() external override onlyInitializing onlyManager whenNotPaused{
        whitelistEnabled = true;
        emit WhitelistStatusChanged(true);
    }
    
    /**
     * @dev Disable whitelist
     */
    function disableWhitelist() external override onlyInitializing onlyManager whenNotPaused{
        whitelistEnabled = false;
        emit WhitelistStatusChanged(false);
    }
    
    /**
     * @dev Check if whitelist is enabled
     * @return Whether whitelist is enabled
     */
    function isWhiteList() external view override returns (bool) {
        return whitelistEnabled;
    }
    
    /**
     * @dev Verify data (simple implementation, actual applications need more complex verification logic)
     * @return Verification result
     */
    function verify() external pure override returns (bool) {
        // Simple verification logic, actual implementation needs to be based on specific requirements
        return true;
    }
    
    /**
     * @dev Update verification data
     * @param hash Data hash
     * @param _signature Signature data
     */
    function updateVerifyData(bytes memory hash, bytes memory _signature) external override onlyManager whenNotPaused {
        dataHash = hash;
        signature = _signature;
        emit VerifyDataUpdated(hash, _signature);
    }
    
    /**
     * @dev Pause token
     */
    function pauseToken() external override onlyInitializing onlyManager whenNotPaused {
        require(vaultToken != address(0), "BasicVault: token not set");
        IToken(vaultToken).pause();
        emit TokenPaused();
    }
    
    /**
     * @dev Unpause token
     */
    function unpauseToken() external override onlyInitializing whenNotPaused {
        require(msg.sender == manager, "BasicVault: only manager or funding");
        require(vaultToken != address(0), "BasicVault: token not set");
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
    function mintToken(address to, uint256 amount) external override onlyInitializing onlyFunding whenWhitelisted(to) whenNotPaused {
        require(vaultToken != address(0), "BasicVault: token not set");
        IToken(vaultToken).mint(to, amount);
    }
    
    /**
     * @dev Burn tokens through vault, Only callable by the funding module
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burnToken(address from, uint256 amount) external override onlyInitializing onlyFunding whenWhitelisted(from) whenNotPaused{
        require(vaultToken != address(0), "BasicVault: token not set");
        IToken(vaultToken).burnFrom(from, amount);
    }
    
    /**
     * @dev Hook called on token transfer, Only callable by the token module
     * @param from From address
     * @param to To address
     * @param amount Transfer amount
     */
    function onTokenTransfer(address from, address to, uint256 amount) external override onlyInitializing whenWhitelisted(from) whenWhitelisted(to) whenNotPaused {
        require(msg.sender == vaultToken, "BasicVault: only token can call");
        if (yield != address(0) && from != address(0) && to != address(0)) {
            IAccumulatedYield(yield).updateUserPoolsOnTransfer(from, to, amount);
        }
    }
    
    // ============ Vault Token Management ============
    function configureModules(address _vaultToken, address _funding, address _yield) external override onlyInitializing  whenNotPaused{
        _setVaultToken(_vaultToken);
        _setFundingModule(_funding);
        _setDividendModule(_yield);
    }
    
    // 内部方法
    function _setVaultToken(address _vaultToken) internal {
        require(vaultToken == address(0), "BasicVault: token already set");
        require(_vaultToken != address(0), "BasicVault: invalid token address");
        vaultToken = _vaultToken;
    }
    
    /**
     * @dev Set funding module address (can only be set once)
     * @param _funding Funding module address
     */
    function _setFundingModule(address _funding) internal {
        require(funding == address(0), "BasicVault: funding already set");
        require(_funding != address(0), "BasicVault: invalid funding address");
        funding = _funding;
    }
    
    /**
     * @dev Set dividend module address (can only be set once)
     * @param _dividendModule Dividend module address
     */
    function _setDividendModule(address _dividendModule) internal {
        require(yield == address(0), "BasicVault: dividend module already set");
        require(_dividendModule != address(0), "BasicVault: invalid dividend module address");
        yield = _dividendModule;
    }
    
    // ============ Query Functions ============
    
    /**
     * @dev Check if funding is successful by querying the funding module
     * @return Whether funding is successful
     */
    function isFundingSuccessful() external view override returns (bool) {
        require(funding != address(0), "BasicVault: funding module not set");
        return ICrowdsale(funding).isFundingSuccessful();
    }
    
    // ============ Internal Functions ============
    
    /**
     * @dev Internal add to whitelist function
     * @param _addr Address to add
     */
    function _addToWhitelist(address _addr) internal {
        require(_addr != address(0), "BasicVault: invalid address");
        require(!isWhitelisted[_addr], "BasicVault: already whitelisted");
        
        isWhitelisted[_addr] = true;
        
        emit WhitelistAdded(_addr);
    }

    /**
     * @dev Initialize vault (for Clones pattern)
     * @param _manager Manager address
     * @param _validator Validator address
     * @param _whitelistEnabled Whether to enable whitelist
     * @param _initialWhitelist Initial whitelist addresses
     */
    function _initVault(
        address _manager,
        address _validator,
        bool _whitelistEnabled,
        address[] memory _initialWhitelist
    ) internal {
        require(_manager != address(0), "BasicVault: invalid manager");
        require(_validator != address(0), "BasicVault: invalid validator");
        if (_whitelistEnabled) {
            for (uint256 i = 0; i < _initialWhitelist.length; i++) {
                require(_initialWhitelist[i] != address(0), "BasicVault: whitelist address cannot be zero");
            }
        }

        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        manager = _manager;
        validator = _validator;
        whitelistEnabled = _whitelistEnabled;
        
        // Add initial whitelist
        for (uint256 i = 0; i < _initialWhitelist.length; i++) {
            _addToWhitelist(_initialWhitelist[i]);
        }
        _transferOwnership(_manager);
    }

     /**
     * @dev Pause 
     */
    function pause() external onlyInitializing onlyManager {
        _pause();
    }
    
    /**
     * @dev Resume
     */
    function unpause() external  onlyInitializing onlyManager  {
        _unpause();
    }
    
} 
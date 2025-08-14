// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/IToken.sol";
import "../../interfaces/IVault.sol";

/**
 * @title VaultToken
 * @dev Vault share certificate token, supporting accumulated yield distribution
 * @notice Inherits ERC20 standard, supports pause functionality, integrates with AccumulatedYield
 */
contract VaultToken is ERC20, Pausable, IToken, Ownable {
    // ============ State Variables ============
    address public vault;
    
    // Token metadata
    string private _tokenName;
    string private _tokenSymbol;
    uint8 private _tokenDecimals;
    
    // Initialization state
    bool private _initialized;
    
    // Constants
    uint8 private constant MAX_DECIMALS = 24;
    
    // ============ Modifiers ============
    
    modifier onlyVault() {
        require(msg.sender == vault, "VaultToken: only vault");
        _;
    }

    modifier whenWhitelisted(address user) {
        // Skip whitelist check for mint (from = address(0)) and burn (to = address(0)) operations
        if (user != address(0)) {
            IVault vaultContract = IVault(vault);
            if (vaultContract.whitelistEnabled()) {
                require(vaultContract.isWhitelisted(user), "VaultToken: not whitelisted");
            }
        }
        _;
    }
    
    modifier whenInitialized() {
        require(_initialized, "VaultToken: not initialized");
        _;
    }
    
    modifier whenNotInitialized() {
        require(!_initialized, "VaultToken: already initialized");
        _;
    }
    
    // ============ Constructor ============
    
    constructor() ERC20("", "") {
        // Empty constructor, supports Clones pattern
        // 在 Clones 模式下，owner 将在 initToken 中设置
    }
    
    // ============ Initialization Function ============
    /**
     * @dev Unified initialization interface
     * @param _vault Vault address
     * @param _initData Encoded initialization data
     */
    function initiate(address _vault, bytes memory _initData) external override whenNotInitialized {
        require(_vault != address(0), "VaultToken: invalid vault");
        
        (string memory _name, string memory _symbol, uint8 _decimals) = 
            abi.decode(_initData, (string, string, uint8));
        
        _initToken(_vault, _name, _symbol, _decimals);
    }
    
    // ============ IToken Interface Implementation ============
    
    /**
     * @dev Query token name
     */
    function name() public view virtual override(ERC20, IToken) returns (string memory) {
        return _tokenName;
    }
    
    /**
     * @dev Query token symbol
     */
    function symbol() public view virtual override(ERC20, IToken) returns (string memory) {
        return _tokenSymbol;
    }
    
    /**
     * @dev Query token decimals
     */
    function decimals() public view virtual override(ERC20, IToken) returns (uint8) {
        return _tokenDecimals;
    }
    
    /**
     * @dev Query pause status
     */
    function paused() public view virtual override(Pausable, IToken) returns (bool) {
        return Pausable.paused();
    }
    

    
    // ============ Minting and Burning Interface ============
    
    /**
     * @dev Mint function
     * @param to Recipient address
     * @param amount Mint amount
     */
    function mint(address to, uint256 amount) external override onlyVault whenInitialized {
        require(to != address(0), "VaultToken: mint to zero address");
        require(amount > 0, "VaultToken: mint amount must be positive");
        
        _mint(to, amount);
        
        emit TokenMinted(to, amount);
    }
    
    /**
     * @dev Burn function
     * @param account Address to burn from
     * @param amount Burn amount
     */
    function burnFrom(address account, uint256 amount) external override onlyVault whenInitialized {
        require(account != address(0), "VaultToken: burn from zero address");
        require(amount > 0, "VaultToken: burn amount must be positive");
        require(balanceOf(account) >= amount, "VaultToken: insufficient balance");
        
        _spendAllowance(account, _msgSender(), amount);
        _burn(account, amount);
        
        emit TokenBurned(account, amount);
    }

    // ============ Transfer Interface ============

    /**
     * @dev transfer function, check whitelist for sender and recipient
     * @param to Recipient address
     * @param amount Transfer amount
     */
    function transfer(address to, uint256 amount) public virtual override(ERC20, IERC20) whenWhitelisted(_msgSender()) whenWhitelisted(to) returns (bool) {
        return super.transfer(to, amount);
    }

    /**
     * @dev transferFrom function, check whitelist for sender and recipient
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     */
    function transferFrom(address from, address to, uint256 amount) public virtual override(ERC20, IERC20) whenWhitelisted(from) whenWhitelisted(to) returns (bool) {
        return super.transferFrom(from, to, amount);
    }

    // ============ Pause Control Interface ============
    
    /**
     * @dev Pause token transfers
     */
    function pause() external override onlyVault whenInitialized {
        if (!paused()) {
            _pause();
            emit TokenPaused();
        }
    }
    
    /**
     * @dev Resume token transfers
     */
    function unpause() external override onlyVault whenInitialized whenPaused {
        _unpause();
        
        emit TokenUnpaused();
    }
    

    
    // ============ Internal Functions ============

    /**
     * @dev Check whitelist status for a user
     * @param user User address to check
     */
    function _checkWhitelist(address user) internal view {
        IVault vaultContract = IVault(vault);
        if (vaultContract.whitelistEnabled()) {
            require(vaultContract.isWhitelisted(user), "VaultToken: not whitelisted");
        }
    }
        
    /**
     * @dev Initialize token (for Clones pattern)
     * @param _vault Vault contract address
     * @param _name Token name
     * @param _symbol Token symbol
     * @param _decimals Token decimals
     */
    function _initToken(
        address _vault,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) internal whenNotInitialized {
        require(_vault != address(0), "VaultToken: invalid vault address");
        require(bytes(_name).length > 0, "VaultToken: empty name");
        require(bytes(_symbol).length > 0, "VaultToken: empty symbol");
        require(_decimals <= MAX_DECIMALS, "VaultToken: invalid decimals");
        
        vault = _vault;
        _tokenName = _name;
        _tokenSymbol = _symbol;
        _tokenDecimals = _decimals;
        _initialized = true;
        
        // Transfer ownership to vault
        _transferOwnership(_vault);
        
        // Pause token trading during funding period
        _pause();
    }
    
    /**
     * @dev Pre-transfer checks
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        
        // Check pause status (allow minting and burning during pause)
        if (from != address(0) && to != address(0)) {
            require(!paused(), "VaultToken: token transfer while paused");
        }
        
        // Call vault hook on token transfer
        if (from != address(0) && to != address(0)) {
            // Only call if vault is a valid contract
            if (vault.code.length > 0) {
                IVault(vault).onTokenTransfer(from, to, amount);
            }
        }
    }
    
    // ============ Query Interface ============
    
    /**
     * @dev Query if initialized
     */
    function isInitialized() external view returns (bool) {
        return _initialized;
    }
    

} 
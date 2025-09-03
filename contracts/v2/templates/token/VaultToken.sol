// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../../interfaces/IToken.sol";
import "../../interfaces/IVault.sol";

/**
 * @title VaultToken
 * @dev Vault share certificate token, supporting accumulated yield distribution
 * @notice Inherits ERC20 standard, supports pause functionality, integrates with AccumulatedYield
 */
contract VaultToken is IToken,ERC20Upgradeable, PausableUpgradeable, OwnableUpgradeable {
    // ============ State Variables ============
    address public vault;
    
    // Token metadata
    uint8 private _tokenDecimals;
    
    // Constants
    uint8 private constant MAX_DECIMALS = 24;
    
    // ============ Modifiers ============
    
    modifier onlyVault() {
        require(msg.sender == vault, "VaultToken: only vault");
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
     * @param _vault Vault address
     * @param _initData Encoded initialization data
     */
    function initiate(address _vault, bytes memory _initData) external initializer {
        (string memory _name, string memory _symbol, uint8 _decimals) = abi.decode(_initData, (string, string, uint8));
        _initToken(_vault, _name, _symbol, _decimals);
    }
    
    // ============ IToken Interface Implementation ============
    /**
     * @dev Query token decimals
     */
    function decimals() public view virtual override returns (uint8) {
        return _tokenDecimals;
    }

    // ============ Minting and Burning Interface ============
    /**
     * @dev Mint function
     * @param to Recipient address
     * @param amount Mint amount
     */
    function mint(address to, uint256 amount) external override onlyInitializing onlyVault {
        require(to != address(0), "VaultToken: mint to zero address");
        require(amount > 0, "VaultToken: mint amount must be positive");
        _mint(to, amount);
    }
    
    /**
     * @dev Burn function
     * @param account Address to burn from
     * @param amount Burn amount
     */
    function burnFrom(address account, uint256 amount) external override onlyInitializing onlyVault {
        require(account != address(0), "VaultToken: burn from zero address");
        require(amount > 0, "VaultToken: burn amount must be positive");
        require(balanceOf(account) >= amount, "VaultToken: insufficient balance");
        
        _spendAllowance(account, _msgSender(), amount);
        _burn(account, amount);
    }

    // ============ Transfer Interface ============

    /**
     * @dev transfer function, check whitelist for sender and recipient
     * @param to Recipient address
     * @param amount Transfer amount
     */
    function transfer(address to, uint256 amount) public virtual override(IERC20Upgradeable,ERC20Upgradeable) onlyInitializing whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }

    /**
     * @dev transferFrom function, check whitelist for sender and recipient
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     */
    function transferFrom(address from, address to, uint256 amount) public virtual override(IERC20Upgradeable,ERC20Upgradeable) onlyInitializing whenNotPaused returns (bool) {
        return super.transferFrom(from, to, amount);
    }

     /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view virtual override(PausableUpgradeable,IToken) returns (bool) {
        return PausableUpgradeable.paused();
    }

    // ============ Pause Control Interface ============
    
    /**
     * @dev Pause token transfers
     */
    function pause() external override onlyInitializing onlyVault {
        _pause();
    }
    
    /**
     * @dev Resume token transfers
     */
    function unpause() external override onlyInitializing onlyVault whenPaused {
        _unpause();
    }
    

    
    // ============ Internal Functions ============

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
    ) internal {
        require(_vault != address(0), "VaultToken: invalid vault address");
        require(bytes(_name).length > 0, "VaultToken: empty name");
        require(bytes(_symbol).length > 0, "VaultToken: empty symbol");
        require(_decimals <= MAX_DECIMALS, "VaultToken: invalid decimals");

        __ERC20_init(_name, _symbol);
        __Ownable_init();
        // Transfer ownership to vault
        _transferOwnership(_vault);
        // Pause token trading during funding period
        _pause();
        vault = _vault;
        _tokenDecimals = _decimals;
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
        // Call vault hook on token transfer
        if (from != address(0) && to != address(0)) {
            // Only call if vault is a valid contract
            if (vault.code.length > 0) {
                IVault(vault).onTokenTransfer(from, to, amount);
            }
        }
    }

} 
// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/
*/
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../../interfaces/templates/IToken.sol";
import "../../interfaces/templates/IVault.sol";

/**
 * @title ShareToken
 * @dev Vault share certificate token, supporting accumulated yield distribution
 * @notice Inherits ERC20 standard, supports pause functionality, integrates with Yield
 */
contract ShareToken is IToken,ERC20Upgradeable, PausableUpgradeable, OwnableUpgradeable {
    // ============ State Variables ============
    // Constants
    uint8 private constant MAX_DECIMALS = 24;

    address public vault;
    
    // Token metadata
    uint8 private _tokenDecimals;
    
    // Initialization state
    bool private initialized;
    
    
    // ============ Modifiers ============
    
    modifier onlyVault() {
        require(msg.sender == vault, "ShareToken: only vault");
        _;
    }
    
    modifier onlyInitialized() {
        require(initialized, "ShareToken: not initialized");
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
        require(initialized == false, "ShareToken: already initialized");
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
    function mint(address to, uint256 amount) external override onlyInitialized onlyVault {
        require(amount > 0, "ShareToken: mint amount must be positive");
        _mint(to, amount);
    }
    
    /**
     * @dev Burn function
     * @param account Address to burn from
     * @param amount Burn amount
     */
    function burnFrom(address account, uint256 amount) external override onlyInitialized onlyVault {
        require(amount > 0, "ShareToken: burn amount must be positive");
        
        _spendAllowance(account, _msgSender(), amount);
        _burn(account, amount);
    }

    // ============ Transfer Interface ============

    /**
     * @dev transfer function, check whitelist for sender and recipient
     * @param to Recipient address
     * @param amount Transfer amount
     */
    function transfer(address to, uint256 amount) public virtual override(IERC20,ERC20Upgradeable) onlyInitialized whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }

    /**
     * @dev transferFrom function, check whitelist for sender and recipient
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     */
    function transferFrom(address from, address to, uint256 amount) public virtual override(IERC20,ERC20Upgradeable) onlyInitialized whenNotPaused returns (bool) {
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
    function pause() external override onlyInitialized onlyVault {
        _pause();
    }
    
    /**
     * @dev Resume token transfers
     */
    function unpause() external override onlyInitialized onlyVault {
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
        require(_vault != address(0), "ShareToken: invalid vault address");
        require(bytes(_name).length > 0, "ShareToken: empty name");
        require(bytes(_symbol).length > 0, "ShareToken: empty symbol");
        require(_decimals <= MAX_DECIMALS, "ShareToken: invalid decimals");

        __ERC20_init(_name, _symbol);
        __Ownable_init(_vault);
        __Pausable_init();

        // Pause token trading during funding period
        _pause();
        vault = _vault;
        _tokenDecimals = _decimals;
        initialized = true;
    }
    

    function _update(address from, address to, uint256 value) internal virtual override {   
        // Call vault hook on token transfer
        // This condition ensures the logic only runs for transfers between two valid addresses
        if (from != address(0) && to != address(0)) {
            // Only call if vault is a valid contract
            if (vault.code.length > 0) {
                IVault(vault).onTokenTransfer(from, to, value);
            }
        }
        super._update(from, to, value);
    }

}
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
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../../interfaces/templates/IAccumulatedYield.sol";
import "../../interfaces/templates/IVault.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title AccumulatedYield
 * @dev Accumulated yield template implementation, providing yield distribution based on token holdings
 * @notice Supports accumulated yield and real-time claiming, similar to MasterChef design
 */
contract AccumulatedYield is
    IAccumulatedYield,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    OwnableUpgradeable,
    AccessControlUpgradeable
{

    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============ State Variables ============
    GlobalPoolInfo public globalPool;
    mapping(address => UserInfo) public users;
    address public vault;
    address public dividendTreasury;
    // Add nonce for replay protection
    uint256 public dividendNonce;
    
    // Initialization state
    bool private initialized;
    bool public settlementSign;
    uint256 public settlePrice;
    uint8 public constant settleDecimal=8;

    modifier onlyNotSettled() {
        require(!settlementSign, "AccumulatedYield: already settled");
        _;
    }

    // ============ Modifiers ============
    modifier onlyDividendTreasury() {
        require(msg.sender == dividendTreasury, "AccumulatedYield: only dividend treasury");
        _;
    }
    
    modifier onlyInitialized() {
        require(initialized, "AccumulatedYield: not initialized");
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
     * @param _vaultToken Vault token address
     * @param _initData Encoded initialization data (contains token and original initData)
     */
    function initiate(address _vault, address _vaultToken, bytes memory _initData) external initializer override {
        require(initialized == false, "AccumulatedYield: already initialized");
        (address rewardToken, address rewardManager, address dividendTreasuryAddr) = abi.decode(_initData, (address, address, address));
        _initGlobalPool(_vault, rewardManager, dividendTreasuryAddr, _vaultToken, rewardToken);
    }
    
    // ============ User Operations ============
    /**
     * @dev User claim rewards
     */
    function claimReward() external override onlyInitialized nonReentrant whenNotPaused {
        // First update user pool information
        _updateUserPool(msg.sender);
        
        UserInfo storage user = users[msg.sender];
        uint256 currentBalance = IERC20(globalPool.shareToken).balanceOf(msg.sender);
        uint256 pending = _calculatePendingRewardAt(msg.sender, currentBalance);
        
        require(pending > 0, "AccumulatedYield: no pending reward");
        
        // Core calculation formula: reward calculation phase
        // 3: Update claimed amount
        user.totalClaimed += pending;
        user.lastClaimTime = block.timestamp;
        
        // When a user claims, the contract transfers the user's share of the rewardToken to the user.
        IERC20(globalPool.rewardToken).safeTransfer(msg.sender, pending);
        
        emit RewardClaimed(msg.sender, pending, block.timestamp);
    }
    
    // ============ Yield Distribution ============
    
    /**
     * @dev Distribute dividend to global pool, only dividend treasury can call 
     * @param dividendAmount Distribution amount
     * @param signature Dividend signature
     */
    function distributeDividend(
        uint256 dividendAmount,
        bytes memory signature
    ) external override onlyInitialized onlyDividendTreasury nonReentrant whenNotPaused onlyNotSettled {
        require(dividendAmount > 0, "AccumulatedYield: invalid dividend amount");
        
        // Verify signature
        _verifySignature(dividendAmount, signature);
        
        // Increment nonce to prevent replay
        dividendNonce++;
        
        // Transfer dividend from manager to this contract
        IERC20(globalPool.rewardToken).safeTransferFrom(msg.sender, address(this), dividendAmount);
        
        // Update global pool
        globalPool.totalDividend += dividendAmount;
        globalPool.lastDividendTime = block.timestamp;
        
        // Update total accumulated shares: shareTotalSupply * dividendAmount
        uint256 totalSupply = IERC20(globalPool.shareToken).totalSupply();
        
        globalPool.totalAccumulatedShares += totalSupply * dividendAmount;
        
        // Get validator for event emission
        address validator = IVault(vault).getValidator();
        
        emit DividendDistributed(dividendAmount, block.timestamp, validator, signature);
    }

    /**
     * @dev Settle vault
     * @param settleAmount Settle amount
     * 
     */
    function settle(uint256 settleAmount,bytes memory signature) external onlyInitialized onlyDividendTreasury nonReentrant whenNotPaused onlyNotSettled {
        require(settleAmount > 0, "AccumulatedYield: invalid settle amount");
        _verifySettleSignature(settleAmount, signature);
        
        // Transfer settle amount from manager to this contract
        IERC20(globalPool.rewardToken).safeTransferFrom(msg.sender, address(this), settleAmount);
        uint256 totalSupply = IERC20(globalPool.shareToken).totalSupply();
        settlementSign = true;
        settlePrice = settleAmount * 10 ** settleDecimal / totalSupply;

        emit Settled(settleAmount,settlePrice,block.timestamp);
    }

    /**
     * @dev Withdraw vault
     * @param shareAmount Withdraw amount
     */
    function withdraw(uint256 shareAmount) external onlyInitialized nonReentrant whenNotPaused  { 
        require(settlementSign, "AccumulatedYield: not settled");
        require(shareAmount > 0, "AccumulatedYield: invalid redeem amount");
        require(shareAmount <= IERC20(globalPool.shareToken).balanceOf(msg.sender), "AccumulatedYield: insufficient balance");

        IVault(vault).burnToken(msg.sender, shareAmount);

        uint256 withdrawAmount = shareAmount * settlePrice / (10 ** settleDecimal);
        IERC20(globalPool.rewardToken).safeTransfer(msg.sender, withdrawAmount);
        emit Withdraw(msg.sender,shareAmount,withdrawAmount,block.timestamp);

    }

    // ============ Token Transfer Related ============
    
    /**
     * @dev Update user pools on token transfer (core functionality)
     * @param from Transfer from address
     * @param to Transfer to address
     * @param amount Transfer amount
     */
    function updateUserPoolsOnTransfer(
        address from,
        address to,
        uint256 amount
    ) external override whenNotPaused {
        require(msg.sender == vault, "AccumulatedYield: only vault can call");
        
        if (from != address(0)) {
            _updateUserPool(from);
        }
        
        if (to != address(0)) {
            _updateUserPool(to);
        }
        
        emit ShareTokenTransferred(from, to, amount, block.timestamp);
    }
    
    // ============ Query Interface ============

    /**
     * @dev Query user information
     * @param user User address
     * @return User information structure
     */
    function getUserInfo(address user) external view override returns (UserInfo memory) {
        return users[user];
    }
    
    /**
     * @dev Query user's pending rewards
     * @param user User address
     * @return Pending reward amount
     */
    function pendingReward(address user) external view override returns (uint256) {
        if (globalPool.shareToken == address(0)) {
            return 0;
        }
        
        uint256 currentBalance = IERC20(globalPool.shareToken).balanceOf(user);
        return _calculatePendingRewardAt(user, currentBalance);
    }
    
    /**
     * @dev Query global pool total dividend amount
     * @return Total dividend amount
     */
    function totalDividend() external view override returns (uint256) {
        return globalPool.totalDividend;
    }
    
    /**
     * @dev Query global pool total accumulated shares
     * @return Total accumulated shares
     */
    function totalAccumulatedShares() external view override returns (uint256) {
        return globalPool.totalAccumulatedShares;
    }
    
    /**
     * @dev Get current dividend nonce
     * @return Current dividend nonce
     */
    function getDividendNonce() external view override returns (uint256) {
        return dividendNonce;
    }
    
    // ============ Internal Functions ============
    /**
     * @dev Initialize global yield pool
     * @param _vault Vault contract address
     * @param _manager Manager address
     * @param _dividendTreasury Dividend treasury address
     * @param shareToken Share token address
     * @param rewardToken Reward token address
     */
    function _initGlobalPool(
        address _vault,
        address _manager,
        address _dividendTreasury,
        address shareToken,
        address rewardToken
    ) internal {
        // Can only initialize once, cannot re-initialize
        require(globalPool.shareToken == address(0), "AccumulatedYield: already initialized");
        require(_vault != address(0), "AccumulatedYield: invalid vault");
        require(_manager != address(0), "AccumulatedYield: invalid manager");
        require(_dividendTreasury != address(0), "AccumulatedYield: invalid dividend treasury");
        require(shareToken != address(0), "AccumulatedYield: invalid share token");
        require(rewardToken != address(0), "AccumulatedYield: invalid reward token");

        __Ownable_init(_manager);
        __ReentrancyGuard_init();
        __Pausable_init();

        // Set vault, manager and dividendTreasury
        vault = _vault;
        dividendTreasury = _dividendTreasury;
        
        globalPool = GlobalPoolInfo({
            totalAccumulatedShares: 0,
            lastDividendTime: block.timestamp,
            totalDividend: 0,
            shareToken: shareToken,
            rewardToken: rewardToken
        });

        // Initialize roles
        _grantRole(DEFAULT_ADMIN_ROLE, _manager);
        _grantRole(MANAGER_ROLE, _manager);
        _grantRole(PAUSER_ROLE, _manager);
    
        initialized = true;
        
        emit GlobalPoolInitialized(shareToken, rewardToken, block.timestamp);
    }
    
    /**
     * @dev Update user pool information
     * @param user User address
     */
    function _updateUserPool(address user) internal {
        if (globalPool.shareToken == address(0)) {
            return;
        }
        
        UserInfo storage userInfo = users[user];
        uint256 currentBalance = IERC20(globalPool.shareToken).balanceOf(user);
        
        // Core calculation formula: user operation phase
        // 1: Calculate dividend delta
        uint256 deltaDiv = globalPool.totalDividend - userInfo.lastClaimDividend;
        
        if (deltaDiv > 0) {
            // 2: Update user accumulated shares
            userInfo.accumulatedShares += currentBalance * deltaDiv;
        }
        
        // 3: Update user checkpoint
        userInfo.lastClaimDividend = globalPool.totalDividend;
        
        emit UserPoolUpdated(user, userInfo.accumulatedShares, block.timestamp);
    }
    

    
    /**
     * @dev Calculate user's pending rewards at specified balance
     * @param user User address
     * @param userBalance User balance
     * @return Pending reward amount
     */
    function _calculatePendingRewardAt(address user, uint256 userBalance) internal view returns (uint256) {
        if (globalPool.shareToken == address(0) || globalPool.totalAccumulatedShares == 0) {
            return 0;
        }
        
        UserInfo memory userInfo = users[user];
        
        // Simulate user pool update, calculate latest accumulated shares
        uint256 simulatedAccumulatedShares = userInfo.accumulatedShares;
        uint256 deltaDiv = globalPool.totalDividend - userInfo.lastClaimDividend;
        
        if (deltaDiv > 0) {
            simulatedAccumulatedShares += userBalance * deltaDiv;
        }
        
        if (simulatedAccumulatedShares == 0) {
            return 0;
        }
        
        // Core calculation formula: reward calculation phase with improved precision
        // 1: Calculate user's total reward with higher precision
        uint256 totalReward;
        if (globalPool.totalAccumulatedShares > 0) {
            totalReward = (simulatedAccumulatedShares * globalPool.totalDividend) / globalPool.totalAccumulatedShares;
        } else {
            totalReward = 0;
        }
        
        // 2: Calculate pending reward
        uint256 pending = totalReward > userInfo.totalClaimed ? totalReward - userInfo.totalClaimed : 0;
        
        return pending;
    }

     /**
     * @dev Pause 
     */
    function pause() external onlyInitialized onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Resume 
     */
    function unpause() external onlyInitialized onlyRole(PAUSER_ROLE)  {
        _unpause();
    }

    /**
     * @dev Verify signature for dividend distribution
     * @param dividendAmount Distribution amount
     * @param signature Dividend signature
     */
    function _verifySignature(uint256 dividendAmount, bytes memory signature) internal view {
        // Get validator address from Vault
        address validator = IVault(vault).getValidator();
        require(validator != address(0), "AccumulatedYield: validator not set");
        
        // Verify signature with nonce to prevent replay attacks
        bytes32 payload = keccak256(abi.encodePacked(vault, dividendAmount, dividendNonce));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(payload);
        
        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        require(signer == validator, "AccumulatedYield: invalid signature");
    }

    function _verifySettleSignature(
        uint256 assetAmount,
        bytes memory signature
    ) internal view {
        address validator = IVault(vault).getValidator();
        require(validator != address(0), "FundYield: validator not set");
        bytes32 payload = keccak256(
            abi.encodePacked(vault, assetAmount)
        );
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(payload);
        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        require(signer == validator, "FundYield: invalid signature");
    }




}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../../interfaces/IAccumulatedYield.sol";
import "../../interfaces/IVault.sol";

/**
 * @title AccumulatedYield
 * @dev Accumulated yield template implementation, providing yield distribution based on token holdings
 * @notice Supports accumulated yield and real-time claiming, similar to MasterChef design
 */
contract AccumulatedYield is IAccumulatedYield, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    // ============ State Variables ============
    
    GlobalPoolInfo public globalPool;
    mapping(address => UserInfo) public users;
    
    address public vault;
    address public manager;
    address public dividendTreasury;
    
    // Precision constant
    uint256 private constant PRECISION = 1e18;
    
    // ============ Modifiers ============
    
    modifier onlyManager() {
        require(msg.sender == manager, "AccumulatedYield: only manager");
        _;
    }
    
    modifier onlyActivePool() {
        require(globalPool.isActive, "AccumulatedYield: pool not active");
        _;
    }
    
    modifier whenInitialized() {
        require(globalPool.shareToken != address(0), "AccumulatedYield: not initialized");
        _;
    }
    
    // ============ Constructor ============
    
    /**
     * @dev Constructor
     */
    constructor() {
    }
    
    // ============ Global Pool Management ============
    
    /**
     * @dev Set manager
     * @param _manager New manager address
     */
    function setManager(address _manager) external override onlyOwner {
        require(_manager != address(0), "AccumulatedYield: invalid manager");
        address oldManager = manager;
        manager = _manager;
        
        // If needed, transfer ownership to new manager
        if (owner() == oldManager) {
            _transferOwnership(_manager);
        }
        
        emit ManagerUpdated(oldManager, _manager);
    }
    
    /**
     * @dev Set dividend treasury address
     * @param _dividendTreasury New dividend treasury address
     */
    function setDividendTreasury(address _dividendTreasury) external override onlyManager {
        require(_dividendTreasury != address(0), "AccumulatedYield: invalid dividend treasury");
        address oldTreasury = dividendTreasury;
        dividendTreasury = _dividendTreasury;
        
        emit DividendTreasuryUpdated(oldTreasury, _dividendTreasury);
    }
    
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
        
        // Set vault, manager and dividendTreasury
        vault = _vault;
        manager = _manager;
        dividendTreasury = _dividendTreasury;
        
        // Set owner as manager
        _transferOwnership(_manager);
        
        globalPool = GlobalPoolInfo({
            totalAccumulatedShares: 0,
            lastDividendTime: block.timestamp,
            totalDividend: 0,
            isActive: true,
            shareToken: shareToken,
            rewardToken: rewardToken
        });
        
        emit GlobalPoolInitialized(shareToken, rewardToken, block.timestamp);
    }

    /**
     * @dev Unified initialization interface
     * @param _vault Vault address
     * @param _vaultToken Vault token address
     * @param _initData Encoded initialization data (contains token and original initData)
     */
    function initiate(address _vault, address _vaultToken, bytes memory _initData) external override {
        require(_vault != address(0), "AccumulatedYield: invalid vault");
        
        // decode initData
        (address rewardToken, address rewardManager, address dividendTreasuryAddr) = 
            abi.decode(_initData, (address, address, address));
        
        // init global pool 
        _initGlobalPool(_vault, rewardManager, dividendTreasuryAddr, _vaultToken, rewardToken);
    }
    
    /**
     * @dev Update global pool status
     * @param isActive Whether to activate
     */
    function updateGlobalPoolStatus(
        bool isActive
    ) external override onlyManager whenInitialized {
        globalPool.isActive = isActive;
    }
    
    // ============ User Operations ============
    
    /**
     * @dev User claim rewards
     */
    function claimReward() external override onlyActivePool whenInitialized nonReentrant {
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
        
        // Transfer rewards
        IERC20(globalPool.rewardToken).safeTransfer(msg.sender, pending);
        
        emit RewardClaimed(msg.sender, pending, pending, block.timestamp);
    }
    
    // ============ Yield Distribution ============
    
    /**
     * @dev Distribute dividend to global pool
     * @param dividendAmount Distribution amount
     * @param signature Dividend signature
     */
    function distributeDividend(
        uint256 dividendAmount,
        bytes memory signature
    ) external override onlyManager onlyActivePool whenInitialized nonReentrant {
        require(dividendAmount > 0, "AccumulatedYield: invalid dividend amount");
        
        // Get validator address from Vault
        address validator = IVault(vault).validator();
        require(validator != address(0), "AccumulatedYield: validator not set");
        
        // Verify signature
        bytes32 payload = keccak256(abi.encodePacked(vault, dividendAmount));
        bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(payload);
        
        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        require(signer == validator, "AccumulatedYield: invalid signature");
        
        // Transfer dividend from manager to this contract
        IERC20(globalPool.rewardToken).safeTransferFrom(msg.sender, address(this), dividendAmount);
        
        // Update global pool
        globalPool.totalDividend += dividendAmount;
        globalPool.lastDividendTime = block.timestamp;
        
        // Update total accumulated shares: shareTotalSupply * dividendAmount
        uint256 totalSupply = IERC20(globalPool.shareToken).totalSupply();
        globalPool.totalAccumulatedShares += totalSupply * dividendAmount;
        
        emit DividendDistributed(dividendAmount, block.timestamp, validator, signature);
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
    ) external override {
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
     * @dev Query global pool information
     * @return Global pool information structure
     */
    function getGlobalPoolInfo() external view override returns (GlobalPoolInfo memory) {
        return globalPool;
    }
    
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
     * @dev Query current manager
     * @return Manager address
     */
    function getManager() external view override returns (address) {
        return manager;
    }
    
    /**
     * @dev Query dividend treasury address
     * @return Dividend treasury address
     */
    function getDividendTreasury() external view override returns (address) {
        return dividendTreasury;
    }
    
    /**
     * @dev Calculate user's accumulated shares at specified balance
     * @param user User address
     * @param userBalance Specified user balance
     * @return Accumulated shares
     */
    function calculateAccumulatedShares(address user, uint256 userBalance) external view override returns (uint256) {
        if (globalPool.shareToken == address(0)) {
            return 0;
        }
        
        UserInfo memory userInfo = users[user];
        
        // Calculate dividend delta
        uint256 deltaDiv = globalPool.totalDividend - userInfo.lastClaimDividend;
        
        // Accumulated shares = user's current accumulated shares + specified balance * dividend delta
        uint256 accumulatedShares = userInfo.accumulatedShares + userBalance * deltaDiv;
        
        return accumulatedShares;
    }
    

    
    // ============ Internal Functions ============
    
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
        
        // Core calculation formula: reward calculation phase
        // 1: Calculate user's total reward
        uint256 totalReward = (simulatedAccumulatedShares * globalPool.totalDividend) / globalPool.totalAccumulatedShares;
        
        // 2: Calculate pending reward
        uint256 pending = totalReward > userInfo.totalClaimed ? totalReward - userInfo.totalClaimed : 0;
        
        return pending;
    }
    

} 
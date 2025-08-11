// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../v2/interfaces/IAccumulatedYield.sol";

/**
 * @title MockAccumulatedYield
 * @dev Mock implementation of AccumulatedYield for testing
 */
contract MockAccumulatedYield is IAccumulatedYield, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    // ============ State Variables ============
    
    GlobalPoolInfo public globalPool;
    mapping(address => UserInfo) public users;
    
    address public vault;
    address public manager;
    address public dividendTreasury;
    
    modifier onlyManager() {
        require(msg.sender == manager, "MockAccumulatedYield: only manager");
        _;
    }
    
    modifier onlyActivePool() {
        require(globalPool.isActive, "MockAccumulatedYield: pool not active");
        _;
    }
    
    modifier whenInitialized() {
        require(globalPool.shareToken != address(0), "MockAccumulatedYield: not initialized");
        _;
    }
    
    constructor() {
        // Empty constructor, supports Clones pattern
    }
    
    // Initialization function (for Clones pattern)
    function initGlobalPool(
        address _vault,
        address _manager,
        address _dividendTreasury,
        address shareToken,
        address rewardToken
    ) external {
        require(globalPool.shareToken == address(0), "MockAccumulatedYield: already initialized");
        
        vault = _vault;
        manager = _manager;
        dividendTreasury = _dividendTreasury;
        
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
    
    // Mock implementation, only keeps interface, no specific business logic
    function setManager(address _manager) external {
        address oldManager = manager;
        manager = _manager;
        emit ManagerUpdated(oldManager, _manager);
    }
    
    function setDividendTreasury(address _dividendTreasury) external {
        address oldTreasury = dividendTreasury;
        dividendTreasury = _dividendTreasury;
        emit DividendTreasuryUpdated(oldTreasury, _dividendTreasury);
    }
    
    function updateGlobalPoolStatus(bool isActive) external {
        globalPool.isActive = isActive;
    }
    
    function claimReward() external {
        // Mock implementation, no specific business logic
        emit RewardClaimed(msg.sender, 0, 0, block.timestamp);
    }
    
    function distributeDividend(uint256 dividendAmount, bytes memory signature) external {
        // Mock implementation, no specific business logic
        emit DividendDistributed(dividendAmount, block.timestamp, msg.sender, signature);
    }
    
    function updateUserPoolsOnTransfer(address from, address to, uint256 amount) external {
        // Mock implementation, no specific business logic
    }
    
    function getUserInfo(address user) external view returns (UserInfo memory) {
        return users[user];
    }
    
    function getGlobalPoolInfo() external view returns (GlobalPoolInfo memory) {
        return globalPool;
    }
    
    function pendingReward(address user) external view returns (uint256) {
        // Mock implementation, returns 0
        return 0;
    }
    
    function totalDividend() external view returns (uint256) {
        return globalPool.totalDividend;
    }
    
    function totalAccumulatedShares() external view returns (uint256) {
        return globalPool.totalAccumulatedShares;
    }
    
    function getManager() external view returns (address) {
        return manager;
    }
    
    function getDividendTreasury() external view returns (address) {
        return dividendTreasury;
    }
    
    function calculateAccumulatedShares(address user, uint256 userBalance) external view returns (uint256) {
        // Mock implementation, returns 0
        return 0;
    }
} 
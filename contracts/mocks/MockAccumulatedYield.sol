// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../v2/interfaces/IAccumulatedYield.sol";

contract MockAccumulatedYield is IAccumulatedYield, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    // 基本字段
    GlobalPoolInfo public globalPool;
    mapping(address => UserInfo) public users;
    
    address public vault;
    address public manager;
    address public dividendReceiver;
    
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
        // 构造函数为空，支持Clones模式
    }
    
    // 初始化函数（用于Clones模式）
    function initGlobalPool(
        address _vault,
        address _manager,
        address _dividendReceiver,
        address shareToken,
        address rewardToken
    ) external {
        require(globalPool.shareToken == address(0), "MockAccumulatedYield: already initialized");
        
        vault = _vault;
        manager = _manager;
        dividendReceiver = _dividendReceiver;
        
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
    
    // Mock实现，只保留接口，不包含具体业务逻辑
    function setManager(address _manager) external {
        address oldManager = manager;
        manager = _manager;
        emit ManagerUpdated(oldManager, _manager);
    }
    
    function setDividendReceiver(address _dividendReceiver) external {
        address oldReceiver = dividendReceiver;
        dividendReceiver = _dividendReceiver;
        emit DividendReceiverUpdated(oldReceiver, _dividendReceiver);
    }
    
    function updateGlobalPoolStatus(bool isActive) external {
        globalPool.isActive = isActive;
    }
    
    function claimReward() external {
        // Mock实现，不包含具体业务逻辑
        emit RewardClaimed(msg.sender, 0, 0, block.timestamp);
    }
    
    function distributeDividend(uint256 dividendAmount, bytes memory signature) external {
        // Mock实现，不包含具体业务逻辑
        emit DividendDistributed(dividendAmount, block.timestamp, msg.sender, bytes32(0));
    }
    
    function updateUserPoolsOnTransfer(address from, address to, uint256 amount) external {
        // Mock实现，不包含具体业务逻辑
    }
    
    function getUserInfo(address user) external view returns (UserInfo memory) {
        return users[user];
    }
    
    function getGlobalPoolInfo() external view returns (GlobalPoolInfo memory) {
        return globalPool;
    }
    
    function pendingReward(address user) external view returns (uint256) {
        // Mock实现，返回0
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
    
    function getDividendReceiver() external view returns (address) {
        return dividendReceiver;
    }
    
    function calculateAccumulatedShares(address user, uint256 userBalance) external view returns (uint256) {
        // Mock实现，返回0
        return 0;
    }
} 
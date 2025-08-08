// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../../interfaces/IAccumulatedYield.sol";
import "../../interfaces/IVault.sol";

/**
 * @title AccumulatedYield
 * @dev 累积收益模版实现，提供基于持币量的收益分配功能
 * @notice 支持累积收益和实时领取，类似于MasterChef设计
 */
contract AccumulatedYield is IAccumulatedYield, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    // ============ 状态变量 ============
    
    GlobalPoolInfo public globalPool;
    mapping(address => UserInfo) public users;
    
    address public vault;
    address public manager;
    address public dividendTreasury;
    
    // 精度常量
    uint256 private constant PRECISION = 1e18;
    
    // ============ 修饰符 ============
    
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
    
    // ============ 构造函数 ============
    
    /**
     * @dev 构造函数 
     */
    constructor() {
        // onwer 默认为deployer
        _transferOwnership(msg.sender);
    }
    
    // ============ 全局池子管理 ============
    
    /**
     * @dev 设置管理员
     * @param _manager 新的管理员地址
     */
    function setManager(address _manager) external override onlyOwner {
        require(_manager != address(0), "AccumulatedYield: invalid manager");
        address oldManager = manager;
        manager = _manager;
        
        // 如果需要，可以转移所有权给新manager
        if (owner() == oldManager) {
            _transferOwnership(_manager);
        }
        
        emit ManagerUpdated(oldManager, _manager);
    }
    
    /**
     * @dev 设置派息接收地址
     * @param _dividendTreasury 新的派息接收地址
     */
    function setDividendTreasury(address _dividendTreasury) external override onlyManager {
        require(_dividendTreasury != address(0), "AccumulatedYield: invalid dividend treasury");
        address oldTreasury = dividendTreasury;
        dividendTreasury = _dividendTreasury;
        
        emit DividendTreasuryUpdated(oldTreasury, _dividendTreasury);
    }
    
    /**
     * @dev 初始化全局收益池
     * @param _vault Vault合约地址
     * @param _manager 管理员地址
     * @param _dividendTreasury 派息资金的接收地址
     * @param shareToken 份额凭证代币地址
     * @param rewardToken 收益代币地址
     */
    function initGlobalPool(
        address _vault,
        address _manager,
        address _dividendTreasury,
        address shareToken,
        address rewardToken
    ) external override {
        // 默认只初始化一次，不能重新初始化
        require(globalPool.shareToken == address(0), "AccumulatedYield: already initialized");
        require(_vault != address(0), "AccumulatedYield: invalid vault");
        require(_manager != address(0), "AccumulatedYield: invalid manager");
        require(_dividendTreasury != address(0), "AccumulatedYield: invalid dividend treasury");
        require(shareToken != address(0), "AccumulatedYield: invalid share token");
        require(rewardToken != address(0), "AccumulatedYield: invalid reward token");
        
        // 设置vault和manager和dividendTreasury
        vault = _vault;
        manager = _manager;
        dividendTreasury = _dividendTreasury;
        
        // 设置owner为manager
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
     * @dev 更新全局池子状态
     * @param isActive 是否激活
     */
    function updateGlobalPoolStatus(
        bool isActive
    ) external override onlyManager whenInitialized {
        globalPool.isActive = isActive;
    }
    
    // ============ 用户操作 ============
    
    /**
     * @dev 用户领取收益
     */
    function claimReward() external override onlyActivePool whenInitialized nonReentrant {
        // 先更新用户池信息
        _updateUserPool(msg.sender);
        
        UserInfo storage user = users[msg.sender];
        uint256 currentBalance = IERC20(globalPool.shareToken).balanceOf(msg.sender);
        uint256 pending = _calculatePendingRewardAt(msg.sender, currentBalance);
        
        require(pending > 0, "AccumulatedYield: no pending reward");
        
        // 核心计算公式：收益计算阶段
        // 3: 更新已领取金额
        user.totalClaimed += pending;
        user.lastClaimTime = block.timestamp;
        
        // 转移收益
        IERC20(globalPool.rewardToken).safeTransfer(msg.sender, pending);
        
        emit RewardClaimed(msg.sender, pending, pending, block.timestamp);
    }
    
    // ============ 收益分配 ============
    
    /**
     * @dev 向全局池子派息
     * @param dividendAmount 分配数量
     * @param signature 派息签名
     */
    function distributeDividend(
        uint256 dividendAmount,
        bytes memory signature
    ) external override onlyManager onlyActivePool whenInitialized nonReentrant {
        require(dividendAmount > 0, "AccumulatedYield: invalid dividend amount");
        
        // 从Vault获取validator地址
        address validator = IVault(vault).validator();
        require(validator != address(0), "AccumulatedYield: validator not set");
        
        // verify signature
        bytes32 payload = keccak256(abi.encodePacked(vault, dividendAmount));
        bytes32 ethSignedMessageHash = ECDSA.toEthSignedMessageHash(payload);
        
        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        require(signer == validator, "AccumulatedYield: invalid drds signature");
        
        // 先转入收益代币（防止重入攻击）
        IERC20(globalPool.rewardToken).safeTransferFrom(
            msg.sender,
            address(this),
            dividendAmount
        );
        
        // 获取当前代币总供应量
        uint256 shareTotalSupply = IERC20(globalPool.shareToken).totalSupply();
        require(shareTotalSupply > 0, "AccumulatedYield: no share tokens in circulation");
        
        // 核心计算公式：收益分配阶段
        // 1: 更新池子总派息
        globalPool.totalDividend += dividendAmount;
        
        // 2: 更新池子总累积份额
        globalPool.totalAccumulatedShares += shareTotalSupply * dividendAmount;
        
        // 更新时间戳
        globalPool.lastDividendTime = block.timestamp;
        
        emit DividendDistributed(dividendAmount, block.timestamp, validator, signature);
    }
    
    // ============ 代币转移相关 ============
    
    /**
     * @dev 在代币转移时更新用户池（核心功能）
     * @param from 转出地址
     * @param to 转入地址
     * @param amount 转移数量
     */
    function updateUserPoolsOnTransfer(
        address from,
        address to,
        uint256 amount
    ) external override whenInitialized {
        require(msg.sender == globalPool.shareToken, "AccumulatedYield: only share token");
        
        if (from != address(0)) {
            _updateUserPool(from);
        }
        
        if (to != address(0)) {
            _updateUserPool(to);
        }
        
        emit ShareTokenTransferred(from, to, amount, block.timestamp);
    }
    
    /**
     * @dev 强制更新单个用户的池信息
     * @param user 用户地址
     */
    function updateUserPool(
        address user
    ) external whenInitialized {
        _updateUserPool(user);
    }
    
    /**
     * @dev 批量更新多个用户的池信息
     * @param userList 用户地址数组
     */
    function batchUpdateUserPools(
        address[] calldata userList
    ) external whenInitialized {
        for (uint256 i = 0; i < userList.length; i++) {
            _updateUserPool(userList[i]);
        }
    }
    
    // ============ 查询接口 ============
    
    /**
     * @dev 查询全局池子信息
     * @return 全局池子信息结构体
     */
    function getGlobalPoolInfo() external view override returns (GlobalPoolInfo memory) {
        return globalPool;
    }
    
    /**
     * @dev 查询用户信息
     * @param user 用户地址
     * @return 用户信息结构体
     */
    function getUserInfo(address user) external view override returns (UserInfo memory) {
        return users[user];
    }
    
    /**
     * @dev 查询用户待领取收益
     * @param user 用户地址
     * @return 待领取收益数量
     */
    function pendingReward(address user) external view override returns (uint256) {
        uint256 currentBalance = IERC20(globalPool.shareToken).balanceOf(user);
        return _calculatePendingRewardAt(user, currentBalance);
    }
    

    
    /**
     * @dev 查询全局池子总派息数量
     * @return 总派息数量
     */
    function totalDividend() external view override returns (uint256) {
        return globalPool.totalDividend;
    }
    
    /**
     * @dev 查询全局池子总累积份额
     * @return 总累积份额
     */
    function totalAccumulatedShares() external view override returns (uint256) {
        return globalPool.totalAccumulatedShares;
    }
    
    /**
     * @dev 查询当前管理员
     * @return 管理员地址
     */
    function getManager() external view override returns (address) {
        return manager;
    }
    
    /**
     * @dev 查询派息接收地址
     * @return 派息接收地址
     */
    function getDividendTreasury() external view override returns (address) {
        return dividendTreasury;
    }
    
    /**
     * @dev 计算用户在指定余额下的累计份额
     * @param user 用户地址
     * @param userBalance 指定的用户余额
     * @return 累计份额
     */
    function calculateAccumulatedShares(address user, uint256 userBalance) external view override returns (uint256) {
        if (globalPool.shareToken == address(0)) {
            return 0;
        }
        
        UserInfo memory userInfo = users[user];
        
        // 计算增量派息
        uint256 deltaDiv = globalPool.totalDividend - userInfo.lastClaimDividend;
        
        // 累计份额 = 用户现有累计份额 + 指定余额 * 增量派息
        uint256 accumulatedShares = userInfo.accumulatedShares + userBalance * deltaDiv;
        
        return accumulatedShares;
    }
    

    
    // ============ 内部函数 ============
    
    /**
     * @dev 更新用户池信息
     * @param user 用户地址
     */
    function _updateUserPool(address user) internal {
        if (globalPool.shareToken == address(0)) {
            return;
        }
        
        UserInfo storage userInfo = users[user];
        uint256 currentBalance = IERC20(globalPool.shareToken).balanceOf(user);
        
        // 核心计算公式：用户操作阶段
        // 1: 计算增量派息 
        uint256 deltaDiv = globalPool.totalDividend - userInfo.lastClaimDividend;
        
        if (deltaDiv > 0) {
            // 2: 更新用户累积份额 
            userInfo.accumulatedShares += currentBalance * deltaDiv;
        }
        
        // 3: 更新用户检查点 
        userInfo.lastClaimDividend = globalPool.totalDividend;
        
        emit UserPoolUpdated(user, userInfo.accumulatedShares, block.timestamp);
    }
    

    
    /**
     * @dev 计算用户在指定余额下的待领取收益
     * @param user 用户地址
     * @param userBalance 用户余额
     * @return 待领取收益数量
     */
    function _calculatePendingRewardAt(address user, uint256 userBalance) internal view returns (uint256) {
        if (globalPool.shareToken == address(0) || globalPool.totalAccumulatedShares == 0) {
            return 0;
        }
        
        UserInfo memory userInfo = users[user];
        
        // 模拟用户池更新，计算最新的累积份额
        uint256 simulatedAccumulatedShares = userInfo.accumulatedShares;
        uint256 deltaDiv = globalPool.totalDividend - userInfo.lastClaimDividend;
        
        if (deltaDiv > 0) {
            simulatedAccumulatedShares += userBalance * deltaDiv;
        }
        
        if (simulatedAccumulatedShares == 0) {
            return 0;
        }
        
        // 核心计算公式：收益计算阶段
        // 1: 计算用户应得总收益
        uint256 totalReward = (simulatedAccumulatedShares * globalPool.totalDividend) / globalPool.totalAccumulatedShares;
        
        // 2: 计算待领取收益
        uint256 pending = totalReward > userInfo.totalClaimed ? totalReward - userInfo.totalClaimed : 0;
        
        return pending;
    }
    

} 
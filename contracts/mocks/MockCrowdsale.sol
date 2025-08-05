// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../v2/interfaces/ICrowdsale.sol";

contract MockCrowdsale is ICrowdsale, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // 事件定义
    event Deposit(address indexed user, uint256 amount, uint256 timestamp);
    event Redeem(address indexed user, uint256 amount, uint256 timestamp);
    event FundingWithdrawn(address indexed receiver, uint256 amount);
    event FeeWithdrawn(address indexed receiver, uint256 amount);
    event CrowdsaleFinalized(bool isSuccessful, uint256 totalRaised);
    
    // 基本字段
    address public vault;
    uint256 public startTime;
    uint256 public endTime;
    address public vaultToken;
    address public assetToken;
    uint256 public maxSupply;
    uint256 public softCap;
    uint256 public sharePrice;
    uint256 public minDepositAmount;
    uint256 public manageFeeBps;
    address public fundingReceiver;
    address public manageFeeReceiver;
    uint256 public decimalsMultiplier;
    address public manager;
    uint256 public fundingAssets;
    uint256 public manageFee;
    
    mapping(address => uint256) public userDeposits;
    uint256 public totalDeposited;
    bool public isFinalized;
    bool public isSuccessful;
    
    modifier onlyManager() {
        require(msg.sender == manager, "MockCrowdsale: only manager");
        _;
    }
    
    modifier onlyActive() {
        require(block.timestamp >= startTime && block.timestamp <= endTime, "MockCrowdsale: not active");
        require(!isFinalized, "MockCrowdsale: already finalized");
        _;
    }
    
    constructor() {
        // 构造函数为空，支持Clones模式
    }
    
    // 初始化函数（用于Clones模式）
    function initCrowdsale(
        address _vault,
        address _vaultToken,
        uint256 _startTime,
        uint256 _endTime,
        address _assetToken,
        uint256 _maxSupply,
        uint256 _softCap,
        uint256 _sharePrice,
        uint256 _minDepositAmount,
        uint256 _manageFeeBps,
        address _fundingReceiver,
        address _manageFeeReceiver,
        uint256 _decimalsMultiplier,
        address _manager
    ) external {
        require(vault == address(0), "MockCrowdsale: already initialized");
        
        vault = _vault;
        vaultToken = _vaultToken;
        startTime = _startTime;
        endTime = _endTime;
        assetToken = _assetToken;
        maxSupply = _maxSupply;
        softCap = _softCap;
        sharePrice = _sharePrice;
        minDepositAmount = _minDepositAmount;
        manageFeeBps = _manageFeeBps;
        fundingReceiver = _fundingReceiver;
        manageFeeReceiver = _manageFeeReceiver;
        decimalsMultiplier = _decimalsMultiplier;
        manager = _manager;
    }
    
    // Mock实现，只保留接口，不包含具体业务逻辑
    function deposit(uint256 amount, address receiver) external override onlyActive nonReentrant returns (uint256) {
        // Mock实现，不包含具体业务逻辑
        emit Deposit(receiver, amount, block.timestamp);
        return amount;
    }
    
    function redeem(uint256 amount, address receiver) external override onlyManager nonReentrant {
        // Mock实现，不包含具体业务逻辑
        emit Redeem(receiver, amount, block.timestamp);
    }
    
    function depositWithSignature(
        uint256 amount, 
        address receiver, 
        bytes memory signature
    ) external override onlyManager {
        // Mock实现，不包含具体业务逻辑
    }
    
    function offChainRedeem(uint256 amount, address receiver) external override onlyManager {
        // Mock实现，不包含具体业务逻辑
    }
    
    function withdrawFundingAssets() external override onlyManager {
        // Mock实现，不包含具体业务逻辑
        emit FundingWithdrawn(fundingReceiver, 0);
    }
    
    function withdrawManageFee() external override onlyManager {
        // Mock实现，不包含具体业务逻辑
        emit FeeWithdrawn(manageFeeReceiver, 0);
    }
    
    // 辅助函数
    function finalize() external onlyManager {
        // Mock实现，不包含具体业务逻辑
        isFinalized = true;
        isSuccessful = true;
        emit CrowdsaleFinalized(isSuccessful, totalDeposited);
    }
    
    function getUserDeposit(address user) external view returns (uint256) {
        return userDeposits[user];
    }
    
    function getTotalDeposited() external view returns (uint256) {
        return totalDeposited;
    }
    
    function isActive() external view returns (bool) {
        return block.timestamp >= startTime && 
               block.timestamp <= endTime && 
               !isFinalized;
    }
    
    // ============ ICrowdsale 接口实现 ============
    
    function isFundingSuccessful() external view override returns (bool) {
        return isSuccessful;
    }
    
    function isFundingPeriodActive() external view override returns (bool) {
        return block.timestamp >= startTime && 
               block.timestamp <= endTime && 
               !isFinalized;
    }
    
    function getTotalRaised() external view override returns (uint256) {
        return totalDeposited;
    }
    
    function getRemainingSupply() external view override returns (uint256) {
        return maxSupply > totalDeposited ? maxSupply - totalDeposited : 0;
    }
} 
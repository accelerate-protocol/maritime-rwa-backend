// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/ICrowdsale.sol";
import "../../interfaces/IVault.sol";
import "../../interfaces/IToken.sol";

/**
 * @title Crowdsale
 * @dev 众筹模版实现，提供公平募资功能
 * @notice 支持链上和链下存款，融资失败可退款
 */
contract Crowdsale is ICrowdsale, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    // ============ 状态变量 ============
    
    address public override vault;
    uint256 public override startTime;
    uint256 public override endTime;
    address public override vaultToken;
    address public override assetToken;
    uint256 public override maxSupply;
    uint256 public override softCap;
    uint256 public override sharePrice;
    uint256 public override minDepositAmount;
    uint256 public override manageFeeBps;
    address public override fundingReceiver;
    address public override manageFeeReceiver;
    uint256 public override decimalsMultiplier;
    address public override manager;
    uint256 public override fundingAssets;
    uint256 public override manageFee;
    
    // 常量
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SHARE_PRICE_DENOMINATOR = 10**8;
    
    // ============ 修饰符 ============
    
    modifier onlyManager() {
        require(msg.sender == manager, "Crowdsale: only manager");
        _;
    }
    
    modifier onlyDuringFunding() {
        require(isFundingPeriodActive(), "Crowdsale: not in funding period");
        _;
    }
    
    modifier onlyAfterFunding() {
        require(block.timestamp > endTime, "Crowdsale: funding period not ended");
        _;
    }
    
    modifier whenWhitelisted(address user) {
        IVault vaultContract = IVault(vault);
        if (vaultContract.whitelistEnabled()) {
            require(vaultContract.isWhitelisted(user), "Crowdsale: not whitelisted");
        }
        _;
    }
    
    // ============ 构造函数 ============
    
    /**
     * @dev 构造函数
     * @param _vault Vault合约地址
     * @param _startTime 开始时间
     * @param _endTime 结束时间
     * @param _vaultToken Vault代币地址
     * @param _assetToken 资产代币地址
     * @param _maxSupply 最大供应量
     * @param _softCap 软顶（融资阈值）
     * @param _sharePrice 份额价格
     * @param _minDepositAmount 最小存款金额
     * @param _manageFeeBps 管理费基点
     * @param _fundingReceiver 融资接收地址
     * @param _manageFeeReceiver 管理费接收地址
     */
    constructor(
        address _vault,
        uint256 _startTime,
        uint256 _endTime,
        address _vaultToken,
        address _assetToken,
        uint256 _maxSupply,
        uint256 _softCap,
        uint256 _sharePrice,
        uint256 _minDepositAmount,
        uint256 _manageFeeBps,
        address _fundingReceiver,
        address _manageFeeReceiver
    ) {
        require(_vault != address(0), "Crowdsale: invalid vault");
        require(_startTime < _endTime, "Crowdsale: invalid time range");
        require(_endTime > block.timestamp, "Crowdsale: end time in past");
        require(_vaultToken != address(0), "Crowdsale: invalid vault token");
        require(_assetToken != address(0), "Crowdsale: invalid asset token");
        require(_maxSupply > 0, "Crowdsale: invalid max supply");
        require(_softCap > 0 && _softCap <= _maxSupply, "Crowdsale: invalid soft cap");
        require(_sharePrice > 0, "Crowdsale: invalid share price");
        require(_minDepositAmount > 0, "Crowdsale: invalid min deposit");
        require(_manageFeeBps <= BPS_DENOMINATOR, "Crowdsale: invalid manage fee");
        require(_fundingReceiver != address(0), "Crowdsale: invalid funding receiver");
        require(_manageFeeReceiver != address(0), "Crowdsale: invalid fee receiver");
        
        vault = _vault;
        startTime = _startTime;
        endTime = _endTime;
        vaultToken = _vaultToken;
        assetToken = _assetToken;
        maxSupply = _maxSupply;
        softCap = _softCap;
        sharePrice = _sharePrice;
        minDepositAmount = _minDepositAmount;
        manageFeeBps = _manageFeeBps;
        fundingReceiver = _fundingReceiver;
        manageFeeReceiver = _manageFeeReceiver;
        
        manager = IVault(_vault).manager();
        
        // 计算精度倍数
        uint8 vaultTokenDecimals = IToken(_vaultToken).decimals();
        uint8 assetTokenDecimals = IERC20Metadata(_assetToken).decimals();
        require(vaultTokenDecimals >= assetTokenDecimals, "Crowdsale: invalid token decimals");
        decimalsMultiplier = 10**(vaultTokenDecimals - assetTokenDecimals);
        
        _transferOwnership(manager);
    }
    
    // ============ 融资操作 ============
    
    /**
     * @dev 存款购买份额
     * @param amount 存款金额
     * @param receiver 接收地址
     * @return shares 获得的份额数量
     */
    function deposit(uint256 amount, address receiver) 
        external 
        override 
        onlyDuringFunding 
        whenWhitelisted(msg.sender) 
        whenWhitelisted(receiver) 
        nonReentrant 
        returns (uint256 shares) 
    {
        require(amount >= minDepositAmount, "Crowdsale: amount less than minimum");
        require(receiver != address(0), "Crowdsale: invalid receiver");
        
        // 计算管理费
        uint256 manageFeeAmount = (amount * manageFeeBps) / BPS_DENOMINATOR;
        manageFee += manageFeeAmount;
        fundingAssets += amount;
        
        // 计算份额数量
        shares = _getSharesForAssets(amount);
        require(
            IToken(vaultToken).totalSupply() + shares <= maxSupply,
            "Crowdsale: exceeds max supply"
        );
        
        // 转入资产
        IERC20(assetToken).safeTransferFrom(
            msg.sender,
            address(this),
            amount + manageFeeAmount
        );
        
        // 铸造代币
        IToken(vaultToken).mint(receiver, shares);
        
        emit Deposit(msg.sender, amount, receiver, shares);
        return shares;
    }
    
    /**
     * @dev 赎回份额（仅在融资失败时）
     * @param amount 赎回份额数量
     * @param receiver 接收地址
     */
    function redeem(uint256 amount, address receiver) 
        external 
        override 
        onlyAfterFunding 
        whenWhitelisted(msg.sender) 
        nonReentrant 
    {
        require(!isFundingSuccessful(), "Crowdsale: funding was successful");
        require(amount > 0, "Crowdsale: invalid amount");
        require(receiver != address(0), "Crowdsale: invalid receiver");
        
        uint256 userBalance = IToken(vaultToken).balanceOf(msg.sender);
        require(userBalance >= amount, "Crowdsale: insufficient balance");
        
        // 计算退还资产
        uint256 assetAmount = _getAssetsForShares(amount);
        uint256 feeAmount = (assetAmount * manageFeeBps) / BPS_DENOMINATOR;
        
        // 销毁代币
        IToken(vaultToken).burnFrom(msg.sender, amount);
        
        // 更新状态
        fundingAssets -= assetAmount;
        manageFee -= feeAmount;
        
        // 退还资产（包括管理费）
        IERC20(assetToken).safeTransfer(receiver, assetAmount + feeAmount);
        
        emit Redeem(msg.sender, amount, receiver);
    }
    
    /**
     * @dev 链下存款带签名验证
     * @param amount 存款金额
     * @param receiver 接收地址
     * @param signature 签名数据
     */
    function depositWithSignature(
        uint256 amount, 
        address receiver, 
        bytes memory signature
    ) external override onlyManager onlyDuringFunding {
        require(amount >= minDepositAmount, "Crowdsale: amount less than minimum");
        require(receiver != address(0), "Crowdsale: invalid receiver");
        
        // 这里应该验证签名，简化实现
        // 实际应用中需要实现完整的签名验证逻辑
        
        // 计算份额数量
        uint256 shares = _getSharesForAssets(amount);
        require(
            IToken(vaultToken).totalSupply() + shares <= maxSupply,
            "Crowdsale: exceeds max supply"
        );
        
        // 更新状态（假设资产已经在链下收到）
        fundingAssets += amount;
        uint256 manageFeeAmount = (amount * manageFeeBps) / BPS_DENOMINATOR;
        manageFee += manageFeeAmount;
        
        // 铸造代币
        IToken(vaultToken).mint(receiver, shares);
        
        emit OffChainDeposit(msg.sender, receiver, amount, signature);
    }
    
    /**
     * @dev 链下赎回
     * @param amount 赎回份额数量
     * @param receiver 接收地址
     */
    function offChainRedeem(uint256 amount, address receiver) 
        external 
        override 
        onlyManager 
        onlyAfterFunding 
    {
        require(!isFundingSuccessful(), "Crowdsale: funding was successful");
        require(amount > 0, "Crowdsale: invalid amount");
        require(receiver != address(0), "Crowdsale: invalid receiver");
        
        uint256 userBalance = IToken(vaultToken).balanceOf(receiver);
        require(userBalance >= amount, "Crowdsale: insufficient balance");
        
        // 计算退还资产
        uint256 assetAmount = _getAssetsForShares(amount);
        uint256 feeAmount = (assetAmount * manageFeeBps) / BPS_DENOMINATOR;
        
        // 销毁代币
        IToken(vaultToken).burnFrom(receiver, amount);
        
        // 更新状态
        fundingAssets -= assetAmount;
        manageFee -= feeAmount;
        
        // 链下处理资产退还
        
        emit OffChainRedeem(msg.sender, receiver, amount);
    }
    
    // ============ 资金管理 ============
    
    /**
     * @dev 提取融资资产（仅在融资成功后）
     */
    function withdrawFundingAssets() external override onlyManager onlyAfterFunding nonReentrant {
        require(isFundingSuccessful(), "Crowdsale: funding not successful");
        require(fundingAssets > 0, "Crowdsale: no funding assets");
        
        uint256 amount = fundingAssets;
        fundingAssets = 0;
        
        IERC20(assetToken).safeTransfer(fundingReceiver, amount);
        
        emit FundingAssetsWithdrawn(fundingReceiver, amount);
    }
    
    /**
     * @dev 提取管理费（仅在融资成功后）
     */
    function withdrawManageFee() external override onlyManager onlyAfterFunding nonReentrant {
        require(isFundingSuccessful(), "Crowdsale: funding not successful");
        require(manageFee > 0, "Crowdsale: no manage fee");
        
        uint256 amount = manageFee;
        manageFee = 0;
        
        IERC20(assetToken).safeTransfer(manageFeeReceiver, amount);
        
        emit ManageFeeWithdrawn(manageFeeReceiver, amount);
    }
    
    // ============ 状态查询 ============
    
    /**
     * @dev 检查融资是否成功
     * @return 融资是否成功
     */
    function isFundingSuccessful() public view override returns (bool) {
        return IToken(vaultToken).totalSupply() >= softCap;
    }
    
    /**
     * @dev 检查融资期是否激活
     * @return 融资期是否激活
     */
    function isFundingPeriodActive() public view override returns (bool) {
        return block.timestamp >= startTime && block.timestamp <= endTime;
    }
    
    /**
     * @dev 获取总募资金额
     * @return 总募资金额
     */
    function getTotalRaised() external view override returns (uint256) {
        return fundingAssets;
    }
    
    /**
     * @dev 获取剩余供应量
     * @return 剩余供应量
     */
    function getRemainingSupply() external view override returns (uint256) {
        uint256 currentSupply = IToken(vaultToken).totalSupply();
        return maxSupply > currentSupply ? maxSupply - currentSupply : 0;
    }
    
    // ============ 内部函数 ============
    
    /**
     * @dev 根据资产数量计算份额数量
     * @param assetAmount 资产数量
     * @return 份额数量
     */
    function _getSharesForAssets(uint256 assetAmount) internal view returns (uint256) {
        return (assetAmount * decimalsMultiplier * SHARE_PRICE_DENOMINATOR) / sharePrice;
    }
    
    /**
     * @dev 根据份额数量计算资产数量
     * @param shareAmount 份额数量
     * @return 资产数量
     */
    function _getAssetsForShares(uint256 shareAmount) internal view returns (uint256) {
        return (shareAmount * sharePrice) / (decimalsMultiplier * SHARE_PRICE_DENOMINATOR);
    }
} 
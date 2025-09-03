// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../../interfaces/ICrowdsale.sol";
import "../../interfaces/IVault.sol";
import "../../interfaces/IToken.sol";



/**
 * @title Crowdsale
 * @dev Crowdsale template implementation, providing fair fundraising functionality
 * @notice Supports on-chain and off-chain deposits, refundable if funding fails
 */
contract Crowdsale is ICrowdsale, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    
    // ============ State Variables ============
    
    address public override vault;
    uint256 public override startTime;
    uint256 public override endTime;
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

    // Constants
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SHARE_PRICE_DENOMINATOR = 10**8;
    
    // Nonce tracking for users (to prevent replay attacks)
    mapping(address => uint256) public callerNonce;

    // Initialization state
    bool private _initialized;
    

    
    
    // ============ Modifiers ============
    
    modifier onlyManager() {
        require(msg.sender == manager, "Crowdsale: only manager");
        _;
    }
    
    modifier onlyDuringFunding() {
        require(block.timestamp >= startTime && block.timestamp <= endTime, "Crowdsale: not in funding period");
        require(!isFundingSuccessful(), "Crowdsale: funding already successful");
        _;
    }
    
    modifier onlyAfterFundingFailed() {
        require(block.timestamp > endTime, "Crowdsale: funding period not ended");
        require(!isFundingSuccessful(), "Crowdsale: funding was successful");
        _;
    }

    modifier onlyAfterFundingSuccess() {
        require(isFundingSuccessful(), "Crowdsale: funding was not successful");
        _;
    }
    
    modifier whenInitialized() {
        require(_initialized, "Crowdsale: not initialized");
        _;
    }
    
    // ============ Constructor ============
    
    constructor() {
    }
    
    // ============ Initialization Function ============

    /**
     * @dev Unified initialization interface
     * @param _vault Vault address
     * @param _token Token address
     * @param _initData Encoded initialization data
     */
    function initiate(address _vault, address _token, bytes memory _initData) external override {
        (uint256 _startTime, uint256 _endTime, address _assetToken, uint256 _maxSupply, uint256 _softCap, uint256 _sharePrice, uint256 _minDepositAmount, uint256 _manageFeeBps, address _fundingReceiver, address _manageFeeReceiver, address _manager) = abi.decode(_initData, (uint256, uint256, address, uint256, uint256, uint256, uint256, uint256, address, address, address));
        _initCrowdsale(_vault, _token, _startTime, _endTime, _assetToken, _maxSupply, _softCap, _sharePrice, _minDepositAmount, _manageFeeBps, _fundingReceiver, _manageFeeReceiver, _manager);
    }
    
    // ============ Funding Operations ============
    /**
     * @dev Deposit to purchase shares (user initiated, requires manager signature)
     * @param amount Deposit amount
     * @param receiver Receiver address
     * @param signature Manager signature
     */
    function deposit(uint256 amount, address receiver, bytes memory signature) 
        external 
        override 
        whenInitialized
        onlyDuringFunding 
        nonReentrant 
    {
        require(amount >= minDepositAmount, "Crowdsale: amount less than minimum");
        require(receiver != address(0), "Crowdsale: invalid receiver");
        
        // Verify signature using OnChainSignatureData structure
        uint256 nonce = callerNonce[msg.sender]++;
        
        ICrowdsale.OnChainSignatureData memory sigData = ICrowdsale.OnChainSignatureData({
            operation: "deposit",
            amount: amount,
            receiver: receiver,
            nonce: nonce,
            chainId: block.chainid,
            contractAddress: address(this)
        });
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            sigData.operation,
            sigData.amount,
            sigData.receiver,
            sigData.nonce,
            sigData.chainId,
            sigData.contractAddress
        ));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedMessageHash.recover(signature);
        require(signer == manager, "Crowdsale: invalid signature");
        
        // Calculate shares for the requested amount (with fee deduction for on-chain)
        uint256 feeAmount = (amount * manageFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = amount - feeAmount;
        uint256 requestedShares = _getSharesForAssets(netAmount);
        
        uint256 currentSupply = IToken(IVault(vault).vaultToken()).totalSupply();
        uint256 remainingSupply = maxSupply - currentSupply;
        
        // Check if we can fulfill the full request
        uint256 actualAmount;
        uint256 actualShares;
        if (requestedShares > remainingSupply) {
            // Calculate actual amount that can be deposited
            actualShares = remainingSupply;
            uint256 actualNetAmount = _getNetAssetsForShares(remainingSupply);
            actualAmount = (actualNetAmount * BPS_DENOMINATOR) / (BPS_DENOMINATOR - manageFeeBps); // Convert back to gross amount
            
            require(actualAmount >= minDepositAmount, "Crowdsale: remaining amount below minimum");
        } else {
            actualShares = requestedShares;
            actualAmount = amount;
        }
        
        // Calculate management fee based on actual amount
        uint256 manageFeeAmount = (actualAmount * manageFeeBps) / BPS_DENOMINATOR;
        
        // Update state
        manageFee += manageFeeAmount;
        uint256 netAmountForFunding = actualAmount - manageFeeAmount;
        fundingAssets += netAmountForFunding; // Only net amount goes to funding
        
        // Transfer assets (user pays the full actual amount, fee is deducted)
        IERC20(assetToken).safeTransferFrom(
            msg.sender,
            address(this),
            actualAmount
        );
        
        // Mint tokens through vault
        IVault(vault).mintToken(receiver, actualShares);
        
        emit Deposit(msg.sender, receiver, actualAmount, manageFeeAmount, actualShares);
    }
    
    /**
     * @dev Redeem specified amount of shares (user initiated, requires manager signature)
     * @param amount Amount of shares to redeem
     * @param receiver Receiver address
     * @param signature Manager signature
     */
    function redeem(uint256 amount, address receiver, bytes memory signature) 
        external 
        override 
        whenInitialized
        onlyAfterFundingFailed 
        nonReentrant 
    {
        require(receiver != address(0), "Crowdsale: invalid receiver");
        require(amount > 0, "Crowdsale: amount must be greater than 0");
        
        // Get user's total balance and verify they have enough shares
        uint256 userShares = IToken(IVault(vault).vaultToken()).balanceOf(msg.sender);
        require(userShares >= amount, "Crowdsale: insufficient shares to redeem");
        
        // Verify signature using OnChainSignatureData structure
        uint256 nonce = callerNonce[msg.sender]++;
        
        ICrowdsale.OnChainSignatureData memory sigData = ICrowdsale.OnChainSignatureData({
            operation: "redeem",
            amount: amount,
            receiver: receiver,
            nonce: nonce,
            chainId: block.chainid,
            contractAddress: address(this)
        });
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            sigData.operation,
            sigData.amount,
            sigData.receiver,
            sigData.nonce,
            sigData.chainId,
            sigData.contractAddress
        ));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedMessageHash.recover(signature);
        require(signer == manager, "Crowdsale: invalid signature");
        
        // Calculate refund assets for the specified amount of shares
        uint256 netAssetAmount = _getNetAssetsForShares(amount);
        uint256 feeAmount = _gethManagerFeeWithShares(amount);
        uint256 grossAssetAmount = netAssetAmount + feeAmount;
        
        // Burn the specified amount of tokens through vault
        IVault(vault).burnToken(msg.sender, amount);
        
        // Update state
        fundingAssets -= netAssetAmount;
        manageFee -= feeAmount;
        
        // Refund assets (including management fee)
        IERC20(assetToken).safeTransfer(receiver, grossAssetAmount);
        
        emit FundFailedRedeem(msg.sender, receiver, amount, netAssetAmount, feeAmount);
    }
    
    /**
     * @dev Off-chain deposit (only manager can call)
     * @param amount Deposit amount
     * @param receiver Receiver address
     */
    function offChainDeposit(uint256 amount, address receiver) 
        external 
        override 
        whenInitialized
        onlyManager 
        onlyDuringFunding 
    {
        require(amount >= minDepositAmount, "Crowdsale: amount less than minimum");
        require(receiver != address(0), "Crowdsale: invalid receiver");
        
        // Calculate shares for the requested amount (no fee deduction for off-chain)
        uint256 requestedShares = _getSharesForAssets(amount);
        
        uint256 currentSupply = IToken(IVault(vault).vaultToken()).totalSupply();
        uint256 remainingSupply = maxSupply - currentSupply;
        
        // Check if we can fulfill the full request
        uint256 actualAmount;
        uint256 actualShares;
        if (requestedShares > remainingSupply) {
            // Calculate actual amount that can be deposited
            actualShares = remainingSupply;
            actualAmount = _getNetAssetsForShares(remainingSupply);
            require(actualAmount >= minDepositAmount, "Crowdsale: remaining amount below minimum");
        } else {
            actualShares = requestedShares;
            actualAmount = amount;
        }
        
        // No management fee for off-chain deposits
        
        // Mint tokens through vault
        IVault(vault).mintToken(receiver, actualShares);
        
        emit OffChainDeposit(msg.sender, receiver, actualShares, actualAmount);
    }
    
    /**
     * @dev Off-chain redeem all shares (only manager can call)
     * @param receiver Receiver address
     */
    function offChainRedeem(address receiver) 
        external 
        override 
        whenInitialized
        onlyManager 
        onlyAfterFundingFailed 
    {
        require(receiver != address(0), "Crowdsale: invalid receiver");
        
        // Get user's total balance (redeem all shares)
        uint256 userShares = IToken(IVault(vault).vaultToken()).balanceOf(receiver);
        require(userShares > 0, "Crowdsale: no shares to redeem");
        
        // Calculate refund assets for all shares
        uint256 assetAmount = _getNetAssetsForShares(userShares);
        
        // Burn all tokens through vault
        IVault(vault).burnToken(receiver, userShares);
                
        emit OffChainRedeem(msg.sender, receiver, userShares, assetAmount);
    }
    
    // ============ Fund Management ============
    
    /**
     * @dev Withdraw funding assets (only when funding is successful)
     */
    function withdrawFundingAssets() external override whenInitialized onlyAfterFundingSuccess nonReentrant {
        require(msg.sender == fundingReceiver, "Crowdsale: only funding receiver");
        require(fundingAssets > 0, "Crowdsale: no funding assets");
        
        uint256 amount = fundingAssets;
        fundingAssets = 0;
        
        IERC20(assetToken).safeTransfer(fundingReceiver, amount);
        
        emit FundingAssetsWithdrawn(msg.sender, fundingReceiver, amount);
    }
    
    /**
     * @dev Withdraw management fee (only when funding is successful)
     */
    function withdrawManageFee() external override whenInitialized onlyAfterFundingSuccess nonReentrant {
        require(msg.sender == manageFeeReceiver, "Crowdsale: only manage fee receiver");
        require(manageFee > 0, "Crowdsale: no manage fee");
        
        uint256 amount = manageFee;
        manageFee = 0;
        
        IERC20(assetToken).safeTransfer(manageFeeReceiver, amount);
        
        emit ManageFeeWithdrawn(msg.sender, manageFeeReceiver, amount);
    }
    
    /**
     * @dev Unpause token trading when funding is successful
     * This function should be called after funding period ends and funding is successful
     */
    function unpauseTokenOnFundingSuccess() external override whenInitialized onlyManager onlyAfterFundingSuccess {
        // Unpause token trading through vault
        IVault(vault).unpauseToken();
        
        emit TokenUnpausedOnFundingSuccess();
    }
    
    

    // ============ Query Interface ============

    /**
     * @dev Check if funding is successful
     * @return Whether funding is successful
     * Success conditions:
     * 1. MaxSupply reached (immediate success)
     * 2. Time ended AND softCap reached
     */
    function isFundingSuccessful() public view override returns (bool) {
        uint256 currentSupply = IToken(IVault(vault).vaultToken()).totalSupply();
        
        // Condition 1: MaxSupply reached (immediate success)
        if (currentSupply >= maxSupply) {
            return true;
        }
        
        // Condition 2: Time ended AND softCap reached
        if (block.timestamp > endTime && currentSupply >= softCap) {
            return true;
        }
        
        return false;
    }
    
    /**
     * @dev Check if funding period is active
     * @return Whether funding period is active
     */
    function isFundingPeriodActive() public view override returns (bool) {
        return block.timestamp >= startTime && block.timestamp <= endTime && !isFundingSuccessful();
    }
    
    /**
     * @dev Get total asset amount raised
     * @return Total asset raised
     */
    function getTotalRaised() external view override returns (uint256) {
        return fundingAssets;
    }
    
    /**
     * @dev Get remaining supply
     * @return Remaining supply
     */
    function getRemainingSupply() external view override returns (uint256) {
        uint256 currentSupply = IToken(IVault(vault).vaultToken()).totalSupply();
        return maxSupply > currentSupply ? maxSupply - currentSupply : 0;
    }
    
    /**
     * @dev Query if initialized
     */
    function isInitialized() external view returns (bool) {
        return _initialized;
    }
    


    /**
     * @dev Query caller nonce for signature verification
     * @param caller Caller address
     * @return Current caller nonce
     */
    function getCallerNonce(address caller) external view returns (uint256) {
        return callerNonce[caller];
    }
    
    /**
     * @dev Generate deposit signature message hash for backend signing
     * @param amount Deposit amount
     * @param receiver Receiver address
     * @param nonce Manager nonce
     * @return Message hash to be signed
     */
    function getDepositSignatureMessage(
        uint256 amount,
        address receiver,
        uint256 nonce
    ) external view override returns (bytes32) {
        bytes32 messageHash = keccak256(abi.encodePacked(
            "deposit",
            amount,
            receiver,
            nonce,
            block.chainid,
            address(this)
        ));
        return messageHash;
    }
    
    /**
     * @dev Generate redeem signature message hash for backend signing
     * @param amount Number of shares to redeem
     * @param receiver Receiver address
     * @param nonce Manager nonce
     * @return Message hash to be signed
     */
    function getRedeemSignatureMessage(
        uint256 amount,
        address receiver,
        uint256 nonce
    ) external view override returns (bytes32) {
        bytes32 messageHash = keccak256(abi.encodePacked(
            "redeem",
            amount,
            receiver,
            nonce,
            block.chainid,
            address(this)
        ));
        return messageHash;
    }

    
    // ============ Internal Functions ============

    /**
     * @dev _Initialize crowdsale contract (for Clones pattern)
     * @param _vault Vault contract address
     * @param _startTime Start time
     * @param _endTime End time
     * @param _assetToken Asset token address
     * @param _maxSupply Maximum supply
     * @param _softCap Soft cap (funding threshold)
     * @param _sharePrice Share price
     * @param _minDepositAmount Minimum deposit amount
     * @param _manageFeeBps Management fee basis points
     * @param _fundingReceiver Funding receiver address
     * @param _manageFeeReceiver Management fee receiver address
     * @param _manager Manager address
     */
    function _initCrowdsale(
        address _vault,
        address _token,
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
        address _manager
    ) internal {
        require(!_initialized, "Crowdsale: already initialized");
        require(_vault != address(0), "Crowdsale: invalid vault");
        require(_startTime < _endTime, "Crowdsale: invalid time range");
        require(_endTime > block.timestamp, "Crowdsale: end time in past");
        require(_assetToken != address(0), "Crowdsale: invalid asset token");
        require(_maxSupply > 0, "Crowdsale: invalid max supply");
        require(_softCap >= 0 && _softCap <= _maxSupply, "Crowdsale: invalid soft cap");
        require(_sharePrice > 0, "Crowdsale: invalid share price");
        require(_minDepositAmount > 0, "Crowdsale: invalid min deposit");
        require(_manageFeeBps <= BPS_DENOMINATOR, "Crowdsale: invalid manage fee");
        require(_fundingReceiver != address(0), "Crowdsale: invalid funding receiver");
        require(_manageFeeReceiver != address(0), "Crowdsale: invalid fee receiver");
        require(_manager != address(0), "Crowdsale: invalid manager");
        
        vault = _vault;
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

        decimalsMultiplier = 10 **
                (IERC20Metadata(_token).decimals() -
                    IERC20Metadata(_assetToken).decimals());
        manager = _manager;
        _initialized = true;
        _transferOwnership(_manager);
    }
    
    /**
     * @dev Scale up amount by decimalsMultiplier
     * @param amount Amount to scale up
     * @return Scaled up amount
     */
    function _scaleUp(uint256 amount) internal view returns (uint256) {
        return amount * decimalsMultiplier;
    }

    /**
     * @dev Scale down amount by decimalsMultiplier
     * @param amount Amount to scale down
     * @return Scaled down amount
     */
    function _scaleDown(uint256 amount) internal view returns (uint256) {
        return amount / decimalsMultiplier;
    }

    /**
     * @dev Calculate shares for given asset amount
     * @param assetAmount Asset amount
     * @return Number of shares
     */
    function _getSharesForAssets(uint256 assetAmount) internal view returns (uint256) {
        uint256 scaledAmount = _scaleUp(assetAmount);
        return (scaledAmount * SHARE_PRICE_DENOMINATOR) / sharePrice;
    }
    
    /**
     * @dev Calculate the net asset amount that shares represent (internal helper)
     * @param shareAmount Share amount
     * @return Net asset amount (without fee compensation)
     */
    function _getNetAssetsForShares(uint256 shareAmount) internal view returns (uint256) {
        // Calculate the net asset amount that these shares represent
        uint256 scaledAmount = (shareAmount * sharePrice) / SHARE_PRICE_DENOMINATOR;
        uint256 netAssetAmount = _scaleDown(scaledAmount);
        
        return netAssetAmount;
    }
    
    /**
     * @dev Calculate ManagerFee for given share amount
     * @param shareAmount Share amount
     * @return managerFee amount
     */
    function _gethManagerFeeWithShares(uint256 shareAmount) internal view returns (uint256) {
        // 1. Get the net asset amount using shared logic
        uint256 netAssetAmount = _getNetAssetsForShares(shareAmount);
        
        // 2. Calculate the management fee
        // Formula: fee = netAmount * manageFeeBps / (BPS_DENOMINATOR - manageFeeBps)
        // This calculates the fee that would be charged on the gross amount
        // G = Gross amount (original deposit)
        // N = Net amount (after fee deduction)
        // R = Management fee rate (manageFeeBps / BPS_DENOMINATOR)
        // F = Management fee
        // Relations:
        // N = G * (1 - R)              // Net amount = Gross amount * (1 - rate)
        // G = N / (1 - R)              // Gross amount = Net amount / (1 - rate)
        // F = G * R                    // Fee = Gross amount * rate
        // F = N * R / (1 - R)          // Fee = Net amount * rate / (1 - rate)
        uint256 managerFee = (netAssetAmount * manageFeeBps) / (BPS_DENOMINATOR - manageFeeBps);
        
        return managerFee;
    }
    
} 
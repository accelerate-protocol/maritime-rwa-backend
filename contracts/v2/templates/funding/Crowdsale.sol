// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
    
    // Signature verification
    uint256 public managerNonce;
    
    // Initialization state
    bool private _initialized;
    
    // ============ Modifiers ============
    
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
    
    modifier whenInitialized() {
        require(_initialized, "Crowdsale: not initialized");
        _;
    }
    
    modifier whenNotInitialized() {
        require(!_initialized, "Crowdsale: already initialized");
        _;
    }
    
    // ============ Constructor ============
    
    constructor() {
        // Empty constructor, supports Clones pattern
        _transferOwnership(msg.sender);
    }
    
    // ============ Initialization Function ============
    
    /**
     * @dev Initialize crowdsale contract (for Clones pattern)
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
     * @param _decimalsMultiplier Decimals multiplier
     * @param _manager Manager address
     */
    function initCrowdsale(
        address _vault,
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
    ) external whenNotInitialized {
        require(_vault != address(0), "Crowdsale: invalid vault");
        require(_startTime < _endTime, "Crowdsale: invalid time range");
        require(_endTime > block.timestamp, "Crowdsale: end time in past");
        require(_assetToken != address(0), "Crowdsale: invalid asset token");
        require(_maxSupply > 0, "Crowdsale: invalid max supply");
        require(_softCap > 0 && _softCap <= _maxSupply, "Crowdsale: invalid soft cap");
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
        decimalsMultiplier = _decimalsMultiplier;
        manager = _manager;
        
        _initialized = true;
        _transferOwnership(_manager);
    }
    
    // ============ Funding Operations ============
    
    /**
     * @dev Deposit to purchase shares (user initiated, requires manager signature)
     * @param amount Deposit amount
     * @param receiver Receiver address
     * @param signature Manager signature
     * @return shares Number of shares received
     */
    function deposit(uint256 amount, address receiver, bytes memory signature) 
        external 
        override 
        onlyDuringFunding 
        whenWhitelisted(msg.sender) 
        whenWhitelisted(receiver) 
        whenInitialized
        nonReentrant 
        returns (uint256 shares) 
    {
        require(amount >= minDepositAmount, "Crowdsale: amount less than minimum");
        require(receiver != address(0), "Crowdsale: invalid receiver");
        
        // Verify signature using OnChainSignatureData structure
        uint256 nonce = managerNonce++;
        
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
        
        // Calculate shares for the requested amount (after fee deduction)
        uint256 feeAmount = (amount * manageFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = amount - feeAmount;
        uint256 requestedShares = _getSharesForAssets(netAmount);
        uint256 currentSupply = IToken(IVault(vault).vaultToken()).totalSupply();
        uint256 remainingSupply = maxSupply - currentSupply;
        
        // Check if we can fulfill the full request
        uint256 actualAmount = amount;
        uint256 actualNetAmount = netAmount;
        if (requestedShares > remainingSupply) {
            // User gets remaining shares, calculate required gross amount
            shares = remainingSupply;
            actualNetAmount = _getAssetsForShares(remainingSupply);
            actualAmount = (actualNetAmount * BPS_DENOMINATOR) / (BPS_DENOMINATOR - manageFeeBps); // Convert back to gross amount
            require(actualAmount >= minDepositAmount, "Crowdsale: remaining amount below minimum");
        } else {
            shares = requestedShares;
            actualAmount = amount;
            actualNetAmount = netAmount;
        }
        
        // Calculate management fee based on actual amount
        uint256 manageFeeAmount = (actualAmount * manageFeeBps) / BPS_DENOMINATOR;
        
        manageFee += manageFeeAmount;
        fundingAssets += actualNetAmount; // Only net amount goes to funding
        
        // Transfer assets (user pays the full actual amount, fee is deducted)
        IERC20(assetToken).safeTransferFrom(
            msg.sender,
            address(this),
            actualAmount
        );
        
        // Mint tokens through vault
        IVault(vault).mintToken(receiver, shares);
        
        emit Deposit(msg.sender, actualAmount, receiver, shares);
        return shares;
    }
    
    /**
     * @dev Redeem shares (user initiated, requires manager signature)
     * @param amount Number of shares to redeem
     * @param receiver Receiver address
     * @param signature Manager signature
     */
    function redeem(uint256 amount, address receiver, bytes memory signature) 
        external 
        override 
        onlyAfterFunding 
        whenWhitelisted(msg.sender) 
        whenInitialized
        nonReentrant 
    {
        require(!isFundingSuccessful(), "Crowdsale: funding was successful");
        require(amount > 0, "Crowdsale: invalid amount");
        require(receiver != address(0), "Crowdsale: invalid receiver");
        
        // Verify signature using OnChainSignatureData structure
        uint256 nonce = managerNonce++;
        
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
        
        uint256 userBalance = IToken(IVault(vault).vaultToken()).balanceOf(msg.sender);
        require(userBalance >= amount, "Crowdsale: insufficient balance");
        
        // Calculate refund assets
        uint256 assetAmount = _getAssetsForShares(amount);
        uint256 feeAmount = (assetAmount * manageFeeBps) / BPS_DENOMINATOR;
        
        // Burn tokens through vault
        IVault(vault).burnToken(msg.sender, amount);
        
        // Update state
        fundingAssets -= assetAmount;
        manageFee -= feeAmount;
        
        // Refund assets (including management fee)
        IERC20(assetToken).safeTransfer(receiver, assetAmount + feeAmount);
        
        emit Redeem(msg.sender, amount, receiver);
    }
    
    /**
     * @dev Off-chain deposit (only manager can call, requires DRDS signature verification)
     * @param amount Deposit amount
     * @param receiver Receiver address
     * @param drdsSignature DRDS signature data
     */
    function offDeposit(uint256 amount, address receiver, bytes memory drdsSignature) 
        external 
        override 
        onlyManager 
        onlyDuringFunding 
        whenInitialized
    {
        require(amount >= minDepositAmount, "Crowdsale: amount less than minimum");
        require(receiver != address(0), "Crowdsale: invalid receiver");
        
        // Verify DRDS signature using OffChainSignatureData structure
        ICrowdsale.OffChainSignatureData memory sigData = ICrowdsale.OffChainSignatureData({
            amount: amount,
            receiver: receiver
        });

        // Get validator address from Vault
        address validator = IVault(vault).validator();
        require(validator != address(0), "Crowdsale: validator not set");
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            "offDeposit",
            sigData.amount,
            sigData.receiver,
            block.chainid,
            address(this)
        ));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedMessageHash.recover(drdsSignature);
        require(signer == validator, "Crowdsale: invalid drds signature");
        
        // Calculate shares for the requested amount
        uint256 requestedShares = _getSharesForAssets(amount);
        uint256 currentSupply = IToken(IVault(vault).vaultToken()).totalSupply();
        uint256 remainingSupply = maxSupply - currentSupply;
        
        // Check if we can fulfill the full request
        uint256 actualAmount = amount;
        uint256 shares;
        if (requestedShares > remainingSupply) {
            // Calculate actual amount that can be deposited
            actualAmount = _getAssetsForShares(remainingSupply);
            require(actualAmount >= minDepositAmount, "Crowdsale: remaining amount below minimum");
            
            // Update shares to actual values
            shares = remainingSupply;
        } else {
            shares = requestedShares;
        }
        
        // Update state (assuming assets received off-chain)
        fundingAssets += actualAmount;
        uint256 manageFeeAmount = (actualAmount * manageFeeBps) / BPS_DENOMINATOR;
        manageFee += manageFeeAmount;
        
        // Mint tokens through vault
        IVault(vault).mintToken(receiver, shares);
        
        // todo: 链下质押的是否支持部分质押呢？
        emit OffChainDeposit(msg.sender, receiver, actualAmount, drdsSignature);
    }
    
    /**
     * @dev Off-chain redeem (only manager can call)
     * @param amount Number of shares to redeem
     * @param receiver Receiver address
     */
    function offChainRedeem(uint256 amount, address receiver) 
        external 
        override 
        onlyManager 
        onlyAfterFunding 
        whenInitialized
    {
        require(!isFundingSuccessful(), "Crowdsale: funding was successful");
        require(amount > 0, "Crowdsale: invalid amount");
        require(receiver != address(0), "Crowdsale: invalid receiver");
        
        uint256 userBalance = IToken(IVault(vault).vaultToken()).balanceOf(receiver);
        require(userBalance >= amount, "Crowdsale: insufficient balance");
        
        // Calculate refund assets
        uint256 assetAmount = _getAssetsForShares(amount);
        uint256 feeAmount = (assetAmount * manageFeeBps) / BPS_DENOMINATOR;
        
        // Burn tokens through vault
        IVault(vault).burnToken(receiver, amount);
        
        // Update state
        fundingAssets -= assetAmount;
        manageFee -= feeAmount;
        
        // Handle asset refund off-chain
        
        emit OffChainRedeem(msg.sender, receiver, amount);
    }
    
    // ============ Fund Management ============
    
    /**
     * @dev Withdraw funding assets (only when funding is successful)
     */
    function withdrawFundingAssets() external override onlyManager onlyAfterFunding whenInitialized nonReentrant {
        require(isFundingSuccessful(), "Crowdsale: funding not successful");
        require(fundingAssets > 0, "Crowdsale: no funding assets");
        
        uint256 amount = fundingAssets;
        fundingAssets = 0;
        
        IERC20(assetToken).safeTransfer(fundingReceiver, amount);
        
        emit FundingAssetsWithdrawn(fundingReceiver, amount);
    }
    
    /**
     * @dev Withdraw management fee (only when funding is successful)
     */
    function withdrawManageFee() external override onlyManager onlyAfterFunding whenInitialized nonReentrant {
        require(isFundingSuccessful(), "Crowdsale: funding not successful");
        require(manageFee > 0, "Crowdsale: no manage fee");
        
        uint256 amount = manageFee;
        manageFee = 0;
        
        IERC20(assetToken).safeTransfer(manageFeeReceiver, amount);
        
        emit ManageFeeWithdrawn(manageFeeReceiver, amount);
    }
    
    // ============ Status Queries ============
    
    /**
     * @dev Check if funding is successful
     * @return Whether funding is successful
     */
    function isFundingSuccessful() public view override returns (bool) {
        return IToken(IVault(vault).vaultToken()).totalSupply() >= softCap;
    }
    
    /**
     * @dev Check if funding period is active
     * @return Whether funding period is active
     */
    function isFundingPeriodActive() public view override returns (bool) {
        return block.timestamp >= startTime && block.timestamp <= endTime;
    }
    
    /**
     * @dev Get total amount raised
     * @return Total amount raised
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
    
    // ============ Internal Functions ============
    
    /**
     * @dev Calculate shares for given asset amount
     * @param assetAmount Asset amount
     * @return Number of shares
     */
    function _getSharesForAssets(uint256 assetAmount) internal view returns (uint256) {
        return (assetAmount * decimalsMultiplier * SHARE_PRICE_DENOMINATOR) / sharePrice;
    }
    
    /**
     * @dev Calculate assets for given share amount
     * @param shareAmount Share amount
     * @return Asset amount
     */
    function _getAssetsForShares(uint256 shareAmount) internal view returns (uint256) {
        return (shareAmount * sharePrice) / (decimalsMultiplier * SHARE_PRICE_DENOMINATOR);
    }
    
    // ============ Query Interface ============
    
    /**
     * @dev Query if initialized
     */
    function isInitialized() external view returns (bool) {
        return _initialized;
    }
    
    /**
     * @dev Query manager nonce for signature verification
     * @return Current manager nonce
     */
    function getManagerNonce() external view returns (uint256) {
        return managerNonce;
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
    ) external view returns (bytes32) {
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
    ) external view returns (bytes32) {
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
} 
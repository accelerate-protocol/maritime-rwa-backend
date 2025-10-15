// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../../interfaces/templates/ICrowdsale.sol";
import "../../interfaces/templates/IVault.sol";
import "../../interfaces/templates/IToken.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title Crowdsale
 * @dev Crowdsale template implementation, providing fair fundraising functionality
 * @notice Supports on-chain and off-chain deposits, refundable if funding fails
 */
contract Crowdsale is ICrowdsale, ReentrancyGuardUpgradeable, OwnableUpgradeable,PausableUpgradeable, AccessControlUpgradeable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // ============ Role ============
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant OFFCHAIN_MANAGER_ROLE = keccak256("OFFCHAIN_MANAGER_ROLE");
    bytes32 public constant WITHDRAW_ASSET_ROLE = keccak256("WITHDRAW_ASSET_ROLE");
    bytes32 public constant WITHDRAW_MANAGE_FEE_ROLE = keccak256("WITHDRAW_MANAGE_FEE_ROLE");

    // Constants
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SHARE_PRICE_DENOMINATOR = 10**8;

    // ============ State Variables ============
    address public vault;
    uint256 public startTime;
    uint256 public endTime;
    address public assetToken;
    address public shareToken;
    uint256 public maxSupply;
    uint256 public softCap;
    uint256 public sharePrice;
    uint256 public minDepositAmount;
    uint256 public manageFeeBps;
    address public fundingReceiver;
    address public manageFeeReceiver;
    uint256 public decimalsMultiplier;

    uint256 public fundingAssets;
    uint256 public manageFee;

    // Nonce tracking for users (to prevent replay attacks)
    mapping(address => uint256) public callerNonce;

    uint256 public offChainSignNonce;

    // Initialization state
    bool private initialized;

    // ============ sign validator ============
    address public onChainSignValidator;

    // Total raised share amount
    uint256 public totalRaisedShareAmount;

    
    // ============ Modifiers ============
    
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

    modifier onlyInitialized() {
        require(initialized, "Crowdsale: not initialized");
        _;
    }
    
    
    // ============ Constructor ============
    constructor() {
        _disableInitializers();
    }
    
    // ============ Initialization Function ============

    /**
     * @dev Unified initialization interface
     * @param _vault Vault address
     * @param _token Token address
     * @param _initData Encoded initialization data
     */
    function initiate(address _vault, address _token, bytes memory _initData) external initializer {
        require(!initialized, "Crowdsale: already initialized");
        
        // Decode initialization data
        CrowdsaleInitializeData memory data = abi.decode(_initData, (CrowdsaleInitializeData));
        
        // Set vault and token addresses
        require(_vault != address(0), "Crowdsale: invalid vault");
        require(_token != address(0), "Crowdsale: invalid token");
        vault = _vault;
        shareToken = _token;
        
        _initCrowdsale(data);
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
        onlyInitialized
        onlyDuringFunding
        nonReentrant 
        whenNotPaused
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
        
        _verifySignature(sigData, signature);
        
        // Calculate shares for the requested amount (with fee deduction for on-chain)
        uint256 feeAmount = (amount * manageFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = amount - feeAmount;
        uint256 requestedShares = _getSharesForAssets(netAmount);

        uint256 currentSupply = IToken(shareToken).totalSupply();
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

        // Update total raised shares
        totalRaisedShareAmount += actualShares;
        
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
        onlyInitialized
        onlyAfterFundingFailed 
        nonReentrant 
        whenNotPaused
    {
        require(receiver != address(0), "Crowdsale: invalid receiver");
        require(amount > 0, "Crowdsale: amount must be greater than 0");
        
        // Get user's total balance and verify they have enough shares
        uint256 userShares = IToken(shareToken).balanceOf(msg.sender);
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
        
        _verifySignature(sigData, signature);
        
        // Calculate refund assets for the specified amount of shares
        uint256 netAssetAmount = _getNetAssetsForShares(amount);
        uint256 feeAmount = _getManagerFeeWithShares(amount);
        uint256 grossAssetAmount = netAssetAmount + feeAmount;
        
        // Burn the specified amount of tokens through vault
        IVault(vault).burnToken(msg.sender, amount);

        totalRaisedShareAmount -= amount;
        
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
    * @param signature validator's signature
    * @param proofHash Off-chain proof hash
     */
    function offChainDeposit(uint256 amount, address receiver, bytes memory signature, bytes32 proofHash)
        external 
        override 
        onlyInitialized
        onlyRole(OFFCHAIN_MANAGER_ROLE)
        onlyDuringFunding 
        nonReentrant
        whenNotPaused
    {
        require(amount >= minDepositAmount, "Crowdsale: amount less than minimum");
        require(receiver != address(0), "Crowdsale: invalid receiver");
        
        // Verify signature using OffChainSignatureData structure
        uint256 nonce = offChainSignNonce++;

        ICrowdsale.OffChainSignatureData memory sigData = ICrowdsale.OffChainSignatureData({
            amount: amount,
            receiver: receiver,
            nonce: nonce,
            chainId: block.chainid,
            contractAddress: address(this),
            proofHash: proofHash
        });
        
        _verifyOffChainSignature(sigData, signature);
        
        // Calculate shares for the requested amount (no fee deduction for off-chain)
        uint256 requestedShares = _getSharesForAssets(amount);

        uint256 currentSupply = IToken(shareToken).totalSupply();
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

        // Update state
        totalRaisedShareAmount += actualShares;
        
        emit OffChainDeposit(msg.sender, receiver, actualShares, actualAmount, signature, proofHash);
    }
    
    /**
     * @dev Off-chain redeem all shares (only manager can call)
     * @param receiver Receiver address
     */
    function offChainRedeem(address receiver) 
        external 
        override 
        onlyInitialized
        onlyRole(OFFCHAIN_MANAGER_ROLE)
        onlyAfterFundingFailed 
        nonReentrant
        whenNotPaused
    {
        require(receiver != address(0), "Crowdsale: invalid receiver");
        
        // Get user's total balance (redeem all shares)
        uint256 userShares = IToken(shareToken).balanceOf(receiver);
        require(userShares > 0, "Crowdsale: no shares to redeem");
        
        // Calculate refund assets for all shares
        uint256 assetAmount = _getNetAssetsForShares(userShares);
        
        // Burn all tokens through vault
        IVault(vault).burnToken(receiver, userShares);

        totalRaisedShareAmount -= userShares;
                
        emit OffChainRedeem(msg.sender, receiver, userShares, assetAmount);
    }
    
    // ============ Fund Management ============
    
    /**
     * @dev Withdraw funding assets (only when funding is successful)
     */
    function withdrawFundingAssets() external override onlyInitialized onlyAfterFundingSuccess nonReentrant whenNotPaused {
        require(msg.sender == fundingReceiver || hasRole(WITHDRAW_ASSET_ROLE, msg.sender), "Crowdsale: unauthorized");
        require(fundingAssets > 0, "Crowdsale: no funding assets");
        
        uint256 amount = fundingAssets;
        fundingAssets = 0;
        
        IERC20(assetToken).safeTransfer(fundingReceiver, amount);
        
        emit FundingAssetsWithdrawn(msg.sender, fundingReceiver, amount);
    }
    
    /**
     * @dev Withdraw management fee (only when funding is successful)
     */
    function withdrawManageFee() external override onlyInitialized onlyAfterFundingSuccess nonReentrant whenNotPaused {
        require(msg.sender == manageFeeReceiver || hasRole(WITHDRAW_MANAGE_FEE_ROLE, msg.sender), "Crowdsale: unauthorized");
        require(manageFee > 0, "Crowdsale: no manage fee");
        
        uint256 amount = manageFee;
        manageFee = 0;
        
        IERC20(assetToken).safeTransfer(manageFeeReceiver, amount);
        
        emit ManageFeeWithdrawn(msg.sender, manageFeeReceiver, amount);
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
        // Condition 1: MaxSupply reached (immediate success)
        if (totalRaisedShareAmount >= maxSupply) {
            return true;
        }
        
        // Condition 2: Time ended AND softCap reached
        if (block.timestamp > endTime && totalRaisedShareAmount >= softCap) {
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
        uint256 currentSupply = IToken(shareToken).totalSupply();
        return maxSupply > currentSupply ? maxSupply - currentSupply : 0;
    }
    

    /**
     * @dev Query caller nonce for signature verification
     * @param caller Caller address
     * @return Current caller nonce
     */
    function getCallerNonce(address caller) external view returns (uint256) {
        return callerNonce[caller];
    }

    // ============ Internal Functions ============

    /**
     * @dev _Initialize crowdsale contract (for Clones pattern)
     * @param data Crowdsale initialization data structure
     */
    function _initCrowdsale(
        CrowdsaleInitializeData memory data
    ) internal {
        require(data.startTime < data.endTime, "Crowdsale: invalid time range");
        require(data.endTime > block.timestamp, "Crowdsale: end time in past");
        require(data.assetToken != address(0), "Crowdsale: invalid asset token");
        require(data.maxSupply > 0, "Crowdsale: invalid max supply");
        require(data.softCap <= data.maxSupply, "Crowdsale: invalid soft cap");
        require(data.sharePrice > 0, "Crowdsale: invalid share price");
        require(data.minDepositAmount > 0, "Crowdsale: invalid min deposit");
        require(data.manageFeeBps <= BPS_DENOMINATOR, "Crowdsale: invalid manage fee");
        require(data.fundingReceiver != address(0), "Crowdsale: invalid funding receiver");
        require(data.manageFeeReceiver != address(0), "Crowdsale: invalid fee receiver");
        require(data.manager != address(0), "Crowdsale: invalid manager");

        __Ownable_init(data.manager);
        __ReentrancyGuard_init();
        __Pausable_init();
        
        // Set state variables from data structure
        startTime = data.startTime;
        endTime = data.endTime;
        assetToken = data.assetToken;
        maxSupply = data.maxSupply;
        softCap = data.softCap;
        sharePrice = data.sharePrice;
        minDepositAmount = data.minDepositAmount;
        manageFeeBps = data.manageFeeBps;
        fundingReceiver = data.fundingReceiver;
        manageFeeReceiver = data.manageFeeReceiver;

        decimalsMultiplier = 10 **
                (IERC20Metadata(shareToken).decimals() -
                    IERC20Metadata(data.assetToken).decimals());
        
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, data.manager);
        _grantRole(MANAGER_ROLE, data.manager);
        _grantRole(PAUSER_ROLE, data.manager);
        _grantRole(WITHDRAW_ASSET_ROLE, data.manager);
        _grantRole(WITHDRAW_MANAGE_FEE_ROLE, data.manager);
        _setRoleAdmin(OFFCHAIN_MANAGER_ROLE, MANAGER_ROLE);
        _setRoleAdmin(WITHDRAW_ASSET_ROLE, MANAGER_ROLE);
        _setRoleAdmin(WITHDRAW_MANAGE_FEE_ROLE, MANAGER_ROLE);

        _grantRole(OFFCHAIN_MANAGER_ROLE, data.offchainManager);
        _grantRole(WITHDRAW_ASSET_ROLE, data.fundingReceiver);
        _grantRole(WITHDRAW_MANAGE_FEE_ROLE, data.manageFeeReceiver);

        // Set on-chain signature validator
        onChainSignValidator = data.manager;

        initialized = true;
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
    function _getManagerFeeWithShares(uint256 shareAmount) internal view returns (uint256) {
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


    /**
     * @dev Internal function to verify signature for on-chain operations
     * @param sigData The signature data structure containing operation, amount, receiver, nonce, etc.
     * @param signature The signature to verify
     */
    function _verifySignature(
        OnChainSignatureData memory sigData,
        bytes memory signature
    ) internal view {
        bytes32 messageHash = keccak256(abi.encodePacked(
            sigData.operation,
            sigData.amount,
            sigData.receiver,
            sigData.nonce,
            sigData.chainId,
            sigData.contractAddress
        ));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address signer = ethSignedMessageHash.recover(signature);
        require(signer == onChainSignValidator, "Crowdsale: invalid signature");
    }

    /**
        * @dev Internal function to verify signature for off-chain operations
        * @param sigData The signature data structure containing amount, receiver, nonce, etc.
        * @param signature The signature to verify
    */
    function _verifyOffChainSignature(
        OffChainSignatureData memory sigData,
        bytes memory signature
    ) internal view {
        // Get validator address from Vault
        address validator = IVault(vault).getValidator();
        require(validator != address(0), "Crowdsale: validator not set");

        bytes32 messageHash = keccak256(abi.encodePacked(
            sigData.amount,
            sigData.receiver,
            sigData.nonce,
            sigData.chainId,
            sigData.contractAddress,
            sigData.proofHash
        ));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address signer = ethSignedMessageHash.recover(signature);

        require(signer == validator, "Crowdsale: invalid offchain signature");
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
     * @dev Update on-chain signature validator address
     * @param _validator New validator address
     */
    function setOnChainSignValidator(address _validator) external override onlyInitialized onlyRole(MANAGER_ROLE) {
        require(_validator != address(0), "Crowdsale: invalid validator");
        address oldValidator = onChainSignValidator;
        onChainSignValidator = _validator;
        emit OnChainSignValidatorUpdated(oldValidator, _validator);
    }


    /**
     * @dev Get current off-chain signature nonce
     * @return Current off-chain signature nonce
     */
    function getOffchainNonce() external override view returns (uint256) {
        return offChainSignNonce;
    }

    
}
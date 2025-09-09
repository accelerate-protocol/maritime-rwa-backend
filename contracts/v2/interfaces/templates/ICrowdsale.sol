// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ICrowdsale
 * @dev Crowdsale templates interface
 */
interface ICrowdsale {
    // ============ Struct Definitions ============

    struct CrowdsaleInitializeData {
        uint256 startTime;          // Crowdsale start time
        uint256 endTime;            // Crowdsale end time
        address assetToken;         // Address of the asset token (e.g., USDC)
        uint256 maxSupply;          // Maximum number of shares to be sold in share token units
        uint256 softCap;            // Minimum amount to be raised for successful funding
        uint256 sharePrice;         // Price per share in asset token units, scaled by 1e8
        uint256 minDepositAmount;   // Minimum deposit amount per transaction in asset token units
        uint256 manageFeeBps;       // Management fee in basis points (bps)
        address fundingReceiver;    // Address to receive the raised funds if funding is successful
        address manageFeeReceiver;  // Address to receive the management fees if funding is successful
        address manager;            // Address of the manager to validate on-chain signatures and withdraw operations
        address offchainManager;    // Address authorized to who can perform off-chain operations
    }
    
    /**
     * @dev On-chain signature data structure
     */
    struct OnChainSignatureData {
        string operation;        // Operation name ("deposit", "redeem")
        uint256 amount;          // Deposit amount
        address receiver;        // Receiver address
        uint256 nonce;          // Nonce to prevent replay attacks
        uint256 chainId;        // Chain ID to prevent cross-chain replay
        address contractAddress; // Contract address to prevent replay
    }
    
    /**
     * @dev Off-chain signature data structure
     */
    struct OffChainSignatureData {
        uint256 amount;          // amount
        address receiver;        // Receiver address
    }
    
    // ============ Events ============
    event Deposit(address indexed operator, address indexed receiver, uint256 assetAmount, uint256 manageFee, uint256 shares);
    event FundFailedRedeem(address indexed operator, address indexed redeemReceiver,uint256 shares,uint256 assetAmount,uint256 feeAmount);
    event OffChainDeposit(address indexed operator, address indexed receiver,uint256 shares, uint256 assetAmount);
    event OffChainRedeem(address indexed operator, address indexed redeemReceiver,uint256 shares,uint256 assetAmount);
    event FundingAssetsWithdrawn(address indexed operator, address indexed receiver, uint256 amount);
    event ManageFeeWithdrawn(address indexed operator, address indexed receiver, uint256 amount);
    event TokenUnpausedOnFundingSuccess();
    event ManagerChanged(address indexed oldManager, address indexed newManager);
    event OffchainManagerChanged(address indexed oldOffchainManager, address indexed newOffchainManager);

    // ============ Funding Operations Interface ============
    // User initiated, requires manager signature
    function deposit(uint256 amount, address receiver, bytes memory signature) external;
    
    // User initiated, requires manager signature - redeems specified amount of shares
    function redeem(uint256 amount, address receiver, bytes memory signature) external;
    
    // Backend manager operate
    function offChainDeposit(uint256 amount, address receiver) external;
    
    // Backend manager initiated - redeems all user shares
    function offChainRedeem(address receiver) external;

    // ============ Fund Management Interface ============
    function withdrawFundingAssets() external;
    function withdrawManageFee() external;

    // ============ Status Query Interface ============
    function isFundingSuccessful() external view returns (bool);
    function isFundingPeriodActive() external view returns (bool);
    function getTotalRaised() external view returns (uint256);
    function getRemainingSupply() external view returns (uint256);
    
    // ============ Signature Query Interface ============
    function getCallerNonce(address caller) external view returns (uint256);
    
    // ============ Manager Management Interface ============
    function setManager(address newManager) external;
    function setOffchainManager(address newOffchainManager) external;
}
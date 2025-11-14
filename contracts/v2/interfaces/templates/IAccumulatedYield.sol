// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/
*/
pragma solidity ^0.8.26;

/**
 * @title IAccumulatedYield
 * @dev Accumulated yield contract interface based on sushiswap's masterchef algorithm
 */
interface IAccumulatedYield {
    // ============ Struct Definitions ============

    /**
     * @dev Global pool information structure
     */
    struct GlobalPoolInfo {
        uint256 totalAccumulatedShares;     // Total accumulated shares in the yield pool
        uint256 lastDividendTime;          // Last dividend distribution time
        uint256 totalDividend;             // Total dividend amount distributed
        address shareToken;                // Address of the share token (user's share certificate)
        address rewardToken;               // Address of the reward token (USDT and other stablecoins)
    }
    
    /**
     * @dev User information structure
     */
    struct UserInfo {
        uint256 accumulatedShares;         // User's current accumulated shares
        uint256 lastClaimTime;             // Last claim time
        uint256 lastClaimDividend;         // Total dividend amount at last claim
        uint256 totalClaimed;              // Total claimed amount
    }
    


    // ============ Event Definitions ============
    
    /**
     * @dev Global pool initialization event
     */
    event GlobalPoolInitialized(
        address indexed shareToken,
        address indexed rewardToken,
        uint256 timestamp
    );
    
    /**
     * @dev Dividend distribution event
     */
    event DividendDistributed(
        uint256 amount,
        uint256 timestamp,
        address indexed validator,
        bytes signature
    );
    
    /**
     * @dev Reward claim event
     */
    event RewardClaimed(
        address indexed user,
        uint256 claimedRewardAmount,
        uint256 timestamp
    );
    
    /**
     * @dev User pool update event
     */
    event UserPoolUpdated(
        address indexed user,
        uint256 newAccumulatedShares,
        uint256 timestamp
    );
    
    /**
     * @dev Token transfer event (for tracking transfers that affect yield)
     */
    event ShareTokenTransferred(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );
    
    /**
     * @dev Manager changed event
     */
    event ManagerChanged(
        address indexed oldManager,
        address indexed newManager
    );

    /**
     * @dev Settlement event
     */
    event Settled(
        uint256 settleAmount,
        uint256 settlePrice,
        uint256 timestamp
    );

    /**
     * @dev Withdraw event
     */
    event Withdraw(
        address user,
        uint256 shareAmount,
        uint256 withdrawAmount,
        uint256 timestamp
    );


    // ============ User Operation Interface ============
    
    /**
     * @dev User claim rewards
     */
    function claimReward() external;
    
    // ============ Yield Distribution Interface ============
    
    /**
     * @dev Distribute dividend to global pool
     * @param dividendAmount Distribution amount
     * @param signature Dividend signature
     */
    function distributeDividend(
        uint256 dividendAmount,
        bytes memory signature
    ) external;
    
    // ============ Token Transfer Related Interface ============
    
    /**
     * @dev Update user pools on token transfer (core functionality)
     * @param from Transfer from address
     * @param to Transfer to address
     * @param amount Transfer amount
     * 
     * Note: This function should be called in the following cases:
     * - User-to-user transfers
     */
    function updateUserPoolsOnTransfer(
        address from,
        address to,
        uint256 amount
    ) external;
    
    // ============ Query Interface ============

    /**
     * @dev Query user information
     * @param user User address
     * @return User information structure
     */
    function getUserInfo(address user) external view returns (UserInfo memory);

    /**
     * @dev Query user's pending rewards
     * @param user User address
     * @return Pending reward amount
     */
    function pendingReward(address user) external view returns (uint256);

    /**
     * @dev Query global pool total dividend amount
     * @return Total dividend amount
     */
    function totalDividend() external view returns (uint256);
    
    /**
     * @dev Query global pool total accumulated shares
     * @return Total accumulated shares
     */
    function totalAccumulatedShares() external view returns (uint256);

    /**
     * @dev get demanded dividend nonce
     * @return dividend nonce
     */
    function getDividendNonce() external view returns (uint256);
    

    // ============ Unified Initialization Interface ============
    function initiate(address _vault, address _vaultToken, bytes memory _initData) external;

}
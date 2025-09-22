// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


interface  IFundYield {

    enum EpochStatus {
        NotActive,
        Active,
        Lock,
        Liquidate
    }
    struct RedemptionRequest {
        uint256 requestShares;
        uint256 claimShares;
        uint256 claimAssets;
        uint256 lastRequestTimeStamp;
        uint256 lastClaimTimeStamp;
    }
    struct RedemptionEpoch {
        uint256 totalShares;
        uint256 totalRedemptionAssets;
        uint256 totalClaimedAssets;
        EpochStatus epochStatus;
    }

    function requestRedemption(uint256 shareAmount) external;
    function cancelRedemption() external;
    function changeEpoch() external;
    function finishRedemptionEpoch(uint256 epochId,uint256 assetAmount,bytes memory signature) external;
    function claimRedemption(uint256 epochId) external;
    function getEpochData(uint256 epoch) external view returns (RedemptionEpoch memory);
    function getRedemptionRequest(uint256 epoch) external view returns (RedemptionRequest memory);
    function pendingReward(address user,uint256 epochId) external view returns (uint256);

    event RedemptionRequested(address requester,uint256 epoch,uint256 shareAmount);
    event RedemptionEpochChanged(uint256 epoch);
    event RedemptionCancelled(address requester,uint256 epoch,uint256 shareAmount);
    event RedemptionEpochLiquidated(address settler,uint256 epochId,uint256 assetAmount,bytes signature);
    event RedemptionClaim(address requester,uint256 epochId,uint256 shareAmount,uint256 assetAmount);
    event Initialized(address vault,address vaultToken,address rewardToken,address manager,address settleCaller,uint256 minRedemptionAmount,uint256 startTime);
    event StartTimeSet(uint256 startTime);


}
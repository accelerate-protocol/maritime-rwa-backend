// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

struct VaultDeployData {
    uint64 vaultId;
    string name;
    string symbol;
    address assetToken;
    address rbf;
    uint256 subStartTime;
    uint256 subEndTime;
    uint256 duration;
    uint256 fundThreshold;
    uint256 minDepositAmount;
    uint256 manageFee;
    address manager;
    address feeReceiver;
    address[] whitelists;
    address guardian;
}
interface IVaultRouter {
    event DeployVaultEvent(
        uint64 vaultId,
        address vault,
        address dividendEscrow
    );

    function deployVault(VaultDeployData memory vaultDeployData) external;
    
}
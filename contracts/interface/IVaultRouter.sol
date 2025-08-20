// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/

*/
pragma solidity 0.8.26;

struct VaultDeployData {
    uint64 vaultId;
    string name;
    string symbol;
    uint8 decimals;
    address assetToken;
    address rbf;
    uint256 maxSupply;
    uint256 subStartTime;
    uint256 subEndTime;
    uint256 duration;
    uint256 fundThreshold;
    uint256 financePrice;
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
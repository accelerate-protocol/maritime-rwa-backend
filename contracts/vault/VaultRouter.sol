// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../common/Escrow.sol";
import "./Vault.sol";
import "../interface/IEscrowFactory.sol";
import "../interface/IVaultFactory.sol";

struct VaultInfo{
        uint256 createdAt;
        address vault;
        address feeEscrow;
    }

    struct VaultDeployData{
        string  name;
        string  symbol;
        address assetToken;
        address rbuManager;
        uint256 maxSupply;
        uint256 subStartTime;
        uint256 subEndTime;
        uint256 duration;
        uint256 fundThreshold;
        uint256 minDepositAmount;
        uint256 managerFee;
        address manager;
    }

contract VaultRouter is Ownable {
     event DeployVaultEvent(uint64 vaultId,address vault,address feeEscrow);

    IEscrowFactory public escrowFactory;
    IVaultFactory public vaultFactory;
    uint64 public vaultNonce;
    mapping(uint64 => VaultInfo) internal vaults;

    constructor(
        address _escrowFactory,
        address _vaultFactory
    ) Ownable() {
       escrowFactory = IEscrowFactory(_escrowFactory);
       vaultFactory = IVaultFactory(_vaultFactory);
    }

    function deployVault(
        VaultDeployData memory vaultDeployData
    ) public{
        address escrow = escrowFactory.newEscrow(address(this));
        uint64 vaultId = vaultNonce;
        address vault = vaultFactory.newVault(
            vaultDeployData.name,
            vaultDeployData.symbol,
            vaultDeployData.assetToken,
            vaultDeployData.rbuManager,
            address(escrow),
            vaultDeployData.manager
        );
        Vault(vault).setMaxsupply(vaultDeployData.maxSupply);
        Vault(vault).setSubTime(vaultDeployData.subStartTime,vaultDeployData.subEndTime);
        Vault(vault).setDuration(vaultDeployData.duration);
        Vault(vault).setFundThreshold(vaultDeployData.fundThreshold);
        Vault(vault).setMinDepositAmount(vaultDeployData.minDepositAmount);
        Vault(vault).setManagerFee(vaultDeployData.managerFee);
    
        Escrow(escrow).approveMax(vaultDeployData.assetToken,vault);
        vaults[vaultId] = VaultInfo(block.timestamp,vault,escrow);
        Escrow(escrow).rely(address(vault));
        Escrow(escrow).deny(address(this));
        vaultNonce++;

        emit DeployVaultEvent(vaultId,vault,escrow);
    }

    function getVaultInfo(uint64 vaultId) public view returns (uint256,address,address) {
        VaultInfo memory vault= vaults[vaultId];
        return (vault.createdAt,vault.vault,vault.feeEscrow);
    }

}
// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../common/Escrow.sol";
import "./Vault.sol";
import "../interface/IEscrowFactory.sol";
import "../interface/IVaultFactory.sol";
import "../interface/IVaultRouter.sol";
import "../rbf/RBF.sol";

/**
 * @author  tmpAuthor
 * @title   VaultRouter
 * @dev     Manages the deployment of vaults and associated escrow contracts.
 * @notice  This contract allows users to deploy new vaults and retrieve vault information.
 */
contract VaultRouter is Ownable,IVaultRouter {
    struct VaultInfo {
        uint256 createdAt;
        address vault;
        address vaultProxyAdmin;
        address vaultImpl;
        address dividendEscrow;
    }
    struct VaultData {
        string name;
        string symbol;
        address assetToken;
        address rbuManager;
        address feeEscrow;
        address dividendEscrow;
        address manager;
    }

    IEscrowFactory public immutable escrowFactory;
    IVaultFactory public immutable vaultFactory;
    uint64 public vaultNonce;
    mapping(uint64 => VaultInfo) private vaults;
    mapping(address => bool) public rbfVaultExist;

    /**
     * @dev Constructor initializes the VaultRouter with escrow and vault factory addresses.
     * @param _escrowFactory Address of the escrow factory contract.
     * @param _vaultFactory Address of the vault factory contract.
     */
    constructor(address _escrowFactory, address _vaultFactory) Ownable() {
        escrowFactory = IEscrowFactory(_escrowFactory);
        vaultFactory = IVaultFactory(_vaultFactory);
    }

    /**
     * @dev Deploys a new vault using provided deployment data.
     * @param vaultDeployData Struct containing vault initialization parameters.
     * @notice Only the owner of the associated RBF contract can deploy a vault.
     */
    function deployVault(VaultDeployData memory vaultDeployData) public {
        require(vaultDeployData.vaultId == vaultNonce, "Invalid vaultId");
        uint64 vaultId=vaultDeployData.vaultId;
        vaultNonce++;

        require(RBF(vaultDeployData.rbf).owner() == msg.sender,"only rbf owner can deploy vault");
        require(!rbfVaultExist[vaultDeployData.rbf],"rbf vault already exist");
        rbfVaultExist[vaultDeployData.rbf]=true;
        address dividendEscrow = escrowFactory.newEscrow(address(this));

        VaultInitializeData memory data=VaultInitializeData({
            name: vaultDeployData.name,
            symbol: vaultDeployData.symbol,
            assetToken: vaultDeployData.assetToken,
            rbf: vaultDeployData.rbf,
            subStartTime: vaultDeployData.subStartTime,
            subEndTime: vaultDeployData.subEndTime,
            duration: vaultDeployData.duration,
            fundThreshold: vaultDeployData.fundThreshold,
            minDepositAmount: vaultDeployData.minDepositAmount,
            manageFee: vaultDeployData.manageFee,
            manager: vaultDeployData.manager,
            feeReceiver:vaultDeployData.feeReceiver,
            dividendEscrow: dividendEscrow,
            whitelists:vaultDeployData.whitelists
        });

        (address vault,address vaultProxyAdmin,address vaultImpl) = vaultFactory.newVault(data,vaultDeployData.guardian);
         vaults[vaultId] = VaultInfo(
            block.timestamp,
            vault,
            vaultProxyAdmin,
            vaultImpl,
            dividendEscrow
        );
        Escrow(dividendEscrow).approveMax(vaultDeployData.assetToken, vault);
        Escrow(dividendEscrow).rely(address(vault));
        Escrow(dividendEscrow).deny(address(this));
        Vault(vault).transferOwnership(msg.sender);
        emit DeployVaultEvent(vaultId, vault, dividendEscrow);
    }

    /**
     * @dev Retrieves information about a deployed vault.
     * @param vaultId The unique ID of the vault.
     * @return VaultInfo struct containing details of the vault.
     */
    function getVaultInfo(
        uint64 vaultId
    ) public view returns (VaultInfo memory) {
        VaultInfo memory vault = vaults[vaultId];
        return vault;
    }
}

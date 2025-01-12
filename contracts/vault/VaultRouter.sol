// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.0;

// import "@openzeppelin/contracts/access/Ownable.sol";
// import "../common/Escrow.sol";
// import "./Vault.sol";


// contract VaultRouter is Ownable {
//      event DeployVaultEvent(uint64 vaultId,address vault,address feeEscrow);


//     struct VaultInfo{
//         uint256 createdAt;
//         address vault;
//         address feeEscrow;
//     }

//     struct VaultDeployData{
//         string  name,  
//         string  symbol,
//         address assetToken,
//         address rbuManager,


//     }

//     uint64 public vaultNonce;
//     mapping(uint64 => VaultInfo) internal vaults;

//     constructor() Ownable() {}

//     function deployVault(
//         string memory _name,  
//         string memory _symbol,
//         address _assetToken,
//         address _rbuManager,
//         uint256 _maxSupply,
//         uint256 _subStartTime,
//         uint256 _subEndTime,
//         uint256 _duration,
//         uint256 _fundThreshold,
//         uint256 _minDepositAmount,
//         uint256 _managerFee,
//         address _manager
//     ) public{
//         // Escrow escrow = new Escrow(address(this));
//         // Vault vault = new Vault(
//         //     _name,
//         //     _symbol,
//         //     _assetToken,
//         //     _rbuManager,
//         //     address(escrow),
//         //     _manager
//         // );
//         // vault.setMaxsupply(_maxSupply);
//         // vault.setSubTime(_subStartTime,_subEndTime);
//         // vault.setDuration(_duration);
//         // vault.setFundThreshold(_fundThreshold);
//         // vault.setMinDepositAmount(_minDepositAmount);
//         // vault.setManagerFee(_managerFee);
//         // uint64 vaultId = vaultNonce;
//         // escrow.approveMax(_assetToken,address(vault));
//         // vaults[vaultId] = VaultInfo(block.timestamp, address(vault),address(escrow));
//         // escrow.rely(address(vault));
//         // escrow.deny(address(this));
//         // vaultNonce++;

//         // emit DeployVaultEvent(vaultId,address(vault),address(escrow));

//     }

//     function getVaultInfo(uint64 vaultId) public view returns (uint256,address,address) {
//         VaultInfo memory vault= vaults[vaultId];
//         return (vault.createdAt,vault.vault,vault.feeEscrow);
//     }

// }
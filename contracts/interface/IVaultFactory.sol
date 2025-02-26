// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import "../vault/Vault.sol";
interface IVaultFactory {
    function newVault(
        VaultInitializeData memory data,
        address guardian
    ) external returns (address,address,address); 
}
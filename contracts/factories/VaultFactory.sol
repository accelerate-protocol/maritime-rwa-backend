// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "../interface/IVaultFactory.sol";
import "../common/Auth.sol";
import "../vault/Vault.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @author  tmpAuthor
 * @title   VaultFactory
 * @dev     This contract is responsible for deploying and managing instances of the Vault contract.
 * @notice  This contract serves as a Factory for the upgradable Vault token contract.
 *          Upon calling `newVault` the caller address will
 *          deploy the following:
 *          1) Vault - The implementation contract, ERC20Upgradeable contract with the constructor disabled
 *          2) ProxyAdmin - OZ ProxyAdmin contract, used to upgrade the proxy instance.
 *                          Owner is set to `guardian` address.
 *          3) TransparentUpgradeableProxy - OZ TransparentUpgradeableProxy contract, used to proxy the implementation.
 *          Following the above mentioned deployment, the address of the VaultFactory contract will:
 *          i) Transfer ownership of the ProxyAdmin to that of the `guardian` address.
 *          ii) Transfer ownership of the vaultProxied to that of the `msg.sender` address.
 */
contract VaultFactory is Auth, IVaultFactory {
    event VaultDeployed(
        address proxy,
        address proxyAdmin,
        address implementation,
        address guardian
    );

    /**
     * @notice Constructor function that initializes the contract and sets the deployer as the authorized user.
     * @dev Inherits from the Auth contract to implement access control.
     * @param deployer The address of the entity deploying the contract, serving as the initial administrator.
     */
    constructor(address deployer) Auth(deployer) {}

    /**
     * @notice  Creates a new instance of the Vault contract using an upgradeable proxy.
     * @dev     Deploys a new implementation of Vault, a ProxyAdmin, and a TransparentUpgradeableProxy.
     *          Transfers ownership of the proxy admin to the guardian and the Vault to the caller.
     * @param   data  The initialization data for the Vault contract.
     * @param   guardian  The address that will take ownership of the proxy admin.
     * @return  address   The address of the newly created Vault proxy contract.
     * @return  address   The address of the newly created proxy admin contract.
     * @return  address   The address of the newly created Vault implementation contract.
     */
    function newVault(
        VaultInitializeData memory data,
        address guardian
    ) public override auth returns (address, address, address) {
        Vault vaultImplementation = new Vault();
        ProxyAdmin vaultProxyAdmin = new ProxyAdmin();
        TransparentUpgradeableProxy vaultProxy = new TransparentUpgradeableProxy(
                address(vaultImplementation),
                address(vaultProxyAdmin),
                ""
            );
        Vault vaultProxied = Vault(address(vaultProxy));
        vaultProxied.initialize(data);
        vaultProxyAdmin.transferOwnership(guardian);
        vaultProxied.transferOwnership(msg.sender);
        emit VaultDeployed(
            address(vaultProxy),
            address(vaultProxyAdmin),
            address(vaultImplementation),
            guardian
        );

        return (
            address(vaultProxy),
            address(vaultProxyAdmin),
            address(vaultImplementation)
        );
    }
}

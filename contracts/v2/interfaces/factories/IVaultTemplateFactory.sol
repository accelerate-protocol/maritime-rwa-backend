// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


interface IVaultTemplateFactory{

     event VaultDeployed(
        address proxy,
        address proxyAdmin,
        address implementation,
        address guardian
    );

    function newVault(
        bytes memory initData,
        address guardian
    ) external returns (address, address, address);

}
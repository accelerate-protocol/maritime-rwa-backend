// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface IVaultFactory {

    function newVault(
        string memory _name,  
        string memory _symbol,
        address _assetToken,
        address _rbuManager,
        address _feeEscrow,
        address _manager
    ) external returns (address); 

}
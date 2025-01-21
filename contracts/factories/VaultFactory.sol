// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interface/IVaultFactory.sol";
import "../common/Auth.sol";
import "../vault/Vault.sol";

contract VaultFactory is Auth, IVaultFactory {

    constructor(address deployer) Auth(deployer) {}

    function newVault(
        string memory _name,  
        string memory _symbol,
        address _assetToken,
        address _rbuManager,
        address _feeEscrow,
        address _dividendEscrow
    ) public auth override returns (address){
        Vault vault = new Vault(
            _name,
            _symbol,
            _assetToken,
            _rbuManager,
            _feeEscrow,
            _dividendEscrow
        );
        vault.transferOwnership(msg.sender);
        return address(vault);
    }

}
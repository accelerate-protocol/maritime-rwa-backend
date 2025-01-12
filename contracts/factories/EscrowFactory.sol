// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interface/IEscrowFactory.sol";
import "../common/Auth.sol";
import "../common/Escrow.sol";


contract EscrowFactory is Auth, IEscrowFactory {
    constructor(address deployer) Auth(deployer) {}

    function newEscrow(address deployer) public auth override returns (address) {
        Escrow escrow = new Escrow(deployer);
        return address(escrow);
    }

}
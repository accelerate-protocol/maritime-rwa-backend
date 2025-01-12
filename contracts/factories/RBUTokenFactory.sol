// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interface/IRBUTokenFactory.sol";
import "../common/Auth.sol";
import "../rbu/RBUToken.sol";

contract RBUTokenFactory is Auth, IRBUTokenFactory {

    constructor(address deployer) Auth(deployer) {}

    function newRBUToken(
        string memory _name,
        string memory _symbol,
        address rbuManager
    ) public auth override returns (address) {
        RBUToken rbuToken = new RBUToken(_name,_symbol,rbuManager);
        return address(rbuToken);
    }

}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interface/IPricerFactory.sol";
import "../common/Auth.sol";
import "../rbu/Pricer.sol";


contract PricerFactory is Auth, IPricerFactory {
    constructor(address deployer) Auth(deployer) {}

    function newPricer(
        address _admin,
        uint256 _initialPrice
    ) public auth override returns (address){
        Pricer pricer = new Pricer(_admin, _initialPrice);
        return address(pricer);
    }
}








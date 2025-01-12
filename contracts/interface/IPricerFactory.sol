// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface IPricerFactory {
    
    function newPricer(
        address _admin,
        uint256 _initialPrice
    ) external returns (address);

}
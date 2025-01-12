// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface IRBUTokenFactory {
    function newRBUToken(
        string memory _name,
        string memory _symbol,
        address rbuManager
    ) external returns (address);
}


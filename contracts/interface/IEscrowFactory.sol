// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface IEscrowFactory {
    function newEscrow(
        address deployer
    ) external returns (address);
}
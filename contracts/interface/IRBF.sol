// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IRBF {

    event DepositEvent(
        address depositor,
        uint256 amount
    );
    
    event DepositDataEvent(
        uint256 depositPirce,
        uint256 depositMintAmount
    );

    event SetVault(address vault);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


interface IRBUManagerFactory {
    function newRBUManager(
        address _assetToken,
        uint256 _maxSupply,
        address _depositTreasury,
        address _withdrawTreasury,
        address _manager,
        address _owner
    ) external returns (address);
}


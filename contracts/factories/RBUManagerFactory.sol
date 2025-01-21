// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interface/IRBUManagerFactory.sol";
import "../common/Auth.sol";
import "../rbu/RBUManager.sol";

contract RBUManagerFactory is Auth, IRBUManagerFactory {
    constructor(address deployer) Auth(deployer) {}

    function newRBUManager(
        address _assetToken,
        uint256 _maxSupply,
        address _depositTreasury,
        address _withdrawTreasury,
        address _dividendTreasury,
        address _manager
    ) public auth override returns (address){
        RBUManager rbuManager = new RBUManager(
            _assetToken,
            _maxSupply,
            _depositTreasury,
            _withdrawTreasury,
            _dividendTreasury,
            _manager
        );
        rbuManager.transferOwnership(msg.sender);
        return address(rbuManager);
    }
}
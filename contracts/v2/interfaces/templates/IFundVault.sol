// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./IVault.sol";

interface IFundVault is IVault {

    struct RoundData {
        uint256 price;
        uint256 startedAt;
    }

    function isFundSuccessful() external view returns (bool);
    function addPrice(uint256 sharePrice) external;
    function getRoundData(uint256 roundId) external view returns (RoundData memory);
    function lastestRoundData() external view returns (RoundData memory);
    function lastestPrice() external view returns (uint256);

    event PriceUpdated(uint256 roundId, uint256 price, uint256 timestamp);

} 
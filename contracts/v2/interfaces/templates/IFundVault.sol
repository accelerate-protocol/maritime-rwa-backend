// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/
*/
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
    function priceDecimals() external view returns (uint8);

    event PriceUpdated(uint256 roundId, uint256 price, uint256 timestamp);

} 
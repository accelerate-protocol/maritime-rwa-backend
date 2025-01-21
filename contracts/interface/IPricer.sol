// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPricer {
    function getPrice(uint256 priceId) external view returns (uint256);
    function getLatestPrice() external view returns (uint256);
    function addPrice(uint256 price, uint256 timestamp) external;
}




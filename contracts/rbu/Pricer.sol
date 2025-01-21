// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interface/IPricer.sol";

contract Pricer is IPricer, AccessControl {
    struct PriceInfo {
        uint256 price;
        uint256 timestamp;
    }

    mapping(uint256 => PriceInfo) public prices;
    uint256[] public priceIds;
    uint256 public currentPriceId;
    uint256 public latestPriceId;
    mapping(address => bool) public whiteList;

    modifier onlyWhiteList(address _address) {
        require(whiteList[_address], "Not white list");
        _;
    }

    constructor(address _admin, uint256 _initialPrice) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _addPrice(_initialPrice, block.timestamp);
    }

    function addWhiteListAddr(
        address _address
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_address != address(0), "Invalid address");
        whiteList[_address] = true;
    }

    function removeWhiteListAddr(
        address _address
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_address != address(0), "Invalid address");
        whiteList[_address] = false;
    }

    // function setChallengeUpdateRole(
    //     address _address
    // ) external onlyRole(DEFAULT_ADMIN_ROLE) {
    //     _grantRole(CHALLENGE_UPDATE_ROLE, _address);
    // }

    function addPrice(
        uint256 price,
        uint256 timestamp
    ) external virtual override onlyWhiteList(msg.sender) {
        _addPrice(price, timestamp);
    }

    // function challengeUpdatePrice(
    //     uint256 priceId,
    //     uint256 price,
    //     uint256 timestamp
    // ) external virtual override onlyRole(CHALLENGE_UPDATE_ROLE) {
    //     require(priceId == latestPriceId, "Only lastPrice can be challenged");
    //     require(
    //         block.timestamp < prices[latestPriceId].challengeTime,
    //         "Not exst wait challenge price"
    //     );
    //     PriceInfo memory oldPriceInfo = prices[priceId];
    //     require(oldPriceInfo.price != price, "price must be different");
    //     prices[priceId] = PriceInfo(price, timestamp, block.timestamp);
    //     emit PriceChallenged(priceId, oldPriceInfo.price, price);
    // }

    function _addPrice(
        uint256 price,
        uint256 timestamp
    ) internal {
        // Set price
        uint256 priceId = ++currentPriceId;
        prices[priceId] = PriceInfo(price, timestamp);
        priceIds.push(priceId);

        // Update latestPriceId
        if (timestamp > prices[latestPriceId].timestamp) {
            latestPriceId = priceId;
        }

        emit PriceAdded(priceId, price, timestamp);
    }

    function getPrice(
        uint256 priceId
    ) external view override returns (uint256) {
        return prices[priceId].price;
    }

    function getPriceInfo(uint256 priceId) external view returns (uint256, uint256) {
        return (prices[priceId].price, prices[priceId].timestamp);
    }

    function getLatestPrice() external view override returns (uint256) {
       return prices[latestPriceId].price;
    }

    function getLastPriceId() public view returns (uint256) {
        return latestPriceId;
    }



    event PriceAdded(uint256 indexed priceId, uint256 price, uint256 timestamp);
}

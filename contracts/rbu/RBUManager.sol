// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../vault/Vault.sol";
import "../interface/IPricer.sol";
import "../interface/IRBUToken.sol";
import "../interface/IRBUManager.sol";

contract RBUManager is IRBUManager, Ownable, AccessControl {
    event DepositEvent(
        address receiver,
        uint256 amount,
        uint256 feeAmount,
        uint256 actualAmount,
        uint256 mintAmount
    );
    event WithdrawEvent(
        address receiver,
        uint256 amount,
        uint256 withdrawAmount
    );

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 public constant BPS_DENOMINATOR = 10_000;

    address public assetToken;
    address public rbuToken;
    string public tokenURI;
    uint256 public maxSupply;
    uint256 public activeStartTime;
    uint256 public activeEndTime;
    uint256 public minDepositAmount;
    uint256 public managerFee;
    address public depositTreasury;
    address public withdrawTreasury;
    address public dividendTreasury;
    address public price;
    uint256 public decimalsMultiplier;
    address public manager;
    uint256 public lockSupply;

    mapping(address => bool) private whitelist;
    address[] private whitelistedAddresses;

    modifier onlyWhiteList(address _address) {
        require(whitelist[_address], "Not white list");
        _;
    }

    constructor(
        address _assetToken,
        uint256 _maxSupply,
        address _depositTreasury,
        address _withdrawTreasury,
        address _dividendTreasury,
        address _manager
    ) Ownable() {
        require(
            _assetToken != address(0),
            "AssetToken address cannot be zero address"
        );
        assetToken = _assetToken;
        require(_maxSupply > 0, "Max supply must be greater than 0");
        maxSupply = _maxSupply;
        require(
            _depositTreasury != address(0),
            "Treasury address cannot be zero address"
        );
        depositTreasury = _depositTreasury;
        require(
            _withdrawTreasury != address(0),
            "Treasury address cannot be zero address"
        );
        withdrawTreasury = _withdrawTreasury;
        require(
            _dividendTreasury != address(0),
            "Treasury address cannot be zero address"
        );
        dividendTreasury = _dividendTreasury;
        require(
            _manager != address(0),
            "Manager address cannot be zero address"
        );
        manager = _manager;
        _grantRole(MANAGER_ROLE, _manager);
    }

    function setActiveTime(
        uint256 _activeStartTime,
        uint256 _activeEndTime
    ) public onlyOwner {
        require(
            _activeStartTime < _activeEndTime,
            "active start time must be less than active end time"
        );
        activeStartTime = _activeStartTime;
        activeEndTime = _activeEndTime;
    }

    function setMinDepositAmount(uint256 _minDepositAmount) public onlyOwner {
        require(
            _minDepositAmount > 0 && _minDepositAmount <= maxSupply,
            "Min deposit amount must be greater than 0 and less than max supply"
        );
        minDepositAmount = _minDepositAmount;
    }

    function setManagerFee(uint256 _managerFee) public onlyOwner {
        require(
            _managerFee <= BPS_DENOMINATOR,
            "Manager fee must be less than or equal to 100%"
        );
        managerFee = _managerFee;
    }

    function setRBUToken(
        address _rbuToken,
        address _rbuTokenPrice
    ) external onlyOwner {
        require(rbuToken == address(0), "Token URI already set");
        require(price == address(0), "Price already set");
        require(
            _rbuToken != address(0),
            "Token address cannot be zero address"
        );
        require(
            _rbuTokenPrice != address(0),
            "Price address cannot be zero address"
        );
        rbuToken = _rbuToken;
        price = _rbuTokenPrice;
        decimalsMultiplier =
            10 **
                (IERC20Metadata(_rbuToken).decimals() -
                    IERC20Metadata(assetToken).decimals());
    }

    function deposit(
        uint256 amount
    ) external override onlyWhiteList(msg.sender) {
        require(
            block.timestamp >= activeStartTime &&
                block.timestamp <= activeEndTime,
            "Active period has not started yet"
        );
        require(
            IERC20(assetToken).balanceOf(msg.sender) >= amount,
            "Insufficient balance"
        );
        require(rbuToken != address(0), "Token address cannot be zero address");
        require(
            amount > minDepositAmount,
            "Deposit amount must be greater than min deposit amount"
        );

        uint256 amountFee = (amount * managerFee) / BPS_DENOMINATOR;
        SafeERC20.safeTransferFrom(
            IERC20(assetToken),
            msg.sender,
            address(this),
            amountFee
        );
        SafeERC20.safeTransferFrom(
            IERC20(assetToken),
            msg.sender,
            depositTreasury,
            amount
        );

        uint256 tokenPrice = IPricer(price).getLatestPrice();
        uint256 rwaAmount = _getMintAmountForPrice(amount, tokenPrice);
        require(
            IRBUToken(rbuToken).totalSupply() + rwaAmount <= maxSupply,
            "Max supply exceeded"
        );
        IRBUToken(rbuToken).mint(msg.sender, rwaAmount);

        emit DepositEvent(
            msg.sender,
            amount,
            amountFee,
            amount,
            rwaAmount
        );
    }

    function withdraw(
        uint256 sharesAmount
    ) external override onlyWhiteList(msg.sender) {
        require(
            block.timestamp >= activeEndTime,
            "Withdraw period has not started yet"
        );
        require(
            IRBUToken(rbuToken).balanceOf(msg.sender) >= sharesAmount,
            "Insufficient balance"
        );
        uint256 tokenPrice = IPricer(price).getLatestPrice();
        uint256 withdrawAmount = _getWithdrawAmountForRwa(
            sharesAmount,
            tokenPrice
        );
        SafeERC20.safeTransferFrom(
            IERC20(assetToken),
            withdrawTreasury,
            msg.sender,
            withdrawAmount
        );
        IRBUToken(rbuToken).burn(msg.sender, sharesAmount);
        emit WithdrawEvent(msg.sender, sharesAmount, withdrawAmount);
    }

    function getRBUShareToken() public view override returns (address) {
        return rbuToken;
    }

    function addToWhitelist(address _address) public onlyRole(MANAGER_ROLE) {
        require(!whitelist[_address], "Address is already whitelisted");
        whitelist[_address] = true;
        whitelistedAddresses.push(_address);
    }

    function removeFromWhitelist(
        address _address
    ) external onlyRole(MANAGER_ROLE) {
        require(whitelist[_address], "Address is not in the whitelist");
        whitelist[_address] = false;

        // 从数组中移除地址
        for (uint256 i = 0; i < whitelistedAddresses.length; i++) {
            if (whitelistedAddresses[i] == _address) {
                whitelistedAddresses[i] = whitelistedAddresses[
                    whitelistedAddresses.length - 1
                ];
                whitelistedAddresses.pop();
                break;
            }
        }
    }

    function getAllWhitelistedAddresses()
        external
        view
        returns (address[] memory)
    {
        return whitelistedAddresses;
    }

    function _getMintAmountForPrice(
        uint256 depositAmount,
        uint256 tokenPrice
    ) internal view returns (uint256) {
        uint256 rwaAmount = (_scaleUp(depositAmount) * 1e18) / tokenPrice;
        return rwaAmount;
    }

    function _getWithdrawAmountForRwa(
        uint256 rwaAmount,
        uint256 tokenPrice
    ) internal view returns (uint256) {
        uint256 withdrawAmount = _scaleDown((rwaAmount * tokenPrice) / 1e18);
        return withdrawAmount;
    }

    function _scaleUp(uint256 amount) internal view returns (uint256) {
        return amount * decimalsMultiplier;
    }

    function _scaleDown(uint256 amount) internal view returns (uint256) {
        return amount / decimalsMultiplier;
    }

    function dividend() public onlyRole(MANAGER_ROLE) {
        uint256 totalDividend = IERC20(assetToken).balanceOf(dividendTreasury);
        require(totalDividend > 0, "totalDividend must be greater than 0");
        uint256 totalSupply = IERC20(rbuToken).totalSupply();
        require(totalSupply > 0, "totalSupply must be greater than 0");
        for (uint8 i = 0; i < whitelistedAddresses.length; i++) {
            if (whitelist[whitelistedAddresses[i]]) {
                if (IERC20(rbuToken).balanceOf(whitelistedAddresses[i]) > 0) {
                    address dividendEscrow = Vault(whitelistedAddresses[i])
                        .getDividendEscrow();
                    require(dividendEscrow!=address(0),"dividendEscrow is zero");
                    _dividend(
                        IERC20(rbuToken).balanceOf(whitelistedAddresses[i]),
                        totalSupply,
                        totalDividend,
                        dividendEscrow
                    );
                }
            }
        }
    }

    function _dividend(
        uint256 rbuAmount,
        uint256 totalSupply,
        uint256 totalDividend,
        address receipter
    ) internal {
        uint256 dividendAmount = (rbuAmount * totalDividend) / totalSupply;
        require(dividendAmount>0, "dividendAmount must bigger than zero");
        SafeERC20.safeTransferFrom(
            IERC20(assetToken),
            dividendTreasury,
            receipter,
            dividendAmount
        );
    }

    function withdrawFee() external onlyOwner {
        uint256 balance = IERC20(assetToken).balanceOf(address(this));
        SafeERC20.safeTransfer(IERC20(assetToken), msg.sender, balance);
    }

    function getAssetsNav() public override view returns(uint256){
        uint256 lastPrice= IPricer(price).getLatestPrice();
        uint256 amount= IERC20(rbuToken).balanceOf(msg.sender);
        return amount*lastPrice/1e18;
    }


}

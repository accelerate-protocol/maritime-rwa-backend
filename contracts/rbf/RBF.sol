// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "../vault/Vault.sol";
import "../interface/AggregatorV3Interface.sol";
import "../interface/IRBF.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

struct RBFInitializeData {
    string name;
    string symbol;
    address assetToken;
    uint256 maxSupply;
    uint256 manageFee;
    address depositTreasury;
    address dividendTreasury;
    address priceFeed;
    address manager;
}

/**
 * @author  tmpAuthor
 * @title   RBF
 * @dev     A contract for handling deposit and minting of RBF tokens, managing dividends, and controlling access by the manager.
 * @notice  This contract allows deposits in an underlying asset token and mints a corresponding amount of RBF tokens based on the deposit and the asset's price. It also supports dividend distribution and fee management by manager.
 */
contract RBF is IRBF, OwnableUpgradeable, ERC20Upgradeable {
    using SafeERC20 for IERC20;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    address public assetToken;
    uint256 public maxSupply;
    address public depositTreasury;
    address public dividendTreasury;
    AggregatorV3Interface public priceFeed;
    address public manager;
    uint256 public manageFee;
    uint256 public decimalsMultiplier;
    address public vault;

    modifier onlyVault() {
        require(msg.sender == vault, "RBF: you are not vault");
        _;
    }

    modifier onlyManager() {
        require(msg.sender == manager, "RBF: you are not manager");
        _;
    }

    /**
     * @dev  Constructor function to disable initializers
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice  Initializes the RBF contract with required parameters.
     * @param   data  Initialization data containing contract configuration.
     */
    function initialize(RBFInitializeData memory data) public initializer {
        __ERC20_init(data.name, data.symbol);
        __Ownable_init();

        require(
            data.assetToken != address(0),
            "RBF: assetToken address cannot be zero address"
        );
        assetToken = data.assetToken;
        require(data.maxSupply > 0, "RBF: maxSupply must be greater than 0");
        maxSupply = data.maxSupply;
        require(
            data.depositTreasury != address(0),
            "RBF: depositTreasury address cannot be zero address"
        );
        depositTreasury = data.depositTreasury;
        require(
            data.dividendTreasury != address(0),
            "RBF: dividendTreasury address cannot be zero address"
        );
        dividendTreasury = data.dividendTreasury;
        require(
            data.priceFeed != address(0),
            "RBF: priceFeedAddr can not be zero address"
        );
        priceFeed = AggregatorV3Interface(data.priceFeed);
        require(
            data.manager != address(0),
            "RBF: manager address can not be zero address"
        );
        manager = data.manager;
        decimalsMultiplier =
            10 ** (decimals() - IERC20MetadataUpgradeable(data.assetToken).decimals());
    }

    // /**
    //  * @notice  Allows the owner to set the manager's fee rate.
    //  * @dev     The fee rate is specified in basis points (bps) and should not exceed 100%.
    //  * @param   manageFeeRate  The fee rate to be set for the manager.
    //  */
    // function setManagerFee(uint256 manageFeeRate) public onlyOwner {
    //     require(
    //         manageFeeRate < BPS_DENOMINATOR,
    //         "RBF: manageFeeRate must be less than 100%"
    //     );
    //     manageFee = manageFeeRate;
    // }

    /**
     * @notice  Allows the vault to deposit the asset token and mint corresponding RBF tokens.
     * @dev     Deposits the asset token, deducts the manager's fee, and mints RBF tokens based on the asset's price.
     * @param   amount  The amount of asset token being deposited.
     */
    function deposit(uint256 amount) public onlyVault {
        require(
            IERC20(assetToken).balanceOf(msg.sender) >= amount,
            "RBF: Insufficient balance"
        );
        uint256 amountFee = (amount * manageFee) / BPS_DENOMINATOR;
        uint256 depositAmount = amount - amountFee;
        //totalDeposit = totalDeposit + depositAmount;
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
            depositAmount
        );
        uint256 rwaAmount = _getMintAmountForPrice(depositAmount);
        require(
            totalSupply() + rwaAmount <= maxSupply,
            "RBF: maxSupply exceeded"
        );
        _mint(msg.sender, rwaAmount);
        emit DepositEvent(
            msg.sender,
            amount,
            amountFee,
            depositAmount,
            rwaAmount
        );
    }

    /**
     * @notice  Allows the manager to set the vault contract address.
     * @dev     This function assigns the vault address, which interacts with the RBF contract.
     * @param   vaultAddr  The address of the vault to be set.
     */
    function setVault(address vaultAddr) public onlyManager {
        require(
            vaultAddr != address(0),
            "RBF: vaultAddr can not be zero address"
        );
        vault = vaultAddr;
    }

    /**
     * @notice  Allows the manager to distribute dividends from the dividend treasury to the vault.
     * @dev     This function calculates the dividend share for the vault and transfers the dividend amount.
     */
    function dividend() public onlyManager {
        uint256 totalDividend = IERC20(assetToken).balanceOf(dividendTreasury);
        require(totalDividend > 0, "RBF: totalDividend must be greater than 0");
        uint256 totalSupply = totalSupply();
        require(totalSupply > 0, "RBF: totalSupply must be greater than 0");
        require(vault != address(0), "RBF: vault can not be zero address");
        require(
            balanceOf(vault) > 0,
            "RBF: vault balance must be greater than 0"
        );
        address dividendEscrow = Vault(vault).dividendEscrow();
        require(
            dividendEscrow != address(0),
            "RBF: vault dividendEscrow cant not be zero"
        );
        _dividend(balanceOf(vault), totalSupply, totalDividend, dividendEscrow);
    }

    /**
     * @notice  Allows the owner to withdraw fees accumulated by the contract.
     * @dev     The contract owner can withdraw any asset token balance that has been collected as fees.
     */
    function withdrawFee() external onlyManager {
        uint256 balance = IERC20(assetToken).balanceOf(address(this));
        SafeERC20.safeTransfer(IERC20(assetToken), msg.sender, balance);
    }

    /**
     * @notice  Fetches the net asset value (NAV) of the user's RBF tokens based on the asset price.
     * @dev     This function calculates the NAV of the RBF tokens held by vault by fetching the latest price.
     * @return  uint256  The NAV in terms of the asset token's value.
     */
    function getAssetsNav() public view returns (uint256) {
        int256 lastPrice = getLatestPrice();
        uint256 amount = balanceOf(vault);
        uint256 indexDecimals = 10**priceFeedDecimals();
        return (amount * uint256(lastPrice)) / indexDecimals;
    }

    /**
     * @notice  Fetches the latest price of the asset token from the price feed.
     * @dev     This function interacts with the price feed contract to get the latest price of the asset token.
     * @return  int256  The latest price of the asset token.
     */
    function getLatestPrice() public view returns (int256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price data");
        return price;
    }

    /**
     * @notice  Fetches the decimal precision of the price feed.
     * @dev     This helps align the precision between asset price and RBF token calculations.
     * @return  uint8  The number of decimals used by the price feed.
     */
    function priceFeedDecimals() public view returns (uint8) {
        return priceFeed.decimals();
    }

    /**
     * @notice  Overrides the decimals function to return 6 decimals for the RBF token.
     *          Same as Stablecoins decimals
     * @dev     Sets the precision of the RBF token to 6 decimals.
     * @return  uint8  The number of decimals for the RBF token.
     */
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    function _dividend(
        uint256 rbfAmount,
        uint256 totalSupply,
        uint256 totalDividend,
        address receiver
    ) internal {
        uint256 dividendAmount = (rbfAmount * totalDividend) / totalSupply;
        require(
            dividendAmount > 0,
            "RBF: dividendAmount must greater than zero"
        );
        SafeERC20.safeTransferFrom(
            IERC20(assetToken),
            dividendTreasury,
            receiver,
            dividendAmount
        );
        emit dividendEvent(receiver, dividendAmount);
    }

    function _getMintAmountForPrice(
        uint256 depositAmount
    ) internal view returns (uint256) {
        uint256 tokenPrice = (uint256)(getLatestPrice());
        uint256 indexDecimals = 10**priceFeedDecimals();
        uint256 rwaAmount = (_scaleUp(depositAmount) * indexDecimals) / tokenPrice;
        return rwaAmount;
    }

    function _scaleUp(uint256 amount) internal view returns (uint256) {
        return amount * decimalsMultiplier;
    }
}

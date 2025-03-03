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
    string name; // The name of the RBF contract
    string symbol; // The symbol of the RBF contract (usually a ticker like "RBF")
    address assetToken; // The address of the ERC20 token used in the RBF contract (e.g., USDC, ETH)
    uint256 maxSupply; // The maximum supply of the RBF token, defining the total token limit in the contract
    uint256 manageFee; // The fee charged by the manager, usually a percentage of the amount handled
    address depositTreasury; // The address that receives the deposits from the vault
    address dividendTreasury; // The address where dividends (profits) will be stored and distributed
    address priceFeed; // The address of the price feed (e.g., Chainlink) to get the asset price for RBF calculations
    address manager; // The address of the contract manager who can dividend in the RBF contract
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
    // The address of the asset token that this contract interacts with (e.g., an ERC-20 token).
    address public assetToken;
    // The maximum supply of the asset token that can be issued by this contract.
    uint256 public maxSupply;
    // The address of the treasury that holds deposited assets.
    address public depositTreasury;
    // The address of the treasury responsible for distributing dividends to stakeholders.
    address public dividendTreasury;
    // The price feed contract used to fetch price data for the asset.
    AggregatorV3Interface public priceFeed;
    // The address of the manager who has administrative privileges over the contract.
    address public manager;
    // The management fee (expressed in basis points or a fixed value) charged for handling the asset.
    uint256 public manageFee;
    //  A multiplier used to adjust token decimals for precision in calculations.
    uint256 public decimalsMultiplier;
    // The address of the vault  which can deposit assetToken.
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
        manageFee = data.manageFee;
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
            10 **
                (decimals() -
                    IERC20MetadataUpgradeable(data.assetToken).decimals());
    }

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
            "RBF: vaultAddr cannot be zero address"
        );
        vault = vaultAddr;
        emit SetVault(vaultAddr);
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
        address vaultDividendTreasury = Vault(vault).dividendTreasury();
        require(
            vaultDividendTreasury != address(0),
            "RBF: vault dividendTreasury cant not be zero"
        );
        _dividend(balanceOf(vault), totalSupply, totalDividend, vaultDividendTreasury);
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
        uint256 indexDecimals = 10 ** priceFeedDecimals();
        return (amount * uint256(lastPrice)) / indexDecimals;
    }

    /**
     * @notice  Fetches the latest price of the asset token from the price feed.
     * @dev     This function interacts with the price feed contract to get the latest price of the asset token.
     * @return  int256  The latest price of the asset token.
     */
    function getLatestPrice() public view returns (int256) {
        (uint80 roundId, int256 price, uint256 startedAt,uint256 updatedAt,uint80 answeredInRound) = priceFeed.latestRoundData();
        require((roundId>0&&price>0&&startedAt>0&&updatedAt>0&&answeredInRound>0),"Invalid price data");
        return price;
    }

    /**
     * @notice  Retrieves the price data for a specific round.
     * @dev     This function queries the price feed contract to obtain the price corresponding to the provided round ID.
     *          It checks that the price is greater than zero to ensure the data is valid.
     * @param   round  The identifier of the round to fetch the price for.
     * @return  int256  The price of the asset for the specified round.
     */
    function getRoundPrice(uint80 round) public view returns (int256) {
        (uint80 roundId, int256 price, uint256 startedAt,uint256 updatedAt,uint80 answeredInRound) = priceFeed.getRoundData(round);
        require((roundId>0&&price>0&&startedAt>0&&updatedAt>0&&answeredInRound>0),"Invalid price data");
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
        emit DividendEvent(receiver, dividendAmount);
    }

    function _getMintAmountForPrice(
        uint256 depositAmount
    ) internal view returns (uint256) {
        uint256 tokenPrice = (uint256)(getLatestPrice());
        uint256 indexDecimals = 10 ** priceFeedDecimals();
        uint256 rwaAmount = (_scaleUp(depositAmount) * indexDecimals) /
            tokenPrice;
        return rwaAmount;
    }

    function _scaleUp(uint256 amount) internal view returns (uint256) {
        return amount * decimalsMultiplier;
    }
}

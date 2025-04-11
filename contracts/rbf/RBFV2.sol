// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/

*/
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "../vault/Vault.sol";
import "../interface/AggregatorV3Interface.sol";
import "../interface/IRBF.sol";


/**
 * @author  Accelerate Finance
 * @title   RBF
 * @dev     A contract for handling deposit and minting of RBF tokens, managing dividends, and controlling access by the manager.
 * @notice  This contract allows deposits in an underlying asset token and mints a corresponding amount of RBF tokens based on the deposit and the asset's price. It also supports dividend distribution and fee management by manager.
 */
contract RBFV2 is
    IRBF,
    OwnableUpgradeable,
    ERC20Upgradeable,
    AccessControlUpgradeable
{
    using SafeERC20 for IERC20;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant MINT_AMOUNT_SETTER_ROLE =
        keccak256("MINT_AMOUNT_SETTER_ROLE");
    // The address of the asset token that this contract interacts with (e.g., an ERC-20 token).
    address public assetToken;
    // The address of the treasury that holds deposited assets.
    address public depositTreasury; 
    // The address of the treasury responsible for distributing dividends to rbfholders.
    address public dividendTreasury;
    // The price feed contract used to fetch price data for the asset.  
    AggregatorV3Interface public priceFeed;
    // The address of the manager who has administrative privileges over the contract.
    address public manager;
    // The address of the vault  which can deposit assetToken.
    address public vault;
    // The amount of assetToken deposited into the depositTreasury.
    uint256 public depositAmount;
    // The price of RBF tokens minted for each assetToken deposited.
    uint256 public depositPrice;
    // The amount of RBF tokens minted for assetToken deposited.
    uint256 public depositMintAmount;
    // Multiplier to adjust decimals between assetToken and RBF token
    uint256 public decimalsMultiplier;
    // The URI of the rbf token. 
    string public tokenURI;

    modifier onlyVault() {
        require(msg.sender == vault, "RBF: you are not vault"); 
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

        _grantRole(DEFAULT_ADMIN_ROLE, data.manager);
        _grantRole(MANAGER_ROLE, data.manager);
        _setRoleAdmin(MINT_AMOUNT_SETTER_ROLE, MANAGER_ROLE);
    }

    /*//////////////////////////////////////////////////////////////
                  Deposit/Dividend Functions
    //////////////////////////////////////////////////////////////*/
    /**
     * @notice  Deposits assetToken into the RBF contract.
     * @dev     This function is only callable by the Vault.
     * @param   amount The amount of assetToken to deposit.
     */
    function requestDeposit(uint256 amount) public onlyVault { 
        require(
            IERC20(assetToken).balanceOf(msg.sender) >= amount,
            "RBF: Insufficient balance"
        );
        depositAmount += amount;
        SafeERC20.safeTransferFrom(
            IERC20(assetToken),
            msg.sender,
            depositTreasury,
            amount
        );
        emit DepositEvent(msg.sender,amount);
    }

    /**
     * @notice  Allows the manager to claim the deposit and mint RBF tokens.
     * @dev     This function is only callable by the manager role.
     */
    function claimDeposit() public onlyRole(MANAGER_ROLE) {
        require(depositAmount > 0, "RBF: depositAmount must be greater than 0");
        require(
            depositMintAmount > 0,
            "RBF: depositMintAmount must be greater than 0" 
        );
        _mint(vault, depositMintAmount);
        emit ClaimDepositEvent(vault,depositAmount,depositMintAmount);
        depositAmount = 0;
        depositMintAmount=0;
    }

    /**
     * @notice  Allows the manager to distribute dividends from the dividend treasury to the vault.
     * @dev     This function calculates the dividend share for the vault and transfers the dividend amount.
     */
    function dividend() public onlyRole(MANAGER_ROLE) {
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
        _dividend(
            balanceOf(vault),
            totalSupply,
            totalDividend,
            vaultDividendTreasury
        );
    }

    /**
     * @notice  Sets the deposit price and mint amount for RBF tokens.
     * @dev     This function is only callable by the PRICE_MINT_AMOUNT_SETTER_ROLE.
     * @param   _depositMintAmount amount of RBF tokens minted
     */
    function setMintAmount(
        uint256 _depositMintAmount
    ) public onlyRole(MINT_AMOUNT_SETTER_ROLE) {
        require(depositAmount > 0, "RBF: depositAmount must be greater than 0");
        depositMintAmount = _depositMintAmount;
        emit DepositDataEvent(depositMintAmount);
    }

    /**
     * @notice  Allows the manager to set the vault contract address.
     * @dev     This function assigns the vault address, which interacts with the RBF contract.
     * @param   _vault  The address of the vault to be set.
     */
    function setVault(address _vault) public onlyRole(MANAGER_ROLE) { 
        require(
            _vault != address(0),
            "RBF: vaultAddr cannot be zero address" 
        );
        require(vault==address(0),"RBF: vaultAddr already set");
        vault = _vault;
        emit SetVault(_vault);
    }


    /**
     * @notice  Sets the token metadata URI
     * @dev     This function can only be called by an address with the `MANAGER_ROLE` role.
     * @param   _tokenURI The new token URI (e.g., IPFS or a centralized server).
     */
    function setTokenURI(string memory _tokenURI) public onlyRole(MANAGER_ROLE) {
        tokenURI=_tokenURI;
        emit SetTokenURI(tokenURI);
    }


    /**
     * @notice  Fetches the net asset value (NAV) of the vault's RBF tokens based on the asset price.
     * @dev     This function calculates the NAV of the RBF tokens held by vault by fetching the latest price.
     * @return  uint256  The NAV in terms of the asset token's value.
     */
    function getAssetsNav() public view returns (uint256) {
        int256 lastPrice = getLatestPrice();
        uint256 amount = balanceOf(vault);
        uint256 indexDecimals = 10 ** decimals();
        return (amount * uint256(lastPrice)) / indexDecimals;
    }

    /**
     * @notice  Fetches the latest price of the asset token from the price feed.
     * @dev     This function interacts with the price feed contract to get the latest price of the asset token.
     * @return  int256  The latest price of the asset token.
     */
    function getLatestPrice() public view returns (int256) {
        (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        require(
            (roundId > 0 &&
                price >= 0 &&
                startedAt > 0 &&
                updatedAt > 0 &&
                answeredInRound > 0),
            "Invalid price data" 
        );
        return price;
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
    }

    function _scaleUp(uint256 amount) internal view returns (uint256) {
        return amount * decimalsMultiplier;
    }

    // 添加新功能或修复 bug
    function newFunction() public pure returns (string memory) {
        return "This is RBFV2!";
    }
}

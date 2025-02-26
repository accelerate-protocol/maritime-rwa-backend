// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interface/AggregatorV3Interface.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "../rbf/RBF.sol";

struct VaultInitializeData {
    string name;
    string symbol;
    address assetToken;
    address rbf;
    uint256 subStartTime;
    uint256 subEndTime;
    uint256 duration;
    uint256 fundThreshold;
    uint256 minDepositAmount;
    uint256 managerFee;
    address manager;
    address feeReceiver;
    address dividendEscrow;
    address[] whitelists;
}

/**
 * @author  tmpAuthor
 * @title   Vault
 * @dev     A contract for handling deposit and minting of vault tokens, managing dividends, and controlling access by the manager.
 * @notice  This contract allows deposits in an underlying asset token and mints a corresponding amount of Vault tokens based on the deposit and the rbf asset's price. It also supports dividend distribution and fee management by manager.
 */
contract Vault is ERC20Upgradeable, OwnableUpgradeable {
    uint256 public constant BPS_DENOMINATOR = 10_000;
    address public rbf;
    address public assetToken;
    address public feeReceiver;
    address public dividendEscrow;
    uint256 public maxSupply;
    uint256 public subStartTime;
    uint256 public subEndTime;
    uint256 public duration;
    uint256 public fundThreshold;
    uint256 public managerFee;
    uint256 public minDepositAmount;
    uint256 public decimalsMultiplier;
    address public manager;
    uint256 public totalDeposit;
    uint256 public assetBalance;
    uint256 public manageFeeBalance;
    uint256 public endTime;
    mapping(address => bool) public whitelistMap;
    address[] public whitelists;

    modifier onlyWhiteList(address _address) {
        require(whitelistMap[_address], "Vault: you are not int whitelist");
        _;
    }

    modifier onlyManager() {
        require(msg.sender == manager, "Vault: you are not manager");
        _;
    }

    /**
     * @notice  Initializes the Vault contract with given parameters.
     * @dev     This function sets the vault's basic parameters and ensures valid input values.
     * @param   data Struct containing initialization parameters.
     */
    function initialize(VaultInitializeData memory data) public initializer {
        __ERC20_init(data.name, data.symbol);
        __Ownable_init();
        require(
            data.assetToken != address(0),
            "Vault: Invalid assetToken address"
        );
        assetToken = data.assetToken;
        require(data.rbf != address(0), "Vault: Invalid rbf address");
        rbf = data.rbf;
        maxSupply = RBF(data.rbf).maxSupply();
        require(
            data.subStartTime < data.subStartTime,
            "Vault: Invalid subTime"
        );
        subStartTime = data.subStartTime;
        subEndTime = data.subStartTime;
        require(data.duration > 0, "Vault: Invalid duration");
        duration = data.duration;
        require(
            data.fundThreshold > 0 && data.fundThreshold <= BPS_DENOMINATOR,
            "Vault: Invalid fundThreshold"
        );
        fundThreshold = data.fundThreshold;
        require(
            data.minDepositAmount > 0 && data.minDepositAmount <= maxSupply,
            "Vault: Invalid minDepositAmount"
        );
        minDepositAmount = data.minDepositAmount;
        require(
            data.managerFee > 0 && data.managerFee <= BPS_DENOMINATOR,
            "Vault: Invalid managerFee"
        );
        managerFee = data.managerFee;
        require(data.manager != address(0), "Vault: Invalid manager");
        manager = data.manager;
        require(
            data.feeReceiver != address(0),
            "Vault: Invalid feeReceiver address"
        );
        feeReceiver = data.feeReceiver;
        require(
            data.dividendEscrow != address(0),
            "Vault: Invalid dividendEscrow address"
        );
        dividendEscrow = data.dividendEscrow;
        require(
            (data.whitelists.length > 0) && (data.whitelists.length <= 100),
            "Vault: Invalid whitelists length"
        );
        whitelists = data.whitelists;
        for (uint256 i = 0; i < data.whitelists.length; i++) {
            whitelistMap[data.whitelists[i]] = true;
        }
        decimalsMultiplier =
            10 ** (decimals() - IERC20Metadata(data.assetToken).decimals());
    }

    /**
     * @notice  Sets the minimum deposit amount.
     * @dev     Only callable by the contract owner.
     * @param   minAmount The minimum amount that can be deposited.
     */
    function setMinDepositAmount(uint256 minAmount) external onlyManager {
        require(
            minAmount > 0 && minAmount <= maxSupply,
            "Invalid minDepositAmount"
        );
        minDepositAmount = minAmount;
    }

    /**
     * @notice  Sets the manager fee percentage.
     * @dev     Fee must be within the valid basis point range (0-10,000).
     * @param   feeRate  The new manager fee percentage.
     */
    function setManagerFee(uint256 feeRate) external onlyManager {
        require(feeRate <= BPS_DENOMINATOR, "Invalid managerFee");
        managerFee = feeRate;
    }

    /**
     * @notice  Assigns a manager for the vault.
     * @dev     The manager is responsible for executing investment strategies.
     * @param   managerAddr Address of the new manager.  .
     */
    function setManager(address managerAddr) external onlyOwner {
        require(managerAddr != address(0), "Invalid address");
        manager = managerAddr;
    }

    /**
     * @notice  Deposits assets into the vault during the subscription period.
     * @dev     Ensures that deposits meet the minimum requirement and fall within the allowed period.
     * @param   assets The amount of assets to deposit.
     * @return  uint256 The amount of shares minted in exchange for the deposit.
     */
    function deposit(
        uint256 assets
    ) public virtual onlyWhiteList(msg.sender) returns (uint256) {
        require(assets >= minDepositAmount, "Vault: deposit less than min");
        require(
            block.timestamp >= subStartTime && block.timestamp <= subEndTime,
            "Vault: Invalid time"
        );
        totalDeposit = totalDeposit + assets;
        uint256 manageFeeAmount = (assets * managerFee) / BPS_DENOMINATOR;
        manageFeeBalance = manageFeeBalance + manageFeeAmount;
        assetBalance = assetBalance + assets;
        SafeERC20.safeTransferFrom(
            IERC20(assetToken),
            msg.sender,
            address(this),
            assets + manageFeeAmount
        );
        uint256 shares = _getMintAmountForPrice(assets);
        require(
            totalSupply() + shares <= maxSupply,
            "Vault: maxSupply exceeded"
        );
        _mint(msg.sender, shares);
        return shares;
    }

    /**
     * @notice Allows whitelisted users to redeem their shares for underlying assets.
     * @dev Users can redeem only after the subscription period ends and if the
     *      fund threshold is not met. The function burns the user's shares,
     *      calculates the corresponding asset amount, and transfers assets back
     *      to the user including the manager's fee.
     * @return The total amount of assets transferred to the user.
     */
    function redeem()
        public
        virtual
        onlyWhiteList(msg.sender)
        returns (uint256)
    {
        require(block.timestamp >= subEndTime, "Vault: Invalid time");
        require(
            (maxSupply * fundThreshold) / BPS_DENOMINATOR > totalDeposit,
            "Vault: not allowed withdraw"
        );
        uint256 shares = balanceOf(msg.sender);
        uint256 assetAmount = _getWithdrawAmountForVault(shares);
        _burn(msg.sender, shares);
        uint256 feeAmount = (assetAmount * managerFee) / BPS_DENOMINATOR;
        manageFeeBalance = manageFeeBalance + feeAmount;
        assetBalance = assetBalance + assetAmount;
        SafeERC20.safeTransfer(
            IERC20(assetToken),
            msg.sender,
            assetAmount + feeAmount
        );
        return assetAmount + feeAmount;
    }

    /**
     * @notice Allows the manager to withdraw accumulated management fees.
     * @dev The function ensures that withdrawals are only possible after the
     *      subscription period ends and if the fundraising threshold is met.
     *      The entire balance of management fees is transferred to the designated
     *      fee receiver.
     */
    function withdrawManageFee() public onlyManager {
        require(endTime!=0,"Vault: Invalid endTime");
        require(block.timestamp >= subEndTime, "Vault: Invalid time");
        require(
            (maxSupply * fundThreshold) / BPS_DENOMINATOR <= totalDeposit,
            "Vault: not allowed withdraw"
        );
        uint256 feeAmount = manageFeeBalance;
        manageFeeBalance = 0;
        SafeERC20.safeTransfer(IERC20(assetToken), feeReceiver, feeAmount);
    }

    /**
     * @notice Executes an investment strategy by depositing assets into the RBF contract.
     * @dev This function ensures that the asset amount does not exceed the vault’s balance.
     *      It also verifies that fundraising is either complete or has met the required
     *      threshold before proceeding. The function approves the asset transfer and
     *      deposits the assets into the RBF contract.
     * @param assetAmount The amount of assets to invest in the RBF contract.
     */
    function execStrategy(uint256 assetAmount) public onlyManager {
        require(
            assetAmount <= IERC20(assetToken).balanceOf(address(this)),
            "assetAmount error"
        );
        require(
            totalDeposit == maxSupply ||
                (block.timestamp >= subEndTime &&
                    (maxSupply * fundThreshold) / BPS_DENOMINATOR <=
                    totalDeposit),
            "fundraising fail"
        );
        if (endTime==0){
            endTime = block.timestamp + duration;
        }
        require(assetAmount <= assetBalance, "Vault: assetAmount error");
        assetBalance = assetBalance - assetAmount;
        bool authRes = IERC20(assetToken).approve(rbf, assetAmount);
        require(authRes, "assetToken approve error");
        RBF(rbf).deposit(assetAmount);
    }

    /**
     * @notice Adds an address to the whitelist, allowing it to participate in the vault.
     * @dev Only the contract owner can add addresses to the whitelist. Ensures that an address
     *      is not already whitelisted and that the whitelist does not exceed 100 entries.
     * @param whitelistAddr The address to be added to the whitelist.
     */
    function addToWhitelist(address whitelistAddr) public onlyOwner {
        require(
            !whitelistMap[whitelistAddr],
            "Vault: Address is already whitelisted"
        );
        require(whitelists.length < 100, "Vault: Whitelist is full");
        whitelistMap[whitelistAddr] = true;
        whitelists.push(whitelistAddr);
    }

    /**
     * @notice Removes an address from the whitelist, preventing further participation in the vault.
     * @dev Only the contract owner can remove addresses from the whitelist. Ensures the address
     *      is currently whitelisted before proceeding.
     * @param whitelistAddr The address to be removed from the whitelist.
     */
    function removeFromWhitelist(address whitelistAddr) public onlyOwner {
        require(
            whitelistMap[whitelistAddr],
            "Vault: Address is not in the whitelist"
        );
        whitelistMap[whitelistAddr] = false;

        for (uint256 i = 0; i < whitelists.length; i++) {
            if (whitelists[i] == whitelistAddr) {
                whitelists[i] = whitelists[whitelists.length - 1];
                whitelists.pop();
                break;
            }
        }
    }

    /**
     * @notice Distributes dividends to whitelisted users based on their shareholding.
     * @dev The function calculates the dividend amount for each whitelisted user and transfers
     *      the corresponding amount. Only users with a nonzero balance receive dividends.
     */
    function dividend() public onlyManager {
        uint256 totalDividend = IERC20(assetToken).balanceOf(dividendEscrow);
        require(totalDividend > 0, "No dividend to pay");
        uint256 totalSupply = totalSupply();
        require(totalSupply > 0, "No rbu to pay");
        for (uint8 i = 0; i < whitelists.length; i++) {
            if (whitelistMap[whitelists[i]]) {
                if (balanceOf(whitelists[i]) != 0) {
                    _dividend(
                        balanceOf(whitelists[i]),
                        totalSupply,
                        totalDividend,
                        whitelists[i]
                    );
                }
            }
        }
    }

    /**
     * @notice Calculates the price of a single share in the vault.
     * @dev The price is determined by fetching the NAV (Net Asset Value) from the RBF contract
     *      and adjusting it according to the price feed's decimal format.
     * @return The price of one share in the vault.
     */
    function price() public view returns (uint256) {
        uint256 totalSupply = totalSupply();
        uint256 nav = RBF(rbf).getAssetsNav();
        return (nav * RBF(rbf).priceFeedDecimals()) / totalSupply;
    }

    /**
     * @notice Returns the decimal precision of the vault token.
     * @dev Overrides the default ERC20 decimals function and sets it to 6.
     * @return The number of decimals used for the vault token.
     */
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    /**
     * @notice Transfers tokens from the caller to another address.
     * @dev The function checks if the transfer is authorized before executing it.
     *      It then updates the sender and receiver balances accordingly.
     * @param to The recipient address.
     * @param amount The amount of tokens to transfer.
     * @return A boolean value indicating whether the transfer was successful.
     */
    function transfer(
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        _checkTransferAuth(msg.sender, to);
        address owner = _msgSender();
        _transfer(owner, to, amount);
        return true;
    }

    /**
     * @notice Transfers tokens from one address to another using an allowance mechanism.
     * @dev The function ensures the sender is authorized to transfer on behalf of `from`.
     *      It then deducts the allowance and transfers the specified amount.
     * @param from The address from which tokens are transferred.
     * @param to The recipient address.
     * @param amount The amount of tokens to transfer.
     * @return A boolean value indicating whether the transfer was successful.
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        _checkTransferAuth(msg.sender, to);
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _dividend(
        uint256 vaultTokenAmount,
        uint256 totalSupply,
        uint256 totalDividend,
        address receipter
    ) internal {
        require(receipter != address(0), "receipter can not be zero");
        uint256 dividendAmount = (vaultTokenAmount * totalDividend) /
            totalSupply;
        require(dividendAmount > 0, "dividendAmount must bigger than zero");
        SafeERC20.safeTransferFrom(
            IERC20(assetToken),
            dividendEscrow,
            receipter,
            dividendAmount
        );
    }

    function _checkTransferAuth(address from, address to) internal view {
        require(
            whitelistMap[from] && whitelistMap[to],
            "transfer from and to must in whitelist"
        );
    }

    function _getMintAmountForPrice(
        uint256 depositAmount
    ) internal view returns (uint256) {
        int256 tokenPrice = RBF(rbf).getLatestPrice();
        require(tokenPrice > 0, "Invalid price data");
        uint256 uTokenPrice = uint256(tokenPrice);
        uint256 rwaAmount = (_scaleUp(depositAmount) *
            RBF(rbf).priceFeedDecimals()) / uTokenPrice;
        return rwaAmount;
    }

    function _getWithdrawAmountForVault(
        uint256 vaultAmount
    ) internal view returns (uint256) {
        int256 tokenPrice = RBF(rbf).getLatestPrice();
        require(tokenPrice > 0, "Invalid price data");
        uint256 uTokenPrice = uint256(tokenPrice);
        uint256 withdrawAmount = _scaleDown(
            (vaultAmount * uTokenPrice) / RBF(rbf).priceFeedDecimals()
        );
        return withdrawAmount;
    }

    function _scaleUp(uint256 amount) internal view returns (uint256) {
        return amount * decimalsMultiplier;
    }

    function _scaleDown(uint256 amount) internal view returns (uint256) {
        return amount / decimalsMultiplier;
    }
}

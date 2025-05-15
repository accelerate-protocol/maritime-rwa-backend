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
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "../interface/AggregatorV3Interface.sol";
import "../interface/IVault.sol";
import "../rbf/RBF.sol";

// Struct for initializing the Vault contract with multiple parameters
struct VaultInitializeData {
    string name; // Vault token name
    string symbol; // Vault token symbol
    address assetToken;
    address rbf;
    uint256 maxSupply;
    uint256 subStartTime;
    uint256 subEndTime;
    uint256 duration;
    uint256 fundThreshold;
    uint256 financePrice;
    uint256 minDepositAmount;
    uint256 manageFee;
    address manager;
    address feeReceiver;
    address dividendTreasury;
    bool isOpen;
    address[] whitelists;
}

/**
 * @author  Accelerate Finance
 * @title   Vault
 * @dev     A contract for handling deposit and minting of vault tokens, managing dividends, and controlling access by the manager.
 * @notice  This contract allows deposits in an underlying asset token and mints a corresponding amount of Vault tokens based on the deposit and the financePrice. It also supports dividend distribution and fee management by manager.
 */
contract Vault is
    IVault,
    ERC20Upgradeable,
    OwnableUpgradeable,
    AccessControlUpgradeable
{
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant FINANCE_PRICE_DENOMINATOR = 10 ** 8;
    // Address of the RBF contract
    address public rbf;
    // Address of the asset token that users will deposit (e.g., USDC)
    address public assetToken;
    // Address to receive the management fees
    address public feeReceiver;
    // Address where dividend funds are held for distribution
    address public dividendTreasury;
    // Maximum supply of Vault tokens
    uint256 public maxSupply;
    // Start time of the subscription period
    uint256 public subStartTime;
    //End time of the subscription period
    uint256 public subEndTime;
    // Duration for the investment period
    uint256 public duration;
    // Threshold for the fundraising, in basis points
    uint256 public fundThreshold;
    // Management fee taken from deposit
    uint256 public manageFee;
    // Minimum amount required to deposit into the Vault
    uint256 public minDepositAmount;
    // Multiplier to adjust decimals between assetToken and Vault token
    uint256 public decimalsMultiplier;
    // Address of the vault manager
    address public manager;
    // Total amount of assets in the Vault
    uint256 public assetBalance;
    // Accumulated management fees
    uint256 public manageFeeBalance;
    // End time of the Vault, set after fundraising
    uint256 public endTime;
    // Finance price
    uint256 public financePrice;
    // Mapping to check if an address is onChainWLMap
    mapping(address => bool) public onChainWLMap;
    // List of onChainWL addresses allowed to interact with the Vault onChain
    address[] public onChainWL;
    // Mapping to check if an address is offChainWLMap
    mapping(address => bool) public offChainWLMap;
    // List of offChainWL addresses allowed to interact with the Vault offChain
    address[] public offChainWL;

    // todo
    // isOpen is used to determine if the vault is open for any user
    bool isOpen;
    //  mapping to store the subscription balance of each address
    mapping(address => uint256) private subBalance;

    modifier onlyOnChainWL(address _address) {
        if (!isOpen) {
            require(onChainWLMap[_address], "Vault: you are not in onChainWL");
        }
        _;
    }

    modifier onlyOffChainWL(address _address) {
        require(offChainWLMap[_address], "Vault: you are not in offChainWL");
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
        require(data.maxSupply > 0, "Vault: Invalid maxSupply");
        maxSupply = data.maxSupply;
        require(data.subStartTime < data.subEndTime, "Vault: Invalid subTime");
        subStartTime = data.subStartTime;
        subEndTime = data.subEndTime;
        require(data.duration > 0, "Vault: Invalid duration");
        duration = data.duration;
        require(
            data.fundThreshold > 0 && data.fundThreshold <= BPS_DENOMINATOR,
            "Vault: Invalid fundThreshold"
        );
        fundThreshold = data.fundThreshold;
        require(data.financePrice > 0, "Vault: Invalid financePrice");
        financePrice = data.financePrice;
        require(
            data.minDepositAmount > 0 &&
                data.minDepositAmount <=
                ((data.financePrice * data.maxSupply) /
                    FINANCE_PRICE_DENOMINATOR),
            "Vault: Invalid minDepositAmount"
        );
        minDepositAmount = data.minDepositAmount;
        require(data.manageFee <= BPS_DENOMINATOR, "Vault: Invalid managerFee");
        manageFee = data.manageFee;
        require(data.manager != address(0), "Vault: Invalid manager");
        manager = data.manager;
        require(
            data.feeReceiver != address(0),
            "Vault: Invalid feeReceiver address"
        );
        feeReceiver = data.feeReceiver;
        require(
            data.dividendTreasury != address(0),
            "Vault: Invalid dividendTreasury address"
        );
        dividendTreasury = data.dividendTreasury;
        require(
            (data.whitelists.length > 0) && (data.whitelists.length <= 100),
            "Vault: Invalid whitelists length"
        );
        onChainWL = data.whitelists;
        for (uint256 i = 0; i < data.whitelists.length; i++) {
            onChainWLMap[data.whitelists[i]] = true;
        }
        isOpen = data.isOpen;
        decimalsMultiplier =
            10 **
                (decimals() -
                    IERC20MetadataUpgradeable(data.assetToken).decimals());

        _grantRole(DEFAULT_ADMIN_ROLE, data.manager);
        _grantRole(MANAGER_ROLE, data.manager);
    }

    /**
     * @notice  Deposits assets into the vault during the subscription period.
     * @dev     Ensures that deposits meet the minimum requirement and fall within the allowed period.
     * @param   assets The amount of assets to deposit.
     * @return  uint256 The amount of shares minted in exchange for the deposit.
     */
    function deposit(
        uint256 assets
    ) public virtual onlyOnChainWL(msg.sender) returns (uint256) {
        require(assets >= minDepositAmount, "Vault: deposit less than min");
        require(
            block.timestamp >= subStartTime && block.timestamp <= subEndTime,
            "Vault: Invalid time"
        );
        uint256 manageFeeAmount = (assets * manageFee) / BPS_DENOMINATOR;
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
        if (isOpen) {
            subBalance[msg.sender] = subBalance[msg.sender] + shares;
            if (!onChainWLMap[msg.sender]) { 
                _addToOnChainWL(msg.sender);
            }
        }
        emit DepositEvent(msg.sender, assets, manageFeeAmount, shares);
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
        returns (uint256)
    {
        require(onChainWLMap[msg.sender], "Vault: you are not in onChainWL");
        require(block.timestamp >= subEndTime, "Vault: Invalid time");
        require(
            (maxSupply * fundThreshold) / BPS_DENOMINATOR > totalSupply(),
            "Vault: not allowed withdraw"
        );
        uint256 shares = balanceOf(msg.sender);
        uint256 assetAmount = _getAssetAmountForVault(shares);
        _spendAllowance(msg.sender, address(this), shares);
        _burn(msg.sender, shares);
        uint256 feeAmount = (assetAmount * manageFee) / BPS_DENOMINATOR;
        manageFeeBalance = manageFeeBalance - feeAmount;
        assetBalance = assetBalance - assetAmount;
        SafeERC20.safeTransfer(
            IERC20(assetToken),
            msg.sender,
            assetAmount + feeAmount
        );
        emit FundFailRedeem(msg.sender, shares, assetAmount, feeAmount);
        return assetAmount + feeAmount;
    }

    /**
     * @notice  OffChain Deposits Mint into the vault during the subscription period
     * @dev     Ensures that deposits meet the minimum requirement and fall within the allowed period.
     * @param   receiver  The address of the recipient of the minted shares.
     * @param   amount    The amount of asset tokens to be deposited.
     */
    function offChainDepositMint(
        address receiver,
        uint256 amount
    ) public onlyRole(MANAGER_ROLE) {
        require(
            _getAssetAmountForVault(amount) >= minDepositAmount,
            "Vault: OffChain deposit less than min"
        );
        require(
            block.timestamp >= subStartTime && block.timestamp <= subEndTime,
            "Vault: Invalid time"
        );
        require(
            totalSupply() + amount <= maxSupply,
            "Vault: maxSupply exceeded"
        );
        require(
            offChainWLMap[receiver],
            "Vault:OffChain receiver are not in offChainWL"
        );
        _mint(receiver, amount);
        if (isOpen) {
            subBalance[receiver] = subBalance[receiver] + amount;
        }
        emit OffChainDepositEvent(msg.sender, receiver, amount);
    }

    /**
     * @notice  redemption to be serviced off chain
     * @dev Users can redeem only after the subscription period ends and if the
     *      fund threshold is not met. The function burns the user's shares,
     *      calculates the corresponding asset amount and transfer to user offChain.
     */
    function offChainRedeem() public onlyOffChainWL(msg.sender) {
        require(block.timestamp >= subEndTime, "Vault: Invalid time");
        require(
            (maxSupply * fundThreshold) / BPS_DENOMINATOR > totalSupply(),
            "Vault: not allowed withdraw"
        );
        uint256 shares = balanceOf(msg.sender);
        _spendAllowance(msg.sender, address(this), shares);
        _burn(msg.sender, shares);
        emit OffChainRedeemEvent(msg.sender, shares);
    }

    /**
     * @notice Allows the manager to withdraw accumulated management fees.
     * @dev The function ensures that withdrawals are only possible after the
     *      subscription period ends and if the fundraising threshold is met.
     *      The entire balance of management fees is transferred to the designated
     *      fee receiver.
     */
    function withdrawManageFee() public onlyRole(MANAGER_ROLE) {
        require(endTime != 0, "Vault: Invalid endTime");
        require(block.timestamp >= subEndTime, "Vault: Invalid time");
        require(
            (maxSupply * fundThreshold) / BPS_DENOMINATOR <= totalSupply(),
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
     */
    function execStrategy() public onlyRole(MANAGER_ROLE) {
        require(assetBalance > 0, "Vault: assetBalance is zero");
        require(
            maxSupply == totalSupply() ||
                (block.timestamp >= subEndTime &&
                    (maxSupply * fundThreshold) / BPS_DENOMINATOR <=
                    totalSupply()),
            "Vault: fundraising fail"
        );
        if (endTime <= 0) {
            endTime = block.timestamp + duration;
        }
        uint256 depositAmount = assetBalance;
        assetBalance = 0;
        bool authRes = IERC20(assetToken).approve(rbf, depositAmount);
        require(authRes, "Vault: assetToken approve error");
        RBF(rbf).requestDeposit(depositAmount);
        emit ExecStrategyEvent(depositAmount);
    }

    /**
     * @notice Adds an address to the whitelist, allowing it to participate in the vault.
     * @dev Only the contract owner can add addresses to the whitelist. Ensures that an address
     *      is not already whitelisted and that the whitelist does not exceed 100 entries.
     * @param whitelistAddr The address to be added to the whitelist.
     */
    function addToOnChainWL(
        address whitelistAddr
    ) public onlyRole(MANAGER_ROLE) {
        _addToOnChainWL(whitelistAddr);
    }

    function _addToOnChainWL(address whitelistAddr) internal {
        if (!isOpen) {
            require(block.timestamp <= subEndTime, "Vault: Invalid time"); 
        }
        require(
            !onChainWLMap[whitelistAddr],
            "Vault: Address is already onChainWL"
        );
        require(
            !offChainWLMap[whitelistAddr],
            "Vault: Address is already offChainWL"
        );
        require(onChainWL.length < 100, "Vault: Whitelist is full");
        onChainWLMap[whitelistAddr] = true;
        onChainWL.push(whitelistAddr);
    }

    /**
     * @notice Removes an address from the whitelist, preventing further participation in the vault.
     * @dev Only the contract owner can remove addresses from the whitelist. Ensures the address
     *      is currently whitelisted before proceeding.
     * @param whitelistAddr The address to be removed from the whitelist.
     */
    function removeFromOnChainWL(
        address whitelistAddr
    ) public onlyRole(MANAGER_ROLE) {
        if (!isOpen) {
            require(block.timestamp <= subEndTime, "Vault: Invalid time");
        }
        require(
            onChainWLMap[whitelistAddr],
            "Vault: Address is not in the whitelist"
        );
        if (isOpen) {
            require(
                subBalance[whitelistAddr] <= 0,
                "Vault: Address has subBalance balance"
            );
        } else {
            require(
                balanceOf(whitelistAddr) <= 0,
                "Vault: Address has balance"
            );
        }
        onChainWLMap[whitelistAddr] = false;
        for (uint256 i = 0; i < onChainWL.length; i++) {
            if (onChainWL[i] == whitelistAddr) {
                onChainWL[i] = onChainWL[onChainWL.length - 1];
                onChainWL.pop();
                break;
            }
        }
    }

    /**
     * @notice  Adds an address to the OffChain Whitelist, allowing it to participate in the vault offChain.
     * @dev     This function is only callable by the manager of the vault.
     * @param   whitelistAddr  The address to be added to the OffChain Whitelist.
     */
    function addToOffChainWL(
        address whitelistAddr
    ) public onlyRole(MANAGER_ROLE) {
        require(block.timestamp <= subEndTime, "Vault: Invalid time");
        require(
            !onChainWLMap[whitelistAddr],
            "Vault: Address is already onChainWL"
        );
        require(
            !offChainWLMap[whitelistAddr],
            "Vault: Address is already offChainWL"
        );
        require(offChainWL.length < 100, "Vault: Whitelist is full");
        offChainWLMap[whitelistAddr] = true;
        offChainWL.push(whitelistAddr);
    }

    /**
     * @notice  Removes an address from the OffChain whitelist, preventing further participation in the vault.
     * @dev     This function can only be called by the manager of the vault.
     * @param   whitelistAddr   The address to be removed from the OffChain whitelist.
     */
    function removeFromOffChainWL(
        address whitelistAddr
    ) public onlyRole(MANAGER_ROLE) {
        require(block.timestamp <= subEndTime, "Vault: Invalid time");
        require(
            offChainWLMap[whitelistAddr],
            "Vault: Address is not in the offChain whitelist"
        );

        if(isOpen){
            require(subBalance[whitelistAddr] <= 0, "Vault: Address has subBalance balance");
        }else{
            require(balanceOf(whitelistAddr) <= 0, "Vault: Address has balance");
        }
        offChainWLMap[whitelistAddr] = false;
        for (uint256 i = 0; i < offChainWL.length; i++) {
            if (offChainWL[i] == whitelistAddr) {
                offChainWL[i] = offChainWL[offChainWL.length - 1];
                offChainWL.pop();
                break;
            }
        }
    }

    /**
     * @notice Distributes dividends to whitelisted users based on their shareholding.
     * @dev The function calculates the dividend amount for each whitelisted user and transfers
     *      the corresponding amount. Only users with a nonzero balance receive dividends.
     */
    function dividend() public onlyRole(MANAGER_ROLE) {
        uint256 totalDividend = IERC20(assetToken).balanceOf(dividendTreasury);
        require(totalDividend > 0, "Vault: No dividend to pay");
        uint256 totalSupply = totalSupply();
        require(totalSupply > 0, "Vault: No rbu to pay");
        for (uint8 i = 0; i < onChainWL.length; i++) {
            if (onChainWLMap[onChainWL[i]]) {
                if (isOpen) {
                    if (subBalance[onChainWL[i]] != 0) {
                        _dividend(
                            subBalance[onChainWL[i]],
                            totalSupply,
                            totalDividend,
                            onChainWL[i]
                        );
                    }
                } else {
                    if (balanceOf(onChainWL[i]) != 0) {
                        _dividend(
                            balanceOf(onChainWL[i]),
                            totalSupply,
                            totalDividend,
                            onChainWL[i]
                        );
                    }
                }
            }
        }
        for (uint8 i = 0; i < offChainWL.length; i++) {
            if (offChainWLMap[offChainWL[i]]) {
                if (isOpen) {
                    if (subBalance[offChainWL[i]] != 0) {
                        _dividend(
                            subBalance[offChainWL[i]],
                            totalSupply,
                            totalDividend,
                            offChainWL[i]
                        );
                    }
                } else {
                    if (balanceOf(offChainWL[i]) != 0) {
                        _dividend(
                            balanceOf(offChainWL[i]),
                            totalSupply,
                            totalDividend,
                            offChainWL[i]
                        );
                    }
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
        return (nav * (10 ** decimals())) / totalSupply;
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
     * @notice  Returns the length of the onChainWL array.
     * @dev     This function is used to get the length of the onChainWL array.
     * @return  uint256  The length of the onChainWL array.
     */
    function getOnChainWLLen() public view returns (uint256) {
        return onChainWL.length;
    }

    /**
     * @notice  Returns the length of the offChainWL array.
     * @dev     This function is used to get the length of the offChainWL array.
     * @return  uint256  The length of the offChainWL array.
     */
    function getOffChainWLLen() public view returns (uint256) {
        return offChainWL.length;
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
        bool success = super.transfer(to, amount);
        return success;
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
        _checkTransferAuth(from, to);
        bool success = super.transferFrom(from, to, amount);
        return success;
    }

    function _dividend(
        uint256 vaultTokenAmount,
        uint256 totalSupply,
        uint256 totalDividend,
        address receipter
    ) internal {
        require(receipter != address(0), "Vault: receipter can not be zero");
        uint256 dividendAmount = (vaultTokenAmount * totalDividend) /
            totalSupply;
        require(
            dividendAmount > 0,
            "Vault: dividendAmount must bigger than zero"
        );
        SafeERC20.safeTransferFrom(
            IERC20(assetToken),
            dividendTreasury,
            receipter,
            dividendAmount
        );
    }

    function _checkTransferAuth(address from, address to) internal view {
        require( 
            (maxSupply * fundThreshold) / BPS_DENOMINATOR <= totalSupply(),
            "Vault: not allowed transfer"
        );
        if (!isOpen) {  
            require(
                (onChainWLMap[from] || offChainWLMap[from]) &&
                    (onChainWLMap[to] || offChainWLMap[to]),
                "Vault: transfer from and to must in onChainWL or offChainWL"
            );
        }
    }

    function _getMintAmountForPrice(
        uint256 depositAmount
    ) internal view returns (uint256) {
        require(financePrice > 0, "Vault: financePrice must bigger than zero");
        uint256 rwaAmount = (_scaleUp(depositAmount) *
            FINANCE_PRICE_DENOMINATOR) / financePrice;
        return rwaAmount;
    }

    function _getAssetAmountForVault(
        uint256 vaultAmount
    ) internal view returns (uint256) {
        require(financePrice > 0, "Vault: financePrice must bigger than zero");
        uint256 assetAmount = (_scaleDown(vaultAmount) * financePrice) /
            FINANCE_PRICE_DENOMINATOR;
        return assetAmount;
    }

    function _scaleUp(uint256 amount) internal view returns (uint256) {
        return amount * decimalsMultiplier;
    }

    function _scaleDown(uint256 amount) internal view returns (uint256) {
        return amount / decimalsMultiplier;
    }
}

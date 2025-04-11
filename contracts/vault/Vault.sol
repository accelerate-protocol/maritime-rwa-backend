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


    modifier onlyOnChainWL(address _address) {
        require(onChainWLMap[_address], "Vault: you are not in onChainWL");
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
            "Vault: Invalid assetToken address" //tc-22:assetToken为零地址，部署失败
        ); 
        assetToken = data.assetToken;
        require(data.rbf != address(0), "Vault: Invalid rbf address"); //tc-7:部署Vault，传入的rbf为零地址，部署不成功;//tc-32:通过VaultRouter部署Vault，传入的rbf为零地址
        rbf = data.rbf;
        require(data.maxSupply > 0, "Vault: Invalid maxSupply");//tc-33:maxSupply等于0;tc-52:maxSupply is less than 0
        maxSupply = data.maxSupply;
        require(data.subStartTime < data.subEndTime, "Vault: Invalid subTime"); //tc-24:认购结束时间等于开始时间;//tc-24:认购结束时间早于开始时间;
        subStartTime = data.subStartTime;
        subEndTime = data.subEndTime;
        require(data.duration > 0, "Vault: Invalid duration");//tc-34:锁定期等于0
        duration = data.duration;
        require(
            data.fundThreshold > 0 && data.fundThreshold <= BPS_DENOMINATOR,
            "Vault: Invalid fundThreshold" //tc-34:融资阈值大于100%;//tc-34:融资阈值为0
        );
        fundThreshold = data.fundThreshold;
        require(data.financePrice > 0, "Vault: Invalid financePrice"); //tc-34:融资价格等于0
        financePrice = data.financePrice;
        require(data.minDepositAmount > 0 && data.minDepositAmount<= (data.financePrice*data.maxSupply/FINANCE_PRICE_DENOMINATOR), "Vault: Invalid minDepositAmount"); //tc-34:最小投资金额等于0;//tc-34:最小投资金额大于最大供应量
        minDepositAmount = data.minDepositAmount;
        require(
            data.manageFee > 0 && data.manageFee <= BPS_DENOMINATOR, //tc-34://管理费大于100%;//tc-34:管理费等于0;//tc-37:管理费等于100%
            "Vault: Invalid managerFee"
        );
        manageFee = data.manageFee;
        require(data.manager != address(0), "Vault: Invalid manager"); //tc-22:manager is zero address, deploy failed
        manager = data.manager;
        require(
            data.feeReceiver != address(0),
            "Vault: Invalid feeReceiver address" //tc-22:feeReceiver为零地址，部署失败
        );
        feeReceiver = data.feeReceiver;
        require(
            data.dividendTreasury != address(0),
            "Vault: Invalid dividendTreasury address" //tc-8:dividendEscrow is zero address, deploy failed
        );
        dividendTreasury = data.dividendTreasury;
        require(
            (data.whitelists.length > 0) && (data.whitelists.length <= 100), //tc-34:白名单长度大于100;//tc-34:白名单为空;//tc-34:白名单长度等于100
            "Vault: Invalid whitelists length"
        );
        onChainWL = data.whitelists;
        for (uint256 i = 0; i < data.whitelists.length; i++) {
            onChainWLMap[data.whitelists[i]] = true;
        }
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
     //tc-31:融资达到最大供应量导致融资提前结束，认购期未结束然后继续认购，认购失败
     //tc-46:提前融资完成
     //tc-54:发起者在线上白名单
     //tc-54:发起者不在线上白名单
     //tc-47:极限测试：100个线上认购，并给100个人派息
    function deposit(
        uint256 assets
    ) public virtual onlyOnChainWL(msg.sender) returns (uint256) { //tc-25:不在白名单中的账户认购，认购失败;//tc-26:白名单中的账户认购，在认购期内，以最小认购金额认
        require(assets >= minDepositAmount, "Vault: deposit less than min");//tc-28:认购金额小于最小投资金额 //tc-54
        require(
            block.timestamp >= subStartTime && block.timestamp <= subEndTime,//tc-30:认购期限截止后认购;//tc-27:在认购开始之前认购
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
            "Vault: maxSupply exceeded" //tc-29:认购金额大于最大供应量 //tc-54:线上认购大于maxsupply-已认购金额，认购失败
        );
        _mint(msg.sender, shares);
        emit DepositEvent(msg.sender,assets,manageFeeAmount,shares);
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
     //tc-44:认购期结束未达到阈值线上赎回成功
     //tc-44:在线上白名单中的账户执行赎回，赎回成功
     //tc-44:不在线上白名单的账户执行赎回
    function redeem()
        public
        virtual
        onlyOnChainWL(msg.sender)
        returns (uint256)
    {
        require(block.timestamp >= subEndTime, "Vault: Invalid time");//tc-44:认购未达到阈值，未到认购截止时间时间执行赎回；//tc-46:执行赎回:已经提前完成融资，在认购截止时间前白名单账户执行赎回，赎回失败
        require(
            (maxSupply * fundThreshold) / BPS_DENOMINATOR > totalSupply(),
            "Vault: not allowed withdraw" //tc-40:提前认购完成MaxSupply100%，认购期结束后执行赎回，赎回失败
        );
        uint256 shares = balanceOf(msg.sender);
        uint256 assetAmount = _getAssetAmountForVault(shares);
        _spendAllowance(msg.sender, address(this), shares);//tc-56:认购期结束后，融资未生效，线上认购者在approve前线上赎回，赎回失败；//tc-56:认购期结束后，融资未生效，线上认购者在approve后线上赎回，赎回成功
        _burn(msg.sender, shares);
        uint256 feeAmount = (assetAmount * manageFee) / BPS_DENOMINATOR;
        manageFeeBalance = manageFeeBalance - feeAmount;
        assetBalance = assetBalance - assetAmount;
        SafeERC20.safeTransfer(
            IERC20(assetToken),
            msg.sender,
            assetAmount + feeAmount
        ); 
        emit FundFailRedeem(msg.sender,shares, assetAmount, feeAmount);
        return assetAmount + feeAmount; //tc-44:赎回金额验证
    }


    /**
     * @notice  OffChain Deposits Mint into the vault during the subscription period 
     * @dev     Ensures that deposits meet the minimum requirement and fall within the allowed period.
     * @param   receiver  The address of the recipient of the minted shares.
     * @param   amount    The amount of asset tokens to be deposited.
     */
     //tc-54:执在认购期内，线下白名单账户认购符合要求的金额，并且执行者是MANAGER_ROLE，执行成功
     //tc-54:在认购期内，线下白名单账户认购符合要求的金额，执行者不是MANAGER_ROLE，执行失败
    function offChainDepositMint(address receiver,uint256 amount) public onlyRole(MANAGER_ROLE) {
        require(_getAssetAmountForVault(amount) >= minDepositAmount, "Vault: OffChain deposit less than min");//tc-55：线下认购金额小于最小认购金额，认购失败
        require(
            block.timestamp >= subStartTime && block.timestamp <= subEndTime,
            "Vault: Invalid time" //tc-55:认购期结束后，线下认购，执行失败
        );
        require(
            totalSupply() + amount <= maxSupply,
            "Vault: maxSupply exceeded" //tc-55:线下认购金额大于maxsupply，认购失败;//tc-55:线下认购大于maxsupply-已认购金额，认购失败
        );
        require(offChainWLMap[receiver], "Vault:OffChain receiver are not in offChainWL");//tc-54：线上白名单中的账户执行线下认购，执行失败
        _mint(receiver, amount);
        emit OffChainDepositEvent(msg.sender,receiver,amount);
    }


    /**
     * @notice  redemption to be serviced off chain
     * @dev Users can redeem only after the subscription period ends and if the
     *      fund threshold is not met. The function burns the user's shares,
     *      calculates the corresponding asset amount and transfer to user offChain.
     */
     //tc-56:线下白名单中的账户执行
     //tc-56:不在线下白名单的账户执行线下赎回，执行失败
    function offChainRedeem() public onlyOffChainWL(msg.sender){
        require(block.timestamp >= subEndTime, "Vault: Invalid time");//tc-56：线下认购者在认购期内执行线下赎回，执行失败 //tc-54:认购期内，线下赎回失败
        require(
            (maxSupply * fundThreshold) / BPS_DENOMINATOR > totalSupply(),
            "Vault: not allowed withdraw" //tc-54：融资生效后线下赎回，执行失败
        );
        uint256 shares = balanceOf(msg.sender);
        _spendAllowance(msg.sender, address(this), shares); //tc-56：认购期结束后，融资未生效，线下认购者在approve前线下赎回，赎回失败；//tc-56:认购期结束后，融资未生效，线下认购者在approve后线下赎回，赎回成功
        _burn(msg.sender, shares);
        emit OffChainRedeemEvent(msg.sender,shares);
    }


    /**
     * @notice Allows the manager to withdraw accumulated management fees.
     * @dev The function ensures that withdrawals are only possible after the
     *      subscription period ends and if the fundraising threshold is met.
     *      The entire balance of management fees is transferred to the designated
     *      fee receiver.
     */
     //tc-40:提前完成融资，认购期结束后，管理员提取管理费成功
     //tc-40:提前完成融资，认购期结束后，非管理员提取管理费，提取失败
     //tc-43:融资结束时达到阈值，提取管理费，提取成功
    function withdrawManageFee() public onlyRole(MANAGER_ROLE) {
        require(endTime != 0, "Vault: Invalid endTime");//tc-44:融资未达到阈值，未到认购截止时间时间执行提取管理费，提取失败；//tc-44:融资未达到阈值，认购期结束后（计息期间），提取管理费；//tc-44:融资未达到阈值，锁定期结束后，提取管理费
        require(block.timestamp >= subEndTime, "Vault: Invalid time");//tc-46:提前完成融资，但是提取管理费时间未到设定的认购结束时间，提取失败；//tc-40:提前完成融资，认购期结束后，管理员提取管理费成功
        require(
            (maxSupply * fundThreshold) / BPS_DENOMINATOR <= totalSupply(),
            "Vault: not allowed withdraw" //
        );
        uint256 feeAmount = manageFeeBalance;
        manageFeeBalance = 0;
        SafeERC20.safeTransfer(IERC20(assetToken), feeReceiver, feeAmount); //tc-40:管理费提取金额验证
    }

    /**
     * @notice Executes an investment strategy by depositing assets into the RBF contract.
     * @dev This function ensures that the asset amount does not exceed the vault’s balance.
     *      It also verifies that fundraising is either complete or has met the required
     *      threshold before proceeding. The function approves the asset transfer and
     *      deposits the assets into the RBF contract.
     */
    //tc-46:提前融满，在认购期内，setVault之后执行策略，既是MANAGER_ROLE又是vault，然后执行策略，执行成功
    function execStrategy() public onlyRole(MANAGER_ROLE) { //tc-46:不是MANAGER_ROLE角色的账户，执行策略;//tc-46:是MANAGER_ROLE角色的账户但不是vault，执行策略;
        require(assetBalance>0,"Vault: assetBalance is zero"); //tc-48:assetBalance为0，执行策略失败；//tc-46:再次执行策略，执行失败：assetBalance 等于0
        require(
            maxSupply == totalSupply() ||
                (block.timestamp >= subEndTime &&
                    (maxSupply * fundThreshold) / BPS_DENOMINATOR <=
                    totalSupply()),
            "Vault: fundraising fail" //tc-56:认购期结束，融资未生效情况下执行策略，失败；//tc-56:认购期内执行策略，失败 //tc-53:提前融满，在认购期内，setVault之后执行策略，既是MANAGER_ROLE又是vault执行策略，成功
        );
        if (endTime <= 0) {
            endTime = block.timestamp + duration;
        }
        uint256 depositAmount=assetBalance;
        assetBalance=0;  //tc-46:验证执行策略之后assetBlance被设置为0
        bool authRes = IERC20(assetToken).approve(rbf, depositAmount);
        require(authRes, "Vault: assetToken approve error");
        RBF(rbf).requestDeposit(depositAmount); //tc-46:不是Vault执行requestDeposit、setVault后是Vault执行requestDeposit
        emit ExecStrategyEvent(depositAmount);
    }

    /**
     * @notice Adds an address to the whitelist, allowing it to participate in the vault.
     * @dev Only the contract owner can add addresses to the whitelist. Ensures that an address
     *      is not already whitelisted and that the whitelist does not exceed 100 entries.
     * @param whitelistAddr The address to be added to the whitelist.
     */
    //tc-39:认购期且未完成认购时，添加白名单，添加不在白名单列表中的账户，添加成功
    //tc-39:融资提前完成后，但在认购期内，添加账户到白名单，成功
    //tc-39:认购期结束后添加不在白名单中的账户到线上白名单，添加失败
    //tc-54:在认购期内，是MANAGER_ROLE角色的账户执行添加到线上白名单，且被添加的账户不在线上白名单，执行成功
    //tc-54:不是MANAGER_ROLE角色的账户执行添加到线上白名单，执行失败
    function addToOnChainWL(
        address whitelistAddr
    ) public onlyRole(MANAGER_ROLE) {
        require(
            block.timestamp <= subEndTime,
            "Vault: Invalid time" //tc-39:认购期结束,添加账户到线上白名单失败
        );
        require(
            !onChainWLMap[whitelistAddr],
            "Vault: Address is already onChainWL" //tc-39：认购期且未完成认购时，添加白名单，要添加的账户已经在白名单，添加失败
        );
        require(!offChainWLMap[whitelistAddr], "Vault: Address is already offChainWL"); //tc-54：添加已经在线下白名单的账户到线上白名单，执行失败
        require(onChainWL.length < 100, "Vault: Whitelist is full"); //tc-47:添加白名单账户超过100个，添加失败
        onChainWLMap[whitelistAddr] = true; //tc-39:添加成功后线上白名单Map中查询已被添加的账户状态为true
        onChainWL.push(whitelistAddr);
    }

    /**
     * @notice Removes an address from the whitelist, preventing further participation in the vault.
     * @dev Only the contract owner can remove addresses from the whitelist. Ensures the address
     *      is currently whitelisted before proceeding.
     * @param whitelistAddr The address to be removed from the whitelist.
     */
    //tc-39:认购期且未完成认购时，删除白名单账户，要删除的账户在白名单中，删除成功
    //tc-39:融资提前完成后，但在认购期内，删除白名单中的没有认购账户，成功
    //tc-39:在认购期结束后从线上白名单中删除在线上白名单中的账户，删除失败
    //tc-54:MANAGER_ROLE执行
    //tc-54:非MANAGER_ROLE执行
    function removeFromOnChainWL(
        address whitelistAddr
    ) public onlyRole(MANAGER_ROLE) {
        require(
            block.timestamp <= subEndTime,  //tc-39:认购期结束,删除白名单账户失败
            "Vault: Invalid time"
        );
        require(
            onChainWLMap[whitelistAddr],
            "Vault: Address is not in the whitelist" //tc-39：认购期且未完成认购时，删除白名单账户，要删除的账户不在白名单中，删除失败
        );
        require(balanceOf(whitelistAddr)<=0, "Vault: Address has balance"); //tc-39:认购期内，账户认购后有余额，不能从白名单中删除该账户；//tc-39:融资提前完成后，但在认购期内，账户有投资金额，则无法删除成功
        onChainWLMap[whitelistAddr] = false; //tc-39:删除成功后线上白名单Map中查询已被删除的账户状态未false
        for (uint256 i = 0; i < onChainWL.length; i++) {
            if (onChainWL[i] == whitelistAddr) {
                onChainWL[i] = onChainWL[onChainWL.length - 1];
                onChainWL.pop(); //tc-39:删除成功后线上白名单列表长度减一
                break;
            }
        }
    }


     /**
      * @notice  Adds an address to the OffChain Whitelist, allowing it to participate in the vault offChain.
      * @dev     This function is only callable by the manager of the vault.
      * @param   whitelistAddr  The address to be added to the OffChain Whitelist.
      */
      //tc-54:认购期内添加不在白名单中的账户到线下白名单，添加成功
      //tc-54:认购期结束后添加不在白名单中的账户到线下白名单，添加失败
      //tc-54:MANAGER_ROLE角色的账户执行添加到线下白名单，且被添加的账户不在线上白名单执行成功
      //tc-54:不是MANAGER_ROLE角色的账户执行添加账户到线下白名单，执行失败
     function addToOffChainWL(
        address whitelistAddr
    ) public onlyRole(MANAGER_ROLE) {
        require(
            block.timestamp <= subEndTime,
            "Vault: Invalid time" //tc-54:认购期结束后，添加账户到线下白名单，添加失败
        );
        require(
            !onChainWLMap[whitelistAddr],
            "Vault: Address is already onChainWL" //tc-54：在认购期内，添加已经在线上白名单的账户到线下白名单，执行失败
        );
        require(!offChainWLMap[whitelistAddr], "Vault: Address is already offChainWL"); //tc-54：认购期结束后，添加账户到线下白名单，添加失败
        require(offChainWL.length < 100, "Vault: Whitelist is full");//tc-53：线下白名单账户数量等于100，继续添加，应该失败
        offChainWLMap[whitelistAddr] = true;
        offChainWL.push(whitelistAddr);
    }



    /**
     * @notice  Removes an address from the OffChain whitelist, preventing further participation in the vault.
     * @dev     This function can only be called by the manager of the vault.
     * @param   whitelistAddr   The address to be removed from the OffChain whitelist.
     */
     //tc-54:在认购期内，MANAGER_ROLE执行从线下白名单中删除在线下白名单中的账户，并且当前账户没有认购，删除成功
     //tc-54:在认购期结束后从线下白名单中删除在线下白名单中的账户，删除失败
     //tc-54:在认购期内，非MANAGER_ROLE执行从线下白名单中删除在线下白名单中的账户，执行失败
    function removeFromOffChainWL(
        address whitelistAddr
    ) public onlyRole(MANAGER_ROLE) {
        require(
            block.timestamp <= subEndTime,
            "Vault: Invalid time" //tc-54:认购期结束后，从线下白名单中删除未认购资产的账户，删除失败；//tc-54:认购期结束后，从线下白名单中删除已经认购资产的账户，删除失败
        );
        require(
            offChainWLMap[whitelistAddr],
            "Vault: Address is not in the offChain whitelist" //tc-54：认购期内，从线下白名单中删除不在线下白名单的账户，执行失败
        );
        require(balanceOf(whitelistAddr)<=0, "Vault: Address has balance"); //tc-54：认购期内，从线下白名单中删除已经认购资产的账户，删除失败
        offChainWLMap[whitelistAddr] = false;
        for (uint256 i = 0; i < offChainWL.length; i++) {
            if (offChainWL[i] == whitelistAddr) {
                offChainWL[i] = offChainWL[onChainWL.length - 1];
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
     //派息是否有时间限制
     //tc-46:不是MANAGER_ROLE角色的账户执行dividend，执行失败
     //tc-46:是MANAGER_ROLE角色的账户执行dividend，执行成功
    function dividend() public onlyRole(MANAGER_ROLE) {
        uint256 totalDividend = IERC20(assetToken).balanceOf(dividendTreasury);
        require(totalDividend > 0, "Vault: No dividend to pay"); //tc-45:No dividend to pay；//tc-49:vaultDiveidend address金额为0，vault执行派息
        uint256 totalSupply = totalSupply();
        require(totalSupply > 0, "Vault: No rbu to pay");
        for (uint8 i = 0; i < onChainWL.length; i++) {
            if (onChainWLMap[onChainWL[i]]) {
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
        for (uint8 i=0; i<offChainWL.length; i++){
            if (offChainWLMap[offChainWL[i]]){
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

    /**
     * @notice Calculates the price of a single share in the vault.
     * @dev The price is determined by fetching the NAV (Net Asset Value) from the RBF contract
     *      and adjusting it according to the price feed's decimal format.
     * @return The price of one share in the vault.
     */
     //tc-50:查询vault的price
    function price() public view returns (uint256) {
        uint256 totalSupply = totalSupply();
        uint256 nav = RBF(rbf).getAssetsNav();
        return nav * (10**decimals())  / totalSupply;
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
     //tc-43:白名单的账户向不是白名单的账户转账,执行失败
     //tc-54:认购期内线上白名单账户给线下白名单账户转账，执行失败
     //tc-54:认购期内线上白名单账户给线上白名单账户转账，执行失败
     //tc-54:认购期内线下白名单账户给线上白名单账户转账，执行失败
     //tc-54:认购期内线下白名单账户给线下白名单账户转账，执行失败
     //tc-54:认购期结束后，执行策略之前线上白名单账户给线下白名单账户转账，执行失败
     //tc-54:认购期结束后，执行策略之前线上白名单账户给线上白名单账户转账，执行失败
     //tc-54:认购期结束后，执行策略之前线下白名单账户给线下白名单账户转账，执行失败
     //tc-54:认购期结束后，执行策略之前线下白名单账户给线上白名单账户转账，执行失败
     //tc-54:认购期结束且执行策略后线上白名单给线下白名单账户转账，执行成功
     //tc-54:认购期结束且执行策略后线下白名单给线上白名单账户转账，执行成功
     //tc-54:认购期结束且执行策略后线下白名单给线下白名单账户转账，执行成功
     //tc-54:认购期结束且执行策略后线下白名单给线下白名单账户转账，执行成功
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
     //tc-43:白名单中的账户向非白名单的账户转账，执行失败
     //tc-43:非白名单中的账户向白名单的账户转账，执行失败
     //tc-43:白名单的账户向白名单中的账户转账（授权前）执行失败
     //tc-43:白名单的账户向白名单中的账户转账（授权后）执行成功
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
        require(receipter != address(0), "Vault: receipter can not be zero");//覆盖不到，尝试把零地址加入Vault白名单并且在派息前将认购的份额转个零地址，但是转不成功，没办法模拟向零地址派息
        uint256 dividendAmount = (vaultTokenAmount * totalDividend) /
            totalSupply;
        require(dividendAmount > 0, "Vault: dividendAmount must bigger than zero");
        SafeERC20.safeTransferFrom(
            IERC20(assetToken),
            dividendTreasury,
            receipter,
            dividendAmount
        );
    }

    function _checkTransferAuth(address from, address to) internal view {
        require(endTime != 0, "Vault: Invalid endTime"); //tc-43：
        require(block.timestamp >= subEndTime, "Vault: Invalid time"); //tc-43
        require(
            (maxSupply * fundThreshold) / BPS_DENOMINATOR <= totalSupply(),
            "Vault: not allowed transfer" //会卡在invalid endTime，执行不到
        );
        require(
            (onChainWLMap[from]|| offChainWLMap[from]) && (onChainWLMap[to]|| offChainWLMap[to]),
            "Vault: transfer from and to must in onChainWL or offChainWL" //tc-43
        );
    }

    function _getMintAmountForPrice(
        uint256 depositAmount
    ) internal view returns (uint256) {
        require(financePrice > 0, "Vault: financePrice must bigger than zero"); //financePrice为0在部署和设置时会被拦截
        uint256 rwaAmount = (_scaleUp(depositAmount) *
            FINANCE_PRICE_DENOMINATOR) / financePrice;
        return rwaAmount;
    }
    
    function _getAssetAmountForVault(
        uint256 vaultAmount
    ) internal view returns (uint256) {
        require(financePrice > 0, "Vault: financePrice must bigger than zero");//financePrice为0在部署和设置时会被拦截
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

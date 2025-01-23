// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interface/IRBUManager.sol";

contract Vault is ERC4626, Ownable, AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 public constant BPS_DENOMINATOR = 10_000;
    address public immutable rbuManager;
    uint256 public maxSupply;
    uint256 public subStartTime;
    uint256 public subEndTime;
    uint256 public duration;
    uint256 public fundThreshold;
    uint256 public managerFee;
    uint256 public minDepositAmount;
    address public feeEscrow;
    address public dividendEscrow;
    address public manager;
    uint256 public totalDeposit;
    uint256 public withdrawTime;
    mapping(address => bool) private whitelist;
    address[] private whitelistedAddresses;

    modifier onlyWhiteList(address _address) {
        require(whitelist[_address], "Not white list");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        address _assetToken,
        address _rbuManager,
        address _feeEscrow,
        address _dividendEscrow
    ) ERC4626(IERC20(_assetToken)) ERC20(_name, _symbol) Ownable() {
        require(_assetToken != address(0), "Invalid address");
        require(_rbuManager != address(0), "Invalid address");
        rbuManager = _rbuManager;
        require(_feeEscrow != address(0), "Invalid address");
        feeEscrow = _feeEscrow;
        require(_dividendEscrow != address(0), "Invalid address");
        dividendEscrow = _dividendEscrow;
    }

    function setManager(address _manager) external onlyOwner {
        if (manager != address(0)) {
            _revokeRole(MANAGER_ROLE, manager);
        }
        require(_manager != address(0), "Invalid address");
        manager = _manager;
        _grantRole(MANAGER_ROLE, _manager);
    }

    function setMaxsupply(uint256 _maxSupply) external onlyOwner {
        require(_maxSupply > 0, "Invalid maxSupply");
        maxSupply = _maxSupply;
    }

    function setSubTime(
        uint256 _subStartTime,
        uint256 _subEndTime
    ) external onlyOwner {
        require(_subStartTime < _subEndTime, "Invalid subTime");
        subStartTime = _subStartTime;
        subEndTime = _subEndTime;
    }

    function setDuration(uint256 _duration) external onlyOwner {
        require(_duration > 0, "Invalid duration");
        duration = _duration;
    }

    function setFundThreshold(uint256 _fundThreshold) external onlyOwner {
        require(
            _fundThreshold > 0 && _fundThreshold <= BPS_DENOMINATOR,
            "Invalid fundThreshold"
        );
        fundThreshold = _fundThreshold;
    }

    function setMinDepositAmount(uint256 _minDepositAmount) external onlyOwner {
        require(
            _minDepositAmount > 0 && _minDepositAmount <= maxSupply,
            "Invalid minDepositAmount"
        );
        minDepositAmount = _minDepositAmount;
    }

    function setManagerFee(uint256 _managerFee) external onlyOwner {
        require( _managerFee <= BPS_DENOMINATOR,"Invalid managerFee");
        managerFee = _managerFee;
    }

    function deposit(
        uint256 assets,
        address receiver
    ) public virtual override onlyWhiteList(msg.sender) returns (uint256) {
        require(receiver==msg.sender, "Vault: receiver must be msg.sender");
        require(assets <= maxDeposit(receiver), "Vault: deposit more than max");
        require(assets >= minDepositAmount, "Vault: deposit less than min");
        require(
            block.timestamp >= subStartTime && block.timestamp <= subEndTime,
            "Invalid time"
        );
        require(totalDeposit < maxSupply, "Vault: maxSupply reached");
        require(assets<=(maxSupply-totalDeposit),"Vault: maxSupply reached");

        uint256 amountFee = (assets * managerFee) / BPS_DENOMINATOR;

        SafeERC20.safeTransferFrom(
            IERC20(asset()),
            msg.sender,
            feeEscrow,
            amountFee
        );

        uint256 shares = previewDeposit(assets);
        _deposit(_msgSender(), receiver, assets, shares);
        totalDeposit = totalDeposit + assets;
        return shares;
    }

    function mint(
        uint256 shares,
        address receiver
    ) public virtual override returns (uint256) {
        revert("not support mint");
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override returns (uint256) {
        revert("not support withdraw");
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public virtual override onlyWhiteList(msg.sender) returns (uint256) {
        require(receiver==msg.sender, "Vault: receiver must be msg.sender");
        require(owner==msg.sender, "Vault: owner must be msg.sender");
        require(shares <= maxRedeem(owner), "ERC4626: redeem more than max");
        require(withdrawTime!=0 && block.timestamp >= withdrawTime, "Vault: WithdrawTime not reached");

        uint256 assets = previewRedeem(shares);
        _withdraw(_msgSender(), receiver, owner, assets, shares);

        return assets;
    }

    function withdrawFund()
        public
        virtual
        onlyWhiteList(msg.sender)
        returns (uint256)
    {
        require(block.timestamp >= subEndTime, "Invalid time");
        require(
            (maxSupply * fundThreshold) / BPS_DENOMINATOR > totalDeposit,
            "not allowed withdraw"
        );
        uint256 shares = balanceOf(msg.sender);
        uint256 assets = previewRedeem(shares);
        _withdraw(_msgSender(), msg.sender, msg.sender, assets, shares);
        uint256 feeAmount = shares /
            (1 - managerFee / BPS_DENOMINATOR) -
            shares;
        SafeERC20.safeTransferFrom(
            IERC20(asset()),
            feeEscrow,
            msg.sender,
            feeAmount
        );
        return assets + feeAmount;
    }

    function execStrategy() public onlyRole(MANAGER_ROLE) {
        require(
            totalDeposit == maxSupply ||
                (block.timestamp >= subEndTime &&
                    (maxSupply * fundThreshold) / BPS_DENOMINATOR <=
                    totalDeposit),
            "fundraising fail"
        );
        address assetToken= asset();
        uint256 asset = IERC20(assetToken).balanceOf(address(this));
        IERC20(assetToken).approve(rbuManager, asset);
        IRBUManager(rbuManager).deposit(asset);
        withdrawTime = block.timestamp + duration;
    }

    function harvest() public onlyRole(MANAGER_ROLE) {
        address rbuShareToken = IRBUManager(rbuManager).getRBUShareToken();
        uint256 rbuShares = IERC20(rbuShareToken).balanceOf(address(this));
        IERC20(rbuShareToken).approve(rbuManager, rbuShares);
        IRBUManager(rbuManager).withdraw(rbuShares);
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

    function getDividendEscrow() public view returns (address) {
        return dividendEscrow;
    }

    function getAllWhitelistedAddresses()
        external
        view
        returns (address[] memory)
    {
        return whitelistedAddresses;
    }

    function dividend() public onlyRole(MANAGER_ROLE) {
        uint256 totalDividend = IERC20(asset()).balanceOf(dividendEscrow);
        require(totalDividend>0, "No dividend to pay");
        uint256 totalSupply = totalSupply();
        require(totalSupply>0, "No rbu to pay");
        for (uint8 i = 0; i < whitelistedAddresses.length; i++) {
            if (whitelist[whitelistedAddresses[i]]) {
                if(balanceOf(whitelistedAddresses[i])!=0){
                    _dividend(
                        balanceOf(whitelistedAddresses[i]),
                        totalSupply,
                        totalDividend,
                        whitelistedAddresses[i]
                    );
                }
                
            }
        }
    }

    function _dividend(
        uint256 vaultTokenAmount,
        uint256 totalSupply,
        uint256 totalDividend,
        address receipter
    ) internal {
        uint256 dividendAmount = (vaultTokenAmount * totalDividend) /
            totalSupply;
        require(dividendAmount>0, "dividendAmount must bigger than zero");
        SafeERC20.safeTransferFrom(
            IERC20(asset()),
            dividendEscrow,
            receipter,
            dividendAmount
        );
    }

    function withdrawFee(address receiver) public onlyRole(MANAGER_ROLE){
        require(withdrawTime!=0, "withdrawTime is zero");
        uint256 balance = IERC20(asset()).balanceOf(feeEscrow);
        SafeERC20.safeTransferFrom(IERC20(asset()),feeEscrow, receiver, balance);
    }
    

    function price() public view returns (uint256) {
       uint256 totalSupply=totalSupply();
       if (totalSupply==0){
           return 1e18;
       }
       uint256 nav=IERC20(asset()).balanceOf(address(this))+IRBUManager(rbuManager).getAssetsNav();
       return nav*1e18/totalSupply;
    }

    function totalAssets() public view virtual override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this))+IRBUManager(rbuManager).getAssetsNav();
    }


    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        revert("not supprot transfer");
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        revert("not supprot transfer");
    }

     function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}

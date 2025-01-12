// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interface/IRBUManager.sol";



contract Vault is ERC4626,Ownable,AccessControl{


    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 public constant BPS_DENOMINATOR = 10_000;
    address public immutable assetToken;
    address public immutable rbuManager;
    address public immutable feeEscrow;
    uint256 public maxSupply;
    uint256 public subStartTime;
    uint256 public subEndTime;
    uint256 public duration;
    uint256 public fundThreshold;
    uint256 public managerFee;
    uint256 public minDepositAmount;
    address public manager;
    uint256 public totalDeposit;
    uint256 public withdrawTime; 


    constructor(
        string memory _name,  
        string memory _symbol,
        address _assetToken,
        address _rbuManager,
        address _feeEscrow,
        // uint256 _managerFee,
        address _manager
    ) ERC4626(IERC20(address(_assetToken))) ERC20(_name,_symbol) Ownable(){
        require(_manager!=address(0),"Manager address cannot be zero address");
        manager = _manager;
        _grantRole(MANAGER_ROLE,_manager);

        require(_assetToken!=address(0),"Invalid address");
        assetToken=_assetToken;
        require(_rbuManager!=address(0),"Invalid address");
        rbuManager=_rbuManager;
        require(_feeEscrow!=address(0),"Invalid address");
        feeEscrow = _feeEscrow;
    }

    function setMaxsupply(uint256 _maxSupply) external onlyOwner(){
        require(_maxSupply>0,"Invalid maxSupply");
        maxSupply=_maxSupply;
    }

    function setSubTime(uint256 _subStartTime,uint256 _subEndTime) external onlyOwner()  {
        require(_subStartTime<_subEndTime,"Invalid subTime");
        subStartTime=_subStartTime;
        subEndTime=_subEndTime;
    }

    function setDuration(uint256 _duration) external onlyOwner()  {
        require(_duration>0,"Invalid duration");
        duration=_duration;
    }

    function setFundThreshold(uint256 _fundThreshold) external onlyOwner(){
        require(_fundThreshold>0 && _fundThreshold<=BPS_DENOMINATOR,"Invalid fundThreshold");
        fundThreshold=_fundThreshold;
    }

    function setMinDepositAmount(uint256 _minDepositAmount) external onlyOwner(){
        require(minDepositAmount>0 && minDepositAmount<maxSupply,"Invalid minDepositAmount");
        minDepositAmount=_minDepositAmount;
    }

    function setManagerFee(uint256 _managerFee) external onlyOwner(){
        require(_managerFee>0 && _managerFee<=BPS_DENOMINATOR,"Invalid managerFee");
        managerFee=_managerFee;
    }

    function deposit(uint256 assets, address receiver) public virtual override returns (uint256) {
        
        require(assets <= maxDeposit(receiver), "Vault: deposit more than max");
        require(assets >= minDepositAmount,"Vault: deposit less than min");
        require(block.timestamp>=subStartTime && block.timestamp<=subEndTime,"Invalid time");
        require(totalDeposit<maxSupply,"Vault: maxSupply reached");

        uint256 amountFee = assets * managerFee / BPS_DENOMINATOR;
        uint256 amount = assets - amountFee;

        SafeERC20.safeTransferFrom(IERC20(assetToken), msg.sender, feeEscrow, amountFee);

        uint256 shares = previewDeposit(amount);
        _deposit(_msgSender(), receiver, amount, shares);
        totalDeposit=totalDeposit+amount;
        return shares;
    }
    

    function mint(uint256 shares, address receiver) public virtual override returns (uint256) {
        revert("not support mint");
    }

    function withdraw(uint256 assets, address receiver, address owner) public virtual override returns (uint256) {
        revert("not support withdraw");
    }


    function redeem(uint256 shares, address receiver, address owner) public virtual override returns (uint256) {
        require(shares <= maxRedeem(owner), "ERC4626: redeem more than max");
        require(block.timestamp>=withdrawTime,"Invalid time");

        uint256 assets = previewRedeem(shares);
        _withdraw(_msgSender(), receiver, owner, assets, shares);

        return assets;
    }


    function withdrawFund() external virtual returns (uint256) {
        require(block.timestamp>=subEndTime,"Invalid time");
        require(maxSupply*fundThreshold/BPS_DENOMINATOR>totalDeposit,"not allowed withdraw");
        uint256 shares = balanceOf(msg.sender);

        uint256 assets = previewRedeem(shares);
        _withdraw(_msgSender(), msg.sender, msg.sender, assets, shares);

        uint256 feeAmount= shares/(1-managerFee/BPS_DENOMINATOR) - shares;
        SafeERC20.safeTransferFrom(IERC20(assetToken), feeEscrow, msg.sender,feeAmount);
        return assets+feeAmount;
    }


    function execStrategy() public onlyRole(MANAGER_ROLE){
        require(totalDeposit==maxSupply || (block.timestamp>=subEndTime && maxSupply*fundThreshold/BPS_DENOMINATOR<=totalDeposit),"fundraising fail");
        uint256 asset= IERC20(assetToken).balanceOf(address(this));
        IERC20(assetToken).approve(rbuManager, asset);
        IRBUManager(rbuManager).deposit(asset);
        withdrawTime=block.timestamp+duration;
    }


    function harvest() public onlyRole(MANAGER_ROLE){
        address rbuShareToken = IRBUManager(rbuManager).getRBUShareToken();
        uint256 rbuShares=IERC20(rbuShareToken).balanceOf(address(this));
        IERC20(rbuShareToken).approve(rbuManager, rbuShares);
        IRBUManager(rbuManager).withdraw(rbuShares);
    }


    function getTotalDeposit() public view returns (uint256) {
        return totalDeposit;
    }

}
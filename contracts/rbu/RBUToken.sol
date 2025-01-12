// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interface/IPricer.sol";
import "../interface/IRBUToken.sol";

contract RBUToken is ERC20,IRBUToken {

  event Mint(address indexed _account, uint256 _amount);
  event Burn(address indexed _account, uint256 _amount);
  
  address public immutable rbuTokenManager;

  constructor(
    string memory _name,  
    string memory _symbol,
    address _rbuTokenManager
  ) ERC20(_name,_symbol){
    rbuTokenManager=_rbuTokenManager;
  }

  modifier onlyManager() {
    require(msg.sender == rbuTokenManager, "MintableERC20: only manager can mint and burn");
    _;
  }
  
  function transfer(address to, uint256 value) public pure override(ERC20, IERC20) returns (bool success) {
    revert("not support");
  }

  function transferFrom(address from, address to, uint256 amount) public  pure override(ERC20, IERC20) returns (bool){
    revert("not support");
  }

  function mint(address _to, uint256 _amount) external override onlyManager()  {
    _mint(_to, _amount);
    emit Mint(_to, _amount);
  }

  function burn(address _from, uint256 _amount) external override onlyManager()  {
    _spendAllowance(_from, msg.sender, _amount);
    _burn(_from, _amount);
    emit Burn(_from, _amount);
  }
  
}
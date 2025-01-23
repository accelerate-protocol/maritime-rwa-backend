// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDT is ERC20, Ownable {
    event Mint(address indexed _account, uint256 _amount);
    event Burn(address indexed _account, uint256 _amount);

    constructor(
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) Ownable() {}

    function mint(address _to, uint256 _amount) external {
        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) external {
        _spendAllowance(_from, msg.sender, _amount);
        _burn(_from, _amount);
        emit Burn(_from, _amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }





}

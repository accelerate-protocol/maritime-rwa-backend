// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    event Mint(address indexed account, uint256 amount);
    event Burn(address indexed account, uint256 amount);

    constructor(
        string memory tokenName,
        string memory tokenSymbol
    ) ERC20(tokenName, tokenSymbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
        emit Mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
        emit Burn(from, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;
    address public vault;
    bool private initialized;
    
    // 存储name和symbol，因为基类的name和symbol是immutable
    string private _name;
    string private _symbol;
    
    constructor() ERC20("", "") {
        // 空构造函数，支持Clones模式
        // 传入空的name和symbol，稍后在initToken中设置
    }
    
    // 初始化函数（用于Clones模式）
    function initToken(
        address _vault, // 设置vault地址
        string memory tokenName,
        string memory tokenSymbol,
        uint8 decimals_
    ) external {
        require(!initialized, "MockERC20: already initialized");
        initialized = true;
        vault = _vault;
        _name = tokenName;
        _symbol = tokenSymbol;
        _decimals = decimals_;
    }
    
    // 重写name和symbol函数，返回我们存储的值
    function name() public view virtual override returns (string memory) {
        return _name;
    }
    
    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function _afterTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
        // Mock实现，不包含具体业务逻辑
    }
} 
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../../interfaces/IToken.sol";

contract MockStandardToken is ERC20, Pausable, IToken {
    address public vault;
    address public accumulatedYield;
    
    modifier onlyVault() {
        require(msg.sender == vault, "MockStandardToken: only vault");
        _;
    }
    
    constructor() ERC20("Mock Token", "MOCK") {
        // 构造函数为空，支持Clones模式
    }
    
    function decimals() public view virtual override(ERC20, IToken) returns (uint8) {
        return ERC20.decimals();
    }
    
    function name() public view virtual override(ERC20, IToken) returns (string memory) {
        return ERC20.name();
    }
    
    function symbol() public view virtual override(ERC20, IToken) returns (string memory) {
        return ERC20.symbol();
    }
    
    function paused() public view virtual override(Pausable, IToken) returns (bool) {
        return Pausable.paused();
    }
    
    // 初始化函数（用于Clones模式）
    function initToken(
        address _vault,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external {
        require(vault == address(0), "MockStandardToken: already initialized");
        vault = _vault;
        // 注意：这里简化实现，实际应该设置name和symbol
    }
    
    function mint(address to, uint256 amount) external override onlyVault {
        _mint(to, amount);
    }
    
    function burnFrom(address account, uint256 amount) external override onlyVault {
        _burn(account, amount);
    }
    
    function pause() external override onlyVault whenNotPaused {
        _pause();
    }
    
    function unpause() external override onlyVault whenPaused {
        _unpause();
    }
    
    function setAccumulatedYield(address _accumulatedYield) external {
        accumulatedYield = _accumulatedYield;
    }
    
    function _afterTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
        
        // 调用AccumulatedYield的更新函数
        if (accumulatedYield != address(0) && from != address(0) && to != address(0)) {
            (bool success, ) = accumulatedYield.call(
                abi.encodeWithSignature("updateUserPoolsOnTransfer(address,address,uint256)", from, to, amount)
            );
            // 静默失败，不影响转账
        }
    }
    
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        require(!paused(), "MockStandardToken: token transfer while paused");
    }
} 
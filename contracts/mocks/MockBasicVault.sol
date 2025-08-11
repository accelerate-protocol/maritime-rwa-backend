// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../v2/interfaces/IVault.sol";

contract MockBasicVault is IVault {
    address public override vaultToken;
    address public override manager;
    bool public override whitelistEnabled;
    mapping(address => bool) public override isWhitelisted;
    address public override validator;
    bytes public override dataHash;
    bytes public override signature;
    bool public tokenPaused;
    
    // 添加模块地址
    address public fundingModule;
    address public dividendModule;
    
    modifier onlyManager() {
        require(msg.sender == manager, "MockBasicVault: only manager");
        _;
    }
    
    // 初始化函数（用于Clones模式）
    function initVault(
        address _manager,
        address _validator,
        bool _whitelistEnabled,
        address[] memory _initialWhitelist
    ) external {
        require(manager == address(0), "MockBasicVault: already initialized");
        manager = _manager;
        validator = _validator;
        whitelistEnabled = _whitelistEnabled;
        
        // 添加初始白名单
        for (uint256 i = 0; i < _initialWhitelist.length; i++) {
            isWhitelisted[_initialWhitelist[i]] = true;
        }
    }
    
    function addToWhitelist(address _addr) external override onlyManager {
        isWhitelisted[_addr] = true;
        emit WhitelistAdded(_addr);
    }
    
    function removeFromWhitelist(address _addr) external override onlyManager {
        isWhitelisted[_addr] = false;
        emit WhitelistRemoved(_addr);
    }
    
    function enableWhitelist() external onlyManager {
        whitelistEnabled = true;
        emit WhitelistStatusChanged(true);
    }
    
    function disableWhitelist() external onlyManager {
        whitelistEnabled = false;
        emit WhitelistStatusChanged(false);
    }
    
    function isWhiteList() external view override returns (bool) {
        return whitelistEnabled;
    }
    
    function verify() external pure override returns (bool) {
        return true;
    }
    
    function updateVerifyData(bytes memory hash, bytes memory _signature) external override onlyManager {
        dataHash = hash;
        signature = _signature;
        emit VerifyDataUpdated(hash, _signature);
    }
    
    function pauseToken() external override onlyManager {
        tokenPaused = true;
        emit TokenPaused();
    }
    
    function unpauseToken() external override onlyManager {
        tokenPaused = false;
        emit TokenUnpaused();
    }
    
    function isTokenPaused() external view override returns (bool) {
        return tokenPaused;
    }
    
    function mintToken(address to, uint256 amount) external override onlyManager {
        // Mock implementation
    }
    
    function burnToken(address from, uint256 amount) external override onlyManager {
        // Mock implementation
    }
    
    function updateUserPoolsOnTransfer(address from, address to, uint256 amount) external override {
        // Mock implementation
    }
    
    // 设置模块地址
    function setFundingModule(address _fundingModule) external onlyManager {
        fundingModule = _fundingModule;
    }
    
    function setDividendModule(address _dividendModule) external onlyManager {
        dividendModule = _dividendModule;
    }
    
    function setVaultToken(address _vaultToken) external onlyManager {
        vaultToken = _vaultToken;
    }
    

} 
// SPDX-License-Identifier: MIT
/**
    ___                         __                         __
   /   |  _____  _____  ___    / /  ___    _____  ____ _  / /_  ___
  / /| | / ___/ / ___/ / _ \  / /  / _ \  / ___/ / __ `/ / __/ / _ \
 / ___ |/ /__  / /__  /  __/ / /  /  __/ / /    / /_/ / / /_  /  __/
/_/  |_|\___/  \___/  \___/ /_/   \___/ /_/     \__,_/  \__/  \___/
*/
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/core/IValidatorRegistry.sol";

contract ValidatorRegistry is IValidatorRegistry,Ownable,AccessControl{


    event ValidatorSet(address validator);

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    address private validator;

    constructor(address _validator,address _manager) Ownable(msg.sender) {
        require(_validator != address(0), "ValidatorRegistry: invalid validator address");
        validator = _validator;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, _manager);
        _setRoleAdmin(MANAGER_ROLE, DEFAULT_ADMIN_ROLE);
    }

    function setValidator(address _validator) public onlyRole(MANAGER_ROLE) {
        require(_validator!=address(0) && _validator!=validator,"ValidatorRegistry: invalid address");
        validator = _validator;
        emit ValidatorSet(validator);
    }

    function getValidator() public view returns(address){
        return validator;
    }

}
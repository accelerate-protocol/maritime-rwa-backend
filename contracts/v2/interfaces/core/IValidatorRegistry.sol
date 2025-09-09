// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IValidatorRegistry {

    function getValidator() external view returns(address);
    function setValidator(address _validator) external;
    
}
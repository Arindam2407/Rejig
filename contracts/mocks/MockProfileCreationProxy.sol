// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {IRejig} from '../interfaces/IRejig.sol';
import {DataTypes} from '../libraries/DataTypes.sol';
import {Errors} from '../libraries/Errors.sol';

/**
 * @title MockProfileCreationProxy
 * @author Lens Protocol
 *
 * @notice This is a proxy contract that enforces ".test" handle suffixes and adds char validations at profile creation.
 */
contract MockProfileCreationProxy {
    IRejig immutable REJIG;

    constructor(IRejig hub) {
        REJIG = hub;
    }

    function proxyCreateProfile(DataTypes.CreateProfileData memory vars) external {
        uint256 handleLength = bytes(vars.handle).length;
        if (handleLength < 5) revert Errors.HandleLengthInvalid();

        bytes1 firstByte = bytes(vars.handle)[0];
        if (firstByte == '-' || firstByte == '_' || firstByte == '.')
            revert Errors.HandleFirstCharInvalid();

        for (uint256 i = 1; i < handleLength; ) {
            if (bytes(vars.handle)[i] == '.') revert Errors.HandleContainsInvalidCharacters();
            unchecked {
                ++i;
            }
        }

        vars.handle = string(abi.encodePacked(vars.handle, '.test'));
        REJIG.createProfile(vars);
    }
}

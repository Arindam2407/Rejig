// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {DataTypes} from '../../libraries/DataTypes.sol';

/**
 * @title RejigStorage
 * @author Lens Protocol
 *
 * @notice This is an abstract contract that *only* contains storage for the Rejig contract. This
 * *must* be inherited last (bar interfaces) in order to preserve the Rejig storage layout. Adding
 * storage variables should be done solely at the bottom of this contract.
 */
abstract contract RejigStorage {

    mapping(uint256 => address) internal _dispatcherByProfile;
    mapping(bytes32 => uint256) internal _profileIdByHandleHash;
    mapping(uint256 => DataTypes.ProfileStruct) internal _profileById;
    mapping(uint256 => mapping(uint256 => DataTypes.PublicationStruct)) internal _pubByIdByProfile;
    mapping(uint256 => DataTypes.Bond[]) internal _bondsById;
    mapping(bytes => int) internal _followerDifferenceByEncodedBondID;
    mapping(address=>uint) internal userToId;
    mapping(address=>bool) internal profileInitiated;
    mapping(string=>bool) internal handleInitiated;
    mapping(address=>string[]) public userToPosts;
    mapping(address=>mapping(uint=>address)) public _auctionsByProfileByPubCount;
    mapping(address=>mapping(uint=>bool)) public NFTsBought;
    mapping(address=>mapping(uint=>DataTypes.EndorsedTokenData)) public tokensEndorsed;
    mapping(address=>uint) public bondCounter;
    
    bytes[] public bondBytes; 

    uint256 internal _profileCounter;
    address internal _governance;
    address internal _emergencyAdmin;
}



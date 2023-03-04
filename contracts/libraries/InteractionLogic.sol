// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {FollowNFTProxy} from '../upgradeability/FollowNFTProxy.sol';
import {TransactionNFTProxy} from '../upgradeability/TransactionNFTProxy.sol';
import {DataTypes} from './DataTypes.sol';
import {Errors} from './Errors.sol';
import {Events} from './Events.sol';
import {Constants} from './Constants.sol';
import {IFollowNFT} from '../interfaces/IFollowNFT.sol';
import {IFollowModule} from '../interfaces/IFollowModule.sol';
import {ITransactionNFT} from '../interfaces/ITransactionNFT.sol';
import {ITransactionModule} from '../interfaces/ITransactionModule.sol';
import {Clones} from '@openzeppelin/contracts/proxy/Clones.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';

/**
 * @title InteractionLogic
 * @author Lens Protocol (Modified by Rejig)
 *
 * @notice This is the library that contains the logic for follows. 
 
 * @dev The functions are external, so they are called from the hub via `delegateCall` under the hood.
 */
library InteractionLogic {
    using Strings for uint256;

    /**
     * @notice Follows the given profiles, executing the necessary logic and module calls before minting the follow
     * NFT(s) to the follower.
     *
     * @param follower The address executing the follow.
     * @param profileIds The array of profile token IDs to follow.
     * @param followModuleDatas The array of follow module data parameters to pass to each profile's follow module.
     * @param _profileById A pointer to the storage mapping of profile structs by profile ID.
     * @param _profileIdByHandleHash A pointer to the storage mapping of profile IDs by handle hash.
     *
     * @return uint256[] An array of integers representing the minted follow NFTs token IDs.
     */
    function follow(
        address follower,
        uint256[] calldata profileIds,
        bytes[] calldata followModuleDatas,
        mapping(uint256 => DataTypes.ProfileStruct) storage _profileById,
        mapping(bytes32 => uint256) storage _profileIdByHandleHash
    ) external returns (uint256[] memory) {
        if (profileIds.length != followModuleDatas.length) revert Errors.ArrayMismatch();
        uint256[] memory tokenIds = new uint256[](profileIds.length);
        for (uint256 i = 0; i < profileIds.length; ) {
            string memory handle = _profileById[profileIds[i]].handle;
            if (_profileIdByHandleHash[keccak256(bytes(handle))] != profileIds[i])
                revert Errors.TokenDoesNotExist();

            address followModule = _profileById[profileIds[i]].followModule;
            address followNFT = _profileById[profileIds[i]].followNFT;

            if (followNFT == address(0)) {
                followNFT = _deployFollowNFT(profileIds[i]);
                _profileById[profileIds[i]].followNFT = followNFT;
            }

            tokenIds[i] = IFollowNFT(followNFT).mint(follower);

            if (followModule != address(0)) {
                IFollowModule(followModule).processFollow(
                    follower,
                    profileIds[i],
                    followModuleDatas[i]
                );
            }
            unchecked {
                ++i;
            }
        }
        emit Events.Followed(follower, profileIds, followModuleDatas, block.timestamp);
        return tokenIds;
    }

    /**
     * @notice Deploys the given profile's Follow NFT contract.
     *
     * @param profileId The token ID of the profile which Follow NFT should be deployed.
     *
     * @return address The address of the deployed Follow NFT contract.
     */
    function _deployFollowNFT(uint256 profileId) private returns (address) {
        bytes memory functionData = abi.encodeWithSelector(
            IFollowNFT.initialize.selector,
            profileId
        );
        address followNFT = address(new FollowNFTProxy(functionData));
        emit Events.FollowNFTDeployed(profileId, followNFT, block.timestamp);

        return followNFT;
    }

    function transact(
        address seller,
        address hub,
        uint nftId,
        mapping(uint256 => DataTypes.ProfileStruct) storage _profileById,
        mapping(address => uint256) storage userToId
    ) external {
            address transactionNFT = _profileById[userToId[seller]].transactionNFT;

            if (transactionNFT == address(0)) {
                transactionNFT = _deployTransactionNFT(userToId[seller]);
                _profileById[userToId[seller]].transactionNFT = transactionNFT;
            }

            ITransactionNFT(transactionNFT).mint(hub,nftId);
    }

        function _deployTransactionNFT(uint256 profileId) private returns (address) {
        bytes memory functionData = abi.encodeWithSelector(
            ITransactionNFT.initialize.selector,
            profileId
        );
        address transactionNFT = address(new TransactionNFTProxy(functionData));

        return transactionNFT;
    }


}


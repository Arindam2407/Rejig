// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {VersionedInitializable} from '../upgradeability/VersionedInitializable.sol';
import {IRejig} from '../interfaces/IRejig.sol';
import {IFollowModule} from '../interfaces/IFollowModule.sol';
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';

/**
 * @title AccessControl
 * @author Lens Protocol
 *
 * @notice This contract enables additional access control for encrypted publications on Rejig by reporting whether
 *      an address owns or has control over a given profile.
 */
contract AccessControlV2 is VersionedInitializable {
    uint256 internal constant REVISION = 2;

    address internal immutable REJIG;

    constructor(address _rejig) {
        REJIG = _rejig;
    }

    function initialize() external initializer {}

    /**
     * @dev Function used to check whether an address is the owner of a profile.
     *
     * @param requestorAddress The address to check ownership over a profile.
     * @param profileId The ID of the profile being checked for ownership.
     * @param data Optional data parameter, which may be used in future upgrades.
     * @return Boolean indicating whether address owns the profile or not.
     */
    function hasAccess(
        address requestorAddress,
        uint256 profileId,
        bytes memory data
    ) external view returns (bool) {
        return IERC721(REJIG).ownerOf(profileId) == requestorAddress;
    }

    function isFollowing(
        address requestorAddress,
        uint256 profileId,
        uint256 followerProfileId,
        bytes memory data
    ) external view returns (bool) {
        address followModule = IRejig(REJIG).getFollowModule(profileId);
        bool following;
        if (followModule != address(0)) {
            following = IFollowModule(followModule).isFollowing(profileId, requestorAddress, 0);
        } else {
            address followNFT = IRejig(REJIG).getFollowNFT(profileId);
            following =
                followNFT != address(0) &&
                IERC721(followNFT).balanceOf(requestorAddress) != 0;
        }
        return following || IERC721(REJIG).ownerOf(profileId) == requestorAddress;
    }

    function getRevision() internal pure virtual override returns (uint256) {
        return REVISION;
    }
}

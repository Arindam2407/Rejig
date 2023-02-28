// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {DataTypes} from '../libraries/DataTypes.sol';

/**
 * @title IRejigNFTBase
 * @author Lens Protocol
 *
 * @notice This is the interface for the RejigNFTBase contract, from which all Rejig NFTs inherit.
 * It is an expansion of a very slightly modified ERC721Enumerable contract, which allows expanded
 * meta-transaction functionality.
 */
interface IRejigNFTBase {

    /**
     * @notice Burns an NFT, removing it from circulation and essentially destroying it. This function can only
     * be called by the NFT to burn's owner.
     *
     * @param tokenId The token ID of the token to burn.
     */
    function burn(uint256 tokenId) external;

    /**
     * @notice Returns the domain separator for this NFT contract.
     *
     * @return bytes32 The domain separator.
     */
    function getDomainSeparator() external view returns (bytes32);
}

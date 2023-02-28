// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import '@openzeppelin/contracts/utils/Base64.sol';
import '@openzeppelin/contracts/utils/Strings.sol';

library PostNFTTokenURILogic {

    /**
     * @notice Generates the token URI for the profile NFT.
     *
     * @dev The decoded token URI JSON metadata contains the following fields: name, description, image and attributes.
     * The image field contains a base64-encoded SVG. Both the JSON metadata and the image are generated fully on-chain.
     *
     * @param deployerId The token ID of the profile.
     * @param nftId The token ID of the NFT.
     * @param contentURI description
     * @param deployer The address which owns the profile.
     * @param deployerHandle The profile's handle.
     * 
     * @return string The profile's token URI as a base64-encoded JSON string.
     */
    function getPostNFTTokenURI(
        uint256 deployerId,
        uint256 nftId,
        string memory contentURI,
        address deployer,
        string memory deployerHandle 
    ) external pure returns (string memory) {
        string memory handleWithAtSymbol = string(abi.encodePacked('@', deployerHandle));
        string memory nftName = string(abi.encodePacked(handleWithAtSymbol,'#',nftId));
        return
            string(
                abi.encodePacked(
                    'data:application/json;base64,',
                    Base64.encode(
                        abi.encodePacked(
                            '{"name":"',
                            nftName,
                            '","description":"',
                            contentURI,
                            '","attributes":[{"trait_type":"ownerId","value":"#',
                            Strings.toString(deployerId),
                            '"},{"trait_type":"NFTId","value":"',
                            Strings.toString(nftId),
                            '"},{"trait_type":"owner","value":"',
                            Strings.toHexString(uint160(deployer)),
                            '"},{"trait_type":"handle","value":"',
                            handleWithAtSymbol,
                            '"}]}'
                        )
                    )
                )
            );
    }
}
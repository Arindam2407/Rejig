// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

/**
 * @title DataTypes
 *
 * @notice A standard library of data types used throughout the Rejig.
 */
library DataTypes {
    /**
     * @notice An enum containing the different states the protocol can be in, limiting certain actions.
     *
     * @param Unpaused The fully unpaused state.
     * @param PublishingPaused The state where only publication creation functions are paused.
     * @param Paused The fully paused state.
     */
    enum ProtocolState {
        Unpaused,
        PublishingPaused,
        Paused
    }


    /**
     * @notice An enum containing the different states the NFT State can be in, limiting certain actions.
     *
     * @param Open when NFTs can be bought and sold.
     * @param Setting_yields yield setting period after every 24 hours. NFT transaction activity paused for some time.
     */
    enum NFTState {
        Open,
        Setting_yields
    }

    /**
     * @notice An enum specifically used in a helper function to easily retrieve the publication type for integrations.
     *
     * @param Post A standard post, having a URI and no pointer to another publication.
     * @param Comment A comment, having a URI and a pointer to another publication.
     * @param Mirror A mirror, having a pointer to another publication, but no URI.
     * @param Nonexistent An indicator showing the queried publication does not exist.
     */
    enum PubType {
        Post,
        Comment,
        Mirror,
        Nonexistent
    }

    /**
     * @notice A struct containing profile data.
     *
     * @param pubCount The number of publications made to this profile.
     * @param followerCount The number of followers.
     * @param NFTCount The number of NFTs posted till date.
     * @param approved whether user can post NFTs.
     * @param active whether user is active.
     * @param followModule The address of the current follow module in use by this profile, can be empty.
     * @param followNFT The address of the followNFT associated with this profile, can be empty..
     * @param handle The profile's associated handle.
     * @param imageURI The URI to be used for the profile's image.
     * @param followNFTURI The URI to be used for the follow NFT.
     */
    struct ProfileStruct{
        uint pubCount;
        uint followerCount;
        uint NFTCount;
        bool approved;
        bool active;
        address followModule;
        address followNFT;
        string handle;
        string imageURI;
        string followNFTURI;
    }

    /**
     * @notice A struct containing data associated with each new publication.
     *
     * @param profileIdPointed The profile token ID this publication points to, for mirrors and comments.
     * @param pubIdPointed The publication ID this publication points to, for mirrors and comments.
     * @param contentURI The URI associated with this publication.
     * @param referenceModule The address of the current reference module in use by this publication, can be empty.
     * @param associatedNFTId The NFT Id associated with the publication.
     * @param isMirror whether publication is a mirror.
     */
    struct PublicationStruct {
        uint256 profileIdPointed;
        uint256 pubIdPointed;
        string contentURI;
        address referenceModule;
        uint256 associatedNFTId;
        bool isMirror;
    }

    /**
     * @notice A struct containing the parameters required for the `createProfile()` function.
     *
     * @param to The address receiving the profile.
     * @param handle The handle to set for the profile, must be unique and non-empty.
     * @param imageURI The URI to set for the profile image.
     * @param followModule The follow module to use, can be the zero address.
     * @param followModuleInitData The follow module initialization data, if any.
     * @param followNFTURI The URI to use for the follow NFT.
     */
    struct CreateProfileData {
        address to;
        string handle;
        string imageURI;
        address followModule;
        bytes followModuleInitData;
        string followNFTURI;
    }

    /**
     * @notice A struct containing the parameters required for the `post()` function.
     *
     * @param profileId The token ID of the profile to publish to.
     * @param contentURI The URI to set for this new publication.
     * @param referenceModule The reference module to set for the given publication
     * @param referenceModuleInitData The data to be passed to the reference module for initialization.
     */
    struct PostData {
        uint256 profileId;
        string contentURI;
        address referenceModule;
        bytes referenceModuleInitData;
    }

    /**
     * @notice A struct containing the parameters required for the `comment()` function.
     *
     * @param profileId The token ID of the profile to publish to.
     * @param contentURI The URI to set for this new publication.
     * @param profileIdPointed The profile token ID to point the comment to.
     * @param pubIdPointed The publication ID to point the comment to.
     * @param referenceModuleData The data passed to the reference module.
     * @param referenceModule The reference module to set for the given publication
     * @param referenceModuleInitData The data to be passed to the reference module for initialization.
     */
    struct CommentData {
        uint256 profileId;
        string contentURI;
        uint256 profileIdPointed;
        uint256 pubIdPointed;
        bytes referenceModuleData;
        address referenceModule;
        bytes referenceModuleInitData;
    }

    /**
     * @notice A struct containing the parameters required for the `mirror()` function.
     *
     * @param profileId The token ID of the profile to publish to.
     * @param profileIdPointed The profile token ID to point the mirror to.
     * @param pubIdPointed The publication ID to point the mirror to.
     * @param referenceModuleData The data passed to the reference module.
     * @param referenceModule The reference module to set for the given publication
     * @param referenceModuleInitData The data to be passed to the reference module for initialization.
     */
    struct MirrorData {
        uint256 profileId;
        uint256 profileIdPointed;
        uint256 pubIdPointed;
        bytes referenceModuleData;
        address referenceModule;
        bytes referenceModuleInitData;
    }

    /**
     * @notice A struct containing the tokens and numbers of them endorsed in NFT auctions.
     *
     * @param tokenAddress The address of the ERC-20 token endorsed.
     * @param noTokens The number of tokens endorsed for the particular token.
     */
    struct TokenandNumber{
        address tokenAddress;
        uint noTokens;
    }

    /**
     * @notice A struct specifying bond details.
     *
     * @param owner The address of the owner of the bond.
     * @param timestamp The time when the bond is issued.
     * @param amount initial amount that the bond has been issued at.
     * @param yield the total value the user is guaranteed at the end of the maturation period.
     * @param maturesInNDays maturation period of the bond.
     * @param followerDifference The difference in number of followers between seller and buyer (could also be negative).
     */
    struct Bond {
        address owner;
        uint timestamp;
        uint amount;
        uint yield;
        uint maturesInNDays;
        int followerDifference;
    }
}

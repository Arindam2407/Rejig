// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

/**
 * @title ITransactionModule
 * @author Lens Protocol
 *
 * @notice This is the standard interface for all Lens-compatible TransactionModules.
 */
interface ITransactionModule {
    /**
     * @notice Initializes a transaction module for a given Lens profile. This can only be called by the hub contract.
     *
     * @param profileId The token ID of the profile to initialize this transaction module for.
     * @param data Arbitrary data passed by the profile creator.
     *
     * @return bytes The encoded data to emit in the hub.
     */
    function initializeTransactionModule(uint256 profileId, bytes calldata data)
        external
        returns (bytes memory);

    /**
     * @notice Processes a given transaction, this can only be called from the Rejig contract.
     *
     * @param transactioner The transactioner address.
     * @param profileId The token ID of the profile being transactioned.
     * @param data Arbitrary data passed by the transactioner.
     */
    function processTransaction(
        address transactioner,
        uint256 profileId,
        bytes calldata data
    ) external;

    /**
     * @notice This is a transfer hook that is called upon transaction NFT transfer in `beforeTokenTransfer. This can
     * only be called from the LensHub contract.
     *
     * NOTE: Special care needs to be taken here: It is possible that transaction NFTs were issued before this module
     * was initialized if the profile's transaction module was previously different. This transfer hook should take this
     * into consideration, especially when the module holds state associated with individual transaction NFTs.
     *
     * @param profileId The token ID of the profile associated with the transaction NFT being transferred.
     * @param from The address sending the transaction NFT.
     * @param to The address receiving the transaction NFT.
     * @param transactionNFTTokenId The token ID of the transaction NFT being transferred.
     */
    function transactionModuleTransferHook(
        uint256 profileId,
        address from,
        address to,
        uint256 transactionNFTTokenId
    ) external;

    /**
     * @notice This is a helper function that could be used in conjunction with specific collect modules.
     *
     * NOTE: This function IS meant to replace a check on transactioner NFT ownership.
     *
     * NOTE: It is assumed that not all collect modules are aware of the token ID to pass. In these cases,
     * this should receive a `transactionNFTTokenId` of 0, which is impossible regardless.
     *
     * One example of a use case for this would be a subscription-based transactioning system:
     *      1. The collect module:
     *          - Decodes a transactioner NFT token ID from user-passed data.
     *          - Fetches the transaction module from the hub.
     *          - Calls `isTransactioning` passing the profile ID, transactioner & transactioner token ID and checks it returned true.
     *      2. The transaction module:
     *          - Validates the subscription status for that given NFT, reverting on an invalid subscription.
     *
     * @param profileId The token ID of the profile to validate the transaction for.
     * @param transactioner The transactioner address to validate the transaction for.
     * @param transactionNFTTokenId The transactionNFT token ID to validate the transaction for.
     *
     * @return true if the given address is transactioning the given profile ID, false otherwise.
     */
    function isTransactioning(
        uint256 profileId,
        address transactioner,
        uint256 transactionNFTTokenId
    ) external view returns (bool);
}

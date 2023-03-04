// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {TransactionNFTProxy} from '../upgradeability/TransactionNFTProxy.sol';
import {DataTypes} from './DataTypes.sol';
import {Errors} from './Errors.sol';
import {Events} from './Events.sol';
import {Constants} from './Constants.sol';
import {ITransactionNFT} from '../interfaces/ITransactionNFT.sol';
import {ITransactionModule} from '../interfaces/ITransactionModule.sol';
import {Clones} from '@openzeppelin/contracts/proxy/Clones.sol';
import {Strings} from '@openzeppelin/contracts/utils/Strings.sol';

/**
 * @title TransactionInteractionLogic
 * @author Rejig
 *
 * @notice This is the library that contains the logic for transactions. 
 
 * @dev The functions are external, so they are called from the hub via `delegateCall` under the hood.
 */
library TransactionInteractionLogic {
    using Strings for uint256;

    /**
     * @notice Transactions the given profiles, executing the necessary logic and module calls before minting the transaction
     * NFT(s) to the transactioner.
     *
     * @param seller The address executing the transaction.
     * @param _profileById A pointer to the storage mapping of profile structs by profile ID.
     * @param userToId A pointer from user to profile Id.
     *
     */
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

    /**
     * @notice Deploys the given profile's Transaction NFT contract.
     *
     * @param profileId The token ID of the profile which Transaction NFT should be deployed.
     *
     * @return address The address of the deployed Transaction NFT contract.
     */
    function _deployTransactionNFT(uint256 profileId) private returns (address) {
        bytes memory functionData = abi.encodeWithSelector(
            ITransactionNFT.initialize.selector,
            profileId
        );
        address transactionNFT = address(new TransactionNFTProxy(functionData));

        return transactionNFT;
    }
}

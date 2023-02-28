// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {IRejig} from '../interfaces/IRejig.sol';
import {Events} from '../libraries/Events.sol';
import {DataTypes} from '../libraries/DataTypes.sol';
import {Errors} from '../libraries/Errors.sol';
import {PublishingLogic} from '../libraries/PublishingLogic.sol';
import {InteractionLogic} from '../libraries/InteractionLogic.sol';
import {RejigNFTBase} from '../contracts/base/RejigNFTBase.sol';
import {RejigMultiState} from '../contracts/base/RejigMultiState.sol';
import {VersionedInitializable} from '../upgradeability/VersionedInitializable.sol';
import {MockRejigV2Storage} from './MockRejigV2Storage.sol';

import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

/**
 * @dev A mock upgraded Rejig contract that is used mainly to validate that the initializer works as expected and
 * that the storage layout after an upgrade is valid.
 */
contract MockRejigV2 is
    RejigNFTBase,
    VersionedInitializable,
    RejigMultiState,
    MockRejigV2Storage,
    AutomationCompatibleInterface, 
    VRFConsumerBaseV2
{
    constructor(address vrfCoordinatorV2, uint64 subscriptionId, bytes32 gasLane, uint32 callbackGasLimit) 
    VRFConsumerBaseV2(vrfCoordinatorV2) {
        
    }

    function checkUpkeep(
        bytes memory /* checkData */)
        public
        pure
        override
        returns (
            bool upkeepNeeded,
            bytes memory /* performData */
        ) {
            return(false,"0x0");
        }
    
    function performUpkeep(
        bytes calldata /* performData */
    ) external override {}

    function fulfillRandomWords(
        uint256, /* requestId */
        uint256[] memory randomWords
    ) internal override {}

    uint256 internal constant REVISION = 2;

    function initialize(uint256 newValue) external initializer {
        _additionalValue = newValue;
    }

    function setAdditionalValue(uint256 newValue) external {
        _additionalValue = newValue;
    }

    function getAdditionalValue() external view returns (uint256) {
        return _additionalValue;
    }

    function getRevision() internal pure virtual override returns (uint256) {
        return REVISION;
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {ITransactionModule} from '../interfaces/ITransactionModule.sol';

contract MockTransactionModule is ITransactionModule {
    function initializeTransactionModule(uint256 profileId, bytes calldata data)
        external
        pure
        override
        returns (bytes memory)
    {
        uint256 number = abi.decode(data, (uint256));
        require(number == 1, 'MockTransactionModule: invalid');
        return new bytes(0);
    }

    function processTransaction(
        address transactioner,
        uint256 profileId,
        bytes calldata data
    ) external override {}

    function isTransactioning(
        uint256 profileId,
        address transactioner,
        uint256 transactionNFTTokenId
    ) external view override returns (bool) {
        return true;
    }

    function transactionModuleTransferHook(
        uint256 profileId,
        address from,
        address to,
        uint256 transactionNFTTokenId
    ) external override {}
}

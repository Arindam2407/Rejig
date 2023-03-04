// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {IRejig} from '../interfaces/IRejig.sol';
import {Proxy} from '@openzeppelin/contracts/proxy/Proxy.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';

contract TransactionNFTProxy is Proxy {
    using Address for address;
    address immutable HUB;

    constructor(bytes memory data) {
        HUB = msg.sender;
        IRejig(msg.sender).getTransactionNFTImpl().functionDelegateCall(data);
    }

    function _implementation() internal view override returns (address) {
        return IRejig(HUB).getTransactionNFTImpl();
    }
}

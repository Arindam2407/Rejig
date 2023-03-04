//SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {Errors} from '../libraries/Errors.sol';
import {ITransactionNFT} from '../interfaces/ITransactionNFT.sol';
import {IDutchAuction} from '../interfaces/IDutchAuction.sol';

contract DutchAuction is IDutchAuction{
    uint private constant DURATION = 7 days;

    address public immutable transactionNFT;
    uint public immutable nftId;

    address public immutable owner;
    address public immutable seller;
    uint public immutable startingPrice;
    uint public immutable startAt;
    uint public immutable expiresAt;
    uint public immutable discountRate;
    uint public immutable shareToOwner;

    constructor(address _owner, uint _startingPrice, uint _discountRate, address _nft, uint _nftId, uint _shareToOwner) {
        owner = _owner;
        seller = msg.sender;
        startingPrice = _startingPrice;
        startAt = block.timestamp;
        expiresAt = block.timestamp + DURATION;
        discountRate = _discountRate;
        shareToOwner = _shareToOwner;

        require(_startingPrice >= _discountRate * DURATION, "starting price < min");

        transactionNFT = _nft;
        nftId = _nftId;
    }

    function getPrice() public view override returns (uint) {
        uint timeElapsed = block.timestamp - startAt;
        uint discount = discountRate * timeElapsed;
        return startingPrice - discount;
    }

    function buy(address buyer) external override payable returns(uint){
        require(block.timestamp < expiresAt, "auction expired");

        uint price = getPrice();
        if (msg.value < price) {
            return 0;
        }

        ITransactionNFT(transactionNFT).transferFrom(seller,buyer,nftId);
        
        uint refund = msg.value - price;

        if (refund > 0) {
            (bool success, ) = payable(buyer).call{value : refund}('');
            require(success, 'Not paid');

            uint toOwner = uint((address(this).balance * shareToOwner * 10**8)/(10**10));
            uint value1 = 10;
            uint toProtocol = address(this).balance - toOwner;
            uint value2 = 10;
            toOwner = 0;
            toProtocol = 0;

            (bool sent1, ) = payable(owner).call{value: value1}("");
            require(sent1, 'Failed to settle ETH');
            (bool sent2, ) = payable(seller).call{value: value2}("");
            require(sent2, 'Failed to settle ETH');
        }

        return 1;
    }
}
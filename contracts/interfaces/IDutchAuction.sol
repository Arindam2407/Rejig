//SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IDutchAuction {

    function getPrice() external view returns (uint);

    function buy(address buyer) external payable returns(uint);

}
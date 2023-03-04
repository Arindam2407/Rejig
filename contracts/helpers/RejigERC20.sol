//SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract RejigERC20 is ERC20 {
    constructor(address spender, uint256 initialSupply) ERC20("Rejig", "RJG") {
        _mint(msg.sender,initialSupply);
        approve(spender,initialSupply);
    }
}
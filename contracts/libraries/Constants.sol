// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

library Constants {
    string internal constant FOLLOW_NFT_NAME_SUFFIX = '-Follower';
    string internal constant FOLLOW_NFT_SYMBOL_SUFFIX = '-Fl';
    string internal constant TRANSACTION_NFT_NAME_SUFFIX = '-Transaction';
    string internal constant TRANSACTION_NFT_SYMBOL_SUFFIX = '-Tx';
    uint8 internal constant MAX_HANDLE_LENGTH = 31;
    uint16 internal constant MAX_PROFILE_IMAGE_URI_LENGTH = 6000;
    uint8 internal constant MAX_TOKENS_ENDORSED = 3;
    uint256 internal constant REVISION = 1;
    uint256 internal constant DURATION = 7 days;
    uint256 internal constant YIELD_COEF = 95;
    uint256 internal constant TIERS = 5;
    uint256 internal constant INTERVAL = 24 hours;
}

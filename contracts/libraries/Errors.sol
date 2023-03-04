// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

library Errors {
    error CannotInitImplementation();
    error Initialized();
    error SignatureExpired();
    error ZeroSpender();
    error SignatureInvalid();
    error NotOwnerOrApproved();
    error NotHub();
    error TokenDoesNotExist();
    error NotGovernance();
    error NotGovernanceOrEmergencyAdmin();
    error EmergencyAdminCannotUnpause();
    error NotProfileOwner();
    error NotProfileOwnerOrDispatcher();
    error NotDispatcher();
    error PublicationDoesNotExist();
    error HandleTaken();
    error HandleLengthInvalid();
    error HandleContainsInvalidCharacters();
    error HandleFirstCharInvalid();
    error ProfileImageURILengthInvalid();
    error CallerNotFollowNFT();
    error CallerNotTransactionNFT();
    error BlockNumberInvalid();
    error ArrayMismatch();
    error CannotCommentOnSelf();
    error InvalidParameter();
    error NotEnoughEth();

    // Module Errors
    error InitParamsInvalid();
    error FollowInvalid();
    error ModuleDataMismatch();
    error FollowNotApproved();
    error MintLimitExceeded();

    // MultiState Errors
    error Paused();
    error PublishingPaused();
}

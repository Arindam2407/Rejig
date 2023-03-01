//SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {IRejig} from '../interfaces/IRejig.sol';
import {Events} from '../libraries/Events.sol';
import {Constants} from '../libraries/Constants.sol';
import {DataTypes} from '../libraries/DataTypes.sol';
import {Errors} from '../libraries/Errors.sol';
import {Helpers} from '../libraries/Helpers.sol';
import {PublishingLogic} from '../libraries/PublishingLogic.sol';
import {ProfileTokenURILogic} from '../libraries/ProfileTokenURILogic.sol';
import {PostNFTTokenURILogic} from '../libraries/PostNFTTokenURILogic.sol';
import {InteractionLogic} from '../libraries/InteractionLogic.sol';
import {RejigNFTBase} from './base/RejigNFTBase.sol';
import {RejigMultiState} from './base/RejigMultiState.sol';
import {RejigStorage} from './storage/RejigStorage.sol';
import {VersionedInitializable} from '../upgradeability/VersionedInitializable.sol';
import {IERC721Enumerable} from '@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol';
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

/**
 * @title Rejig
 * @author Arindam Singh
 *
 * @notice This is the main entrypoint of the Rejig App. It draws largely from the Lens Protocol Hub implementation.
 * It contains governance functionality as well as publishing and profile interaction functionality.
 *
 * NOTE: The Lens Protocol is unique in that frontend operators need to track a potentially overwhelming
 * number of NFT contracts and interactions at once. For that reason, we've made two quirky design decisions:
 *      1. The Follow NFTs invoke an Rejig callback on transfer with the sole purpose of emitting an event.
 *      2. Almost every event in the protocol emits the current block timestamp, reducing the need to fetch it manually.
 */
contract Rejig is IRejig, RejigNFTBase, RejigMultiState, RejigStorage, VersionedInitializable,
AutomationCompatibleInterface, VRFConsumerBaseV2 {

    uint256 internal constant REVISION = 1;
    address internal immutable FOLLOW_NFT_IMPL;

    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_gasLane;
    uint32 private immutable i_callbackGasLimit;
    
    uint public initializationTimestamp;
    uint public minFollowerCount;
    uint public creatorThreshold;
    uint public shareToOwner;
    uint public shareToProtocol;
    uint public shareToBonds;

    uint COEFFICIENT = Constants.COEFFICIENT;
    uint YIELD_COEF = Constants.YIELD_COEF;
    uint TIERS = Constants.TIERS;

    DataTypes.NFTState public NFTStatus;
    DataTypes.ProtocolState public ProtocolStatus;

    /**
     * @dev This modifier reverts if the caller is not the configured governance address.
     */
    modifier onlyGov() {
        _validateCallerIsGovernance();
        _;
    }

    /**
     * @dev This modifier reverts if the caller address has already created a profile.
     */
    modifier profileNotInitiated {
        require(profileInitiated[msg.sender] == false);
        _;
    }

    /**
     * @dev The constructor sets the required chainlink specifications and the follow NFT implementation address 
     * to initialize.
     *
     * @param vrfCoordinatorV2 The address of the VRF Coordinator.
     * @param subscriptionId The subscription Id of the caller.
     * @param gasLane The chainlink gas lane.
     * @param callbackGasLimit The chainlink callback gas limit.
     * @param followNFTImpl The follow NFT implementation address.
     */
    constructor(address vrfCoordinatorV2,
        uint64 subscriptionId,
        bytes32 gasLane,
        uint32 callbackGasLimit,address followNFTImpl) VRFConsumerBaseV2(vrfCoordinatorV2){
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        initializationTimestamp = block.timestamp; // time when the contract is created.
        minFollowerCount = 3; // minimum follower count to buy post NFTs.
        creatorThreshold = 5; // minimum follower count to create post NFTs.
        shareToOwner = 50; // share of NFT sale money that goes to the seller/owner.
        shareToProtocol = 20; // share of NFT sale money that goes directly to the Rejig Protocol.
        shareToBonds = 100 - shareToOwner - shareToProtocol; // share of NFT sale money that is used to issue bonds to buyers.

        if (followNFTImpl == address(0)) revert Errors.InitParamsInvalid();
        FOLLOW_NFT_IMPL = followNFTImpl;
    }

    /// @inheritdoc IRejig
    function initialize(
        string calldata name,
        string calldata symbol,
        address newGovernance
    ) external override initializer {
        super._initialize(name, symbol);
        _setState(DataTypes.ProtocolState.Paused);
        _setGovernance(newGovernance);
    }

    /// ***********************
    /// ***PROFILE FUNCTIONS***
    /// ***********************

    /// @inheritdoc IRejig
    function createProfile(DataTypes.CreateProfileData calldata vars)
        external
        override
        whenNotPaused
        profileNotInitiated
        returns (uint256)
    {
        require(vars.to == msg.sender);
        unchecked {
            uint256 profileId = ++_profileCounter;
            userToId[msg.sender] = _profileCounter;
            _mint(vars.to, profileId);
            PublishingLogic.createProfile(
                vars,
                profileId,
                _profileIdByHandleHash,
                _profileById
            );
            profileInitiated[msg.sender] = true;
            return profileId;
        }
    }

    /**
     * @notice Burns a profile, this maintains the profile data struct, but deletes the
     * handle hash to profile ID mapping value.
     *
     * NOTE: This overrides the RejigNFTBase contract's `burn()` function and calls it to fully burn
     * the NFT.
     */
    function burn(uint256 tokenId) public override whenNotPaused {
        super.burn(tokenId);
        _clearHandleHash(tokenId);
    }

    /// @inheritdoc IRejig
    function emitFollowNFTTransferEvent(
        uint256 profileId,
        uint256 followNFTId,
        address from,
        address to
    ) external override {
        address expectedFollowNFT = _profileById[profileId].followNFT;
        if (msg.sender != expectedFollowNFT) revert Errors.CallerNotFollowNFT();
        emit Events.FollowNFTTransferred(profileId, followNFTId, from, to, block.timestamp);
    }

    /// ***********************
    /// *INTERACTION FUNCTIONS*
    /// ***********************

    /// @inheritdoc IRejig
    function follow(uint256[] calldata profileIds, bytes[] calldata datas)
        external
        override
        whenNotPaused
        returns (uint256[] memory)
    {
        for(uint i = 0; i < profileIds.length; i++) {
            _profileById[profileIds[i]].followerCount++;
            if (_profileById[profileIds[i]].followerCount >= minFollowerCount){
                _profileById[profileIds[i]].approved = true;
            }
        }

        return
            InteractionLogic.follow(
                msg.sender,
                profileIds,
                datas,
                _profileById,
                _profileIdByHandleHash
            );
    }

    /// @inheritdoc IRejig
    function post(DataTypes.PostData calldata vars)
        external
        override
        whenPublishingEnabled
        returns (uint256)
    {
        _validateCallerIsProfileOwnerOrDispatcher(vars.profileId);
        return
            _createPost(
                vars.profileId,
                vars.contentURI,
                vars.referenceModule,
                vars.referenceModuleInitData
            );
    }

    /// @inheritdoc IRejig
    function postNFT(DataTypes.PostData calldata vars, 
                  uint _startingPrice, 
                  uint _discountRate, 
                  DataTypes.TokenandNumber[] memory _tokens) 
                  external 
                  override
                  whenPublishingEnabled
                  returns (uint256) {
        require(NFTStatus == DataTypes.NFTState.Open, "Not open");
        require(_profileById[userToId[msg.sender]].followerCount > creatorThreshold, "Not enough followers");
        require(_tokens.length <= Constants.MAX_TOKENS_ENDORSED, "Too many tokens");
        _validateCallerIsProfileOwnerOrDispatcher(vars.profileId);
        _profileById[userToId[msg.sender]].NFTCount++;
        uint256 NFTId = uint256(keccak256(abi.encode(userToId[msg.sender],_profileById[userToId[msg.sender]].NFTCount)));
        _pubByIdByProfile[userToId[msg.sender]][_profileById[userToId[msg.sender]].pubCount+1].associatedNFTId = NFTId;
        _safeMint(msg.sender, NFTId);
        _approve(address(this), NFTId);
        _auctionsByProfileByPubCount[msg.sender][_profileById[userToId[msg.sender]].pubCount] = 
        getAuctionAddress(_startingPrice, _discountRate, address(this), NFTId, msg.sender);
        if (_tokens.length != 0 && _profileById[userToId[msg.sender]].followerCount > creatorThreshold) {
            for (uint i = 0; i < _tokens.length; i++){
                IERC20(_tokens[i].tokenAddress).approve(address(this), _tokens[i].noTokens);
                _lastApproved[msg.sender][address(this)][_tokens[i].tokenAddress] = block.timestamp;
            }
        }

        return
            _createPost(
                vars.profileId,
                vars.contentURI,
                vars.referenceModule,
                vars.referenceModuleInitData
            );

    }

    /// @inheritdoc IRejig
    function comment(DataTypes.CommentData calldata vars)
        external
        override
        whenPublishingEnabled
        returns (uint256)
    {
        _validateCallerIsProfileOwnerOrDispatcher(vars.profileId);
        return _createComment(vars);
    }

    /// @inheritdoc IRejig
    function mirror(DataTypes.MirrorData calldata vars)
        external
        override
        whenPublishingEnabled  
        returns (uint256)
    {
        _validateCallerIsProfileOwnerOrDispatcher(vars.profileId);
        return _createMirror(vars);
    }

    /// ***********************
    /// *TRANSACTION FUNCTIONS*
    /// ***********************

    /**
     * @dev The function allows users to buy post NFTs.
     *
     * @param _owner The seller/owner address of the NFT.
     * @param _pubId The publication Id of the NFT.
     * @param bondType Type of bond (according to duration)
     */
    function buyNFT(address _owner, uint _pubId, uint bondType) payable external  {
        require(NFTStatus == DataTypes.NFTState.Open, "Not open");
        require(_profileById[userToId[msg.sender]].approved == true, "Not approved");
        require(bondType <= 3, "Out of bounds");
        uint value = msg.value;
        (bool success, ) = _auctionsByProfileByPubCount[_owner][_pubId].call{value: value}(abi.encodeWithSignature("buy"));
        require(success);
        NFTsBought[_owner][_pubId] = true;

        if(tokensEndorsed[_owner][_pubId].length != 0){
        for (uint i = 0; i < tokensEndorsed[_owner][_pubId].length; i++){
            require(block.timestamp - _lastApproved[_owner][address(this)][tokensEndorsed[_owner][_pubId][i].tokenAddress] < 7 days);
            IERC20(tokensEndorsed[_owner][_pubId][i].tokenAddress).transferFrom(_owner,msg.sender, tokensEndorsed[_owner][_pubId][i].noTokens);
        }
        }

        uint balanceOfContract = _auctionsByProfileByPubCount[_owner][_pubId].balance;
        (bool success2, ) = _auctionsByProfileByPubCount[_owner][_pubId].call(abi.encodeWithSignature("settlePayments(uint)",shareToOwner));
        require(success2);

        address owner = msg.sender;
        uint amount = uint((balanceOfContract * shareToBonds * 10**4)/10**6); 
        int followerDifference = int(_profileById[userToId[_owner]].followerCount - _profileById[userToId[msg.sender]].followerCount);

        DataTypes.Bond memory transactionBond;
    
        transactionBond.owner = owner;
        transactionBond.amount = amount;
        transactionBond.maturesInNDays = getBondDuration(bondType)*(1 days);
        transactionBond.followerDifference = followerDifference;

        _bondsById[userToId[msg.sender]].push(transactionBond);

        _followerDifferenceByEncodedBondID[abi.encode(userToId[msg.sender],[bondCounter[msg.sender]])] = int(_profileById[userToId[_owner]].followerCount - _profileById[userToId[msg.sender]].followerCount);
        bondBytes.push(abi.encode(userToId[msg.sender],[bondCounter[msg.sender]]));

        bondCounter[msg.sender]++;
    }

    /**
     * @dev The function allows users to withdraw their ETH funds remaining with the Protocol.
     */
    function withdrawFunds() public {
        require(NFTStatus == DataTypes.NFTState.Open);
        require(bondCounter[msg.sender] != 0);
        DataTypes.Bond[] memory userBonds = _bondsById[userToId[msg.sender]];
        uint availableToWithdraw;
        for(uint i = 0; i < userBonds.length; i++) {
            uint balance = userBonds[i].yield;
            uint current = uint((block.timestamp - userBonds[i].timestamp)/30);
            uint last;
            if(current < uint(userBonds[i].maturesInNDays/(30 days))){
            availableToWithdraw += uint(((current - last) * 10**6 * balance)/(uint(userBonds[i].maturesInNDays/(30 days)) * 10**6));
            userBonds[i].yield -= uint(((current - last) * 10**6 * balance)/(uint(userBonds[i].maturesInNDays/(30 days)) * 10**6));
            last = current;
            } else {
                availableToWithdraw += userBonds[i].yield;
            }
        }

        uint withdrawalAmount = availableToWithdraw;
        availableToWithdraw = 0;

        (bool sent, ) = payable(msg.sender).call{value: withdrawalAmount}("");
        require(sent, "Failed to send Ether");
    }

    /// ***********************
    /// ****BONDS FUNCTIONS****
    /// ***********************

    /// @inheritdoc AutomationCompatibleInterface
    function checkUpkeep(
        bytes memory /* checkData */)
        public
        view
        override
        returns (
            bool upkeepNeeded,
            bytes memory /* performData */
        ) {

            upkeepNeeded = (NFTStatus == DataTypes.NFTState.Open &&
             getProtocolStatus() != DataTypes.ProtocolState.Paused && 
             (block.timestamp - initializationTimestamp) > Constants.INTERVAL && 
             bondBytes.length != 0);
            return(upkeepNeeded,"0x0");
    }

    /// @inheritdoc AutomationCompatibleInterface
    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (upkeepNeeded) {
        NFTStatus = DataTypes.NFTState.Setting_yields;
        _quickSort(bondBytes, int(0), int(bondBytes.length - 1));
        _distributeYields(bondBytes);
        initializationTimestamp = block.timestamp;
        bytes[] memory update;
        bondBytes = update;
        NFTStatus = DataTypes.NFTState.Open;
        }
    }
   
    function fulfillRandomWords(
        uint256, /* requestId */
        uint256[] memory randomWords
    ) internal override {}

    /// ***********************
    /// *GOVERNANCE FUNCTIONS**
    /// ***********************

    /// @inheritdoc IRejig
    function setGovernance(address newGovernance) external onlyGov {
        _setGovernance(newGovernance);
    }

    /// @inheritdoc IRejig
    function setMinFollowerCount(uint newMinFollowerCount) external onlyGov {
        minFollowerCount = newMinFollowerCount;
    }

    /// @inheritdoc IRejig
    function setCreatorThreshold(uint newCreatorThreshold) external onlyGov {
        creatorThreshold = newCreatorThreshold;
    }

    /// @inheritdoc IRejig
    function setShareToOwner(uint newShareToOwner) external onlyGov {
        shareToOwner = newShareToOwner;
    }
    
    /// @inheritdoc IRejig
    function setShareToProtocol(uint newShareToProtocol) external onlyGov {
        shareToProtocol = newShareToProtocol;
    }

    /// @inheritdoc IRejig
    function setEmergencyAdmin(address newEmergencyAdmin) external onlyGov {
        address prevEmergencyAdmin = _emergencyAdmin;
        _emergencyAdmin = newEmergencyAdmin;
        emit Events.EmergencyAdminSet(
            msg.sender,
            prevEmergencyAdmin,
            newEmergencyAdmin,
            block.timestamp
        );
    }
    
    /// @inheritdoc IRejig
    function setState(DataTypes.ProtocolState newState) external {
        if (msg.sender == _emergencyAdmin) {
            if (newState == DataTypes.ProtocolState.Unpaused)
                revert Errors.EmergencyAdminCannotUnpause();
            _validateNotPaused();
        } else if (msg.sender != _governance) {
            revert Errors.NotGovernanceOrEmergencyAdmin();
        }
        _setState(newState);
    }
    
    /// @inheritdoc IRejig
    function setFollowModule(
        uint256 profileId,
        address followModule,
        bytes calldata followModuleInitData
    ) external whenNotPaused {
        _validateCallerIsProfileOwner(profileId);
        PublishingLogic.setFollowModule(
            profileId,
            followModule,
            followModuleInitData,
            _profileById[profileId]
        );
    }
    
    /// @inheritdoc IRejig
    function setDispatcher(uint256 profileId, address dispatcher) external whenNotPaused {
        _validateCallerIsProfileOwner(profileId);
        _setDispatcher(profileId, dispatcher);
    }

    /// @inheritdoc IRejig
    function setProfileImageURI(uint256 profileId, string calldata imageURI)
        external
        whenNotPaused
    {
        _validateCallerIsProfileOwnerOrDispatcher(profileId);
        _setProfileImageURI(profileId, imageURI);
    }

    /// @inheritdoc IRejig
    function setFollowNFTURI(uint256 profileId, string calldata followNFTURI)
        external
        whenNotPaused
    {
        _validateCallerIsProfileOwnerOrDispatcher(profileId);
        _setFollowNFTURI(profileId, followNFTURI);
    }

    /// ***********************
    /// ***GETTER FUNCTIONS****
    /// ***********************

    function getRevision() internal pure virtual override returns (uint256) {
        return REVISION;
    }
  
    /// @inheritdoc IRejig
    function getFollowNFTImpl() external view override returns (address) {
        return FOLLOW_NFT_IMPL;
    }

    /// @inheritdoc IRejig
    function getGovernance() external view override returns (address) {
        return _governance;
    }

    /// @inheritdoc IRejig
    function getDispatcher(uint256 profileId) external view override returns (address) {
        return _dispatcherByProfile[profileId];
    }

    /// @inheritdoc IRejig
    function getPubCount(uint256 profileId) external view override returns (uint256) {
        return _profileById[profileId].pubCount;
    }

    /// @inheritdoc IRejig
    function getFollowNFT(uint256 profileId) external view override returns (address) {
        return _profileById[profileId].followNFT;
    }

    /// @inheritdoc IRejig
    function getFollowNFTURI(uint256 profileId) external view override returns (string memory) {
        return _profileById[profileId].followNFTURI;
    }

    /// @inheritdoc IRejig
    function getFollowModule(uint256 profileId) external view override returns (address) {
        return _profileById[profileId].followModule;
    }

    /// @inheritdoc IRejig
    function getNFTBought(address _owner, uint _pubId) external view returns(bool){
        return NFTsBought[_owner][_pubId];
    }

    /// @inheritdoc IRejig
    function getNFTPrice(address _owner, uint _pubId) payable external returns (uint256) {
        (bool success, bytes memory data) = _auctionsByProfileByPubCount[_owner][_pubId].call(abi.encodeWithSignature("getPrice"));
        require(success);
        return abi.decode(data,(uint256));
    }
    
    /// @inheritdoc IRejig
    function getReferenceModule(uint256 profileId, uint256 pubId)
        external
        view
        override
        returns (address)
    {
        return _pubByIdByProfile[profileId][pubId].referenceModule;
    }

    /// @inheritdoc IRejig
    function getHandle(uint256 profileId) external view override returns (string memory) {
        return _profileById[profileId].handle;
    }

    /// @inheritdoc IRejig
    function getPubPointer(uint256 profileId, uint256 pubId)
        external
        view
        override
        returns (uint256, uint256)
    {
        return (_pubByIdByProfile[profileId][pubId].profileIdPointed, _pubByIdByProfile[profileId][pubId].pubIdPointed);
    }

    /// @inheritdoc IRejig
    function getContentURI(uint256 profileId, uint256 pubId)
        external
        view
        override
        returns (string memory)
    {
        return _pubByIdByProfile[profileId][pubId].contentURI;
    }

    /// @inheritdoc IRejig
    function getProfileIdByHandle(string calldata handle) external view override returns (uint256) {
        return _profileIdByHandleHash[keccak256(bytes(handle))];
    }

    /// @inheritdoc IRejig
    function getProfile(uint256 profileId)
        external
        view
        override
        returns (DataTypes.ProfileStruct memory)
    {
        return _profileById[profileId];
    }

    /// @inheritdoc IRejig
    function getPub(uint256 profileId, uint256 pubId)
        external
        view
        override
        returns (DataTypes.PublicationStruct memory)
    {
        return _pubByIdByProfile[profileId][pubId];
    }

    /// @inheritdoc IRejig
    function getPubType(uint256 profileId, uint256 pubId)
        external
        view
        override
        returns (DataTypes.PubType)
    {
        if (pubId == 0 || _profileById[profileId].pubCount < pubId) {
            return DataTypes.PubType.Nonexistent;
        } else if (_pubByIdByProfile[profileId][pubId].isMirror == true) {
            return DataTypes.PubType.Mirror;
        } else if (_pubByIdByProfile[profileId][pubId].profileIdPointed == 0) {
            return DataTypes.PubType.Post;
        } else {
            return DataTypes.PubType.Comment;
        }
    }

    /**
     * @dev Overrides the ERC721 tokenURI function to return the associated URI with a given profile.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        address followNFT = _profileById[tokenId].followNFT;
        return
            ProfileTokenURILogic.getProfileTokenURI(
                tokenId,
                followNFT == address(0) ? 0 : IERC721Enumerable(followNFT).totalSupply(),
                ownerOf(tokenId),
                _profileById[tokenId].handle,
                _profileById[tokenId].imageURI
            );
    }

    /**
     * @dev Similar to the tokenURI functionality but requiring:
     * @param - The address of the deployer.
     * @param - The publication Id of the NFT post.
     */
    function postTokenURI(address _deployer, uint _pubId) public view returns(string memory) {
        return
            PostNFTTokenURILogic.getPostNFTTokenURI(
                userToId[_deployer],
                _pubByIdByProfile[userToId[_deployer]][_pubId].associatedNFTId,
                _pubByIdByProfile[userToId[_deployer]][_pubId].contentURI,
                _deployer,
                _profileById[userToId[_deployer]].handle
            );
    }

    function getProtocolStatus() internal view returns (DataTypes.ProtocolState) {
        return ProtocolStatus;
    }

    function getNFTStatus() internal view returns (DataTypes.NFTState) {
        return NFTStatus;
    }

    function getBondDuration(uint256 x) internal pure returns(uint256) {
        if(x == 0){
            return 90;
        }
        if(x == 1){
            return 180;
        }
        if(x == 2){
            return 270;
        }
        if(x == 3){
            return 360;
        }
    }

    function getAuctionAddress(uint _startingPrice, uint _discountRate, address _nft, uint _nftId, address _owner) internal returns(address) {
        DutchAuction _contract = new DutchAuction(_startingPrice,_discountRate,_nft,_nftId, _owner);
        bytes memory bytecode = type(DutchAuction).creationCode;
        bytecode = abi.encodePacked(bytecode,abi.encode(_startingPrice, _discountRate, _nft, _nftId, _owner));
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), keccak256(bytecode)));
        return address(uint160(uint(hash)));
    }

    /// ***********************
    /// ***INTERNAL FUNCTIONS**
    /// ***********************

    function _setGovernance(address newGovernance) internal {
        address prevGovernance = _governance;
        _governance = newGovernance;
        emit Events.GovernanceSet(msg.sender, prevGovernance, newGovernance, block.timestamp);
    }

    function _createPost(
        uint256 profileId,
        string memory contentURI,
        address referenceModule,
        bytes memory referenceModuleData
    ) internal returns (uint256) {
        unchecked {
            uint256 pubId = ++_profileById[profileId].pubCount;
            PublishingLogic.createPost(
                profileId,
                contentURI,
                referenceModule,
                referenceModuleData,
                pubId,
                _pubByIdByProfile
            );
            return pubId;
        }
    }

    function _createComment(DataTypes.CommentData memory vars) internal returns (uint256) {
        unchecked {
            uint256 pubId = ++_profileById[vars.profileId].pubCount;
            PublishingLogic.createComment(
                vars,
                pubId,
                _profileById,
                _pubByIdByProfile
            );
            return pubId;
        }
    }

    function _createMirror(DataTypes.MirrorData memory vars) internal returns (uint256) {
        unchecked {
            uint256 pubId = ++_profileById[vars.profileId].pubCount;
            PublishingLogic.createMirror(
                vars,
                pubId,
                _pubByIdByProfile
            );
            return pubId;
        }
    }

    function _setDispatcher(uint256 profileId, address dispatcher) internal {
        _dispatcherByProfile[profileId] = dispatcher;
        emit Events.DispatcherSet(profileId, dispatcher, block.timestamp);
    }

    function _setProfileImageURI(uint256 profileId, string calldata imageURI) internal {
        if (bytes(imageURI).length > Constants.MAX_PROFILE_IMAGE_URI_LENGTH)
            revert Errors.ProfileImageURILengthInvalid();
        _profileById[profileId].imageURI = imageURI;
        emit Events.ProfileImageURISet(profileId, imageURI, block.timestamp);
    }

    function _setFollowNFTURI(uint256 profileId, string calldata followNFTURI) internal {
        _profileById[profileId].followNFTURI = followNFTURI;
        emit Events.FollowNFTURISet(profileId, followNFTURI, block.timestamp);
    }

    function _clearHandleHash(uint256 profileId) internal {
        _profileIdByHandleHash[keccak256(bytes(_profileById[profileId].handle))] = 0;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override whenNotPaused {
        if (_dispatcherByProfile[tokenId] != address(0)) {
            _setDispatcher(tokenId, address(0));
        }

        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _validateCallerIsProfileOwnerOrDispatcher(uint256 profileId) internal view {
        if (msg.sender == ownerOf(profileId) || msg.sender == _dispatcherByProfile[profileId]) {
            return;
        }
        revert Errors.NotProfileOwnerOrDispatcher();
    }

    function _validateCallerIsProfileOwner(uint256 profileId) internal view {
        if (msg.sender != ownerOf(profileId)) revert Errors.NotProfileOwner();
    }

    function _validateCallerIsGovernance() internal view {
        if (msg.sender != _governance) revert Errors.NotGovernance();
    }

    function _quickSort(bytes[] memory arr, int left, int right) internal view {
    int i = left;
    int j = right;
    if (i == j) return;
    int pivot = _followerDifferenceByEncodedBondID[arr[uint(left + (right - left) / 2)]];
    while (i <= j) {
        while (int(_followerDifferenceByEncodedBondID[arr[uint(i)]]) < pivot) i++;
        while (pivot < int(_followerDifferenceByEncodedBondID[arr[uint(j)]])) j--;
        if (i <= j) {
            (arr[uint(i)], arr[uint(j)]) = (arr[uint(j)], arr[uint(i)]);
            i++;
            j--;
        }
    }
    if (left < j)
        _quickSort(arr, left, j);
    if (i < right)
        _quickSort(arr, i, right);
    }

    function _distributeYields(bytes[] memory arr) internal {
        uint sum;
        for(uint i = 0; i < arr.length; i++) {
            (uint id, uint count) = abi.decode(arr[i], (uint, uint));
            sum += _bondsById[id][count].amount;
        }

        uint fivePercent = uint((5 * 10**7 * sum)/(10**9));
        uint sum2;

        for(uint i = 0; i < arr.length; i++) {
            (uint id, uint count) = abi.decode(arr[i], (uint, uint));
            _bondsById[id][count].timestamp = block.timestamp;
            sum2 += _bondsById[id][count].amount;
            uint rep;
            if (sum2 <= fivePercent){
            _loopDistribution(id,count,rep,sum2,fivePercent,true);
            }
            else {
                while (sum2 > fivePercent){
                _loopDistribution(id,count,rep,sum2,fivePercent,false);
                }
                _loopDistribution(id,count,rep,sum2,fivePercent,true);
            }

        }
    }

    function _loopDistribution(uint id, uint count, uint rep, uint sum2, uint fivePercent, bool exceeded) internal {
        if (exceeded) {
                _bondsById[id][count].yield += uint((_bondsById[id][count].amount*COEFFICIENT*(YIELD_COEF**(rep)*(100)**(TIERS - rep)))/(10**(2*TIERS + 1)));
                _bondsById[id][count].amount = 0; 
        } else {
                uint currentYield = _bondsById[id][count].amount - (sum2 - fivePercent);
                _bondsById[id][count].yield += uint((currentYield*COEFFICIENT*(YIELD_COEF**(rep)*(100)**(TIERS - rep)))/(10**(2*TIERS + 1)));
                _bondsById[id][count].amount -= currentYield;
                rep++;
                sum2 -= fivePercent;
        }
    }
}

contract DutchAuction {
    uint private constant DURATION = 7 days;

    IERC721 public immutable nft;
    uint public immutable nftId;

    address payable public immutable seller;
    uint public immutable startingPrice;
    uint public immutable startAt;
    uint public immutable expiresAt;
    uint public immutable discountRate;
    address payable public immutable owner;

    constructor(uint _startingPrice, uint _discountRate, address _nft, uint _nftId, address _owner) {
        owner = payable(_owner);
        seller = payable(msg.sender);
        startingPrice = _startingPrice;
        startAt = block.timestamp;
        expiresAt = block.timestamp + DURATION;
        discountRate = _discountRate;

        require(_startingPrice >= _discountRate * DURATION, "starting price < min");

        nft = IERC721(_nft);
        nftId = _nftId;
    }

    function getPrice() public view returns (uint) {
        uint timeElapsed = block.timestamp - startAt;
        uint discount = discountRate * timeElapsed;
        return startingPrice - discount;
    }

    function buy() external payable {
        require(block.timestamp < expiresAt, "auction expired");

        uint price = getPrice();
        require(msg.value >= price, "ETH < price");

        nft.transferFrom(seller, owner, nftId);
        uint refund = msg.value - price;
        if (refund > 0) {
            payable(owner).transfer(refund);
        }
    }

    function settlePayments(uint shareToOwner) external {
        uint toOwner = uint((address(this).balance * shareToOwner * 10**4)/10**6);
        uint value1 = toOwner;
        toOwner = 0;

        uint toProtocol = uint((address(this).balance * (100 - shareToOwner) * 10**4)/10**6);
        uint value2 = toProtocol;
        toProtocol = 0;

        (bool sent1, ) = payable(owner).call{value: value1}("");
        require(sent1, "Failed to send Ether");

        (bool sent2, ) = payable(seller).call{value: value2}("");
        require(sent2, "Failed to send Ether");
    }
}

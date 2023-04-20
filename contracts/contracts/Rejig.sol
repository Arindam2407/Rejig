//SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {IRejig} from '../interfaces/IRejig.sol';
import {ITransactionNFT} from '../interfaces/ITransactionNFT.sol';
import {TransactionNFT} from './TransactionNFT.sol';
import {IDutchAuction} from '../interfaces/IDutchAuction.sol';
import './DutchAuction.sol';
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
import {RejigERC20} from '../helpers/RejigERC20.sol';
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
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
    address internal immutable TRANSACTION_NFT_IMPL;

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
        require(profileInitiated[msg.sender] == false, "Profile Already Created");
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
     * @param transactionNFTImpl The transaction NFT implementation address.
     */
    constructor(address vrfCoordinatorV2,
        uint64 subscriptionId,
        bytes32 gasLane,
        uint32 callbackGasLimit,address followNFTImpl,address transactionNFTImpl) VRFConsumerBaseV2(vrfCoordinatorV2){
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        initializationTimestamp = block.timestamp; // time when the contract is created.
        minFollowerCount = 3; // minimum follower count to buy post NFTs.
        creatorThreshold = 10; // minimum follower count to create post NFTs.
        shareToOwner = 50; // share of NFT sale money that goes to the seller/owner.
        shareToProtocol = 20; // share of NFT sale money that goes directly to the Rejig Protocol.
        shareToBonds = 100 - shareToOwner - shareToProtocol; // share of NFT sale money that is used to issue bonds to buyers.

        if (followNFTImpl == address(0)) revert Errors.InitParamsInvalid();
        FOLLOW_NFT_IMPL = followNFTImpl;

        if (transactionNFTImpl == address(0)) revert Errors.InitParamsInvalid();
        TRANSACTION_NFT_IMPL = transactionNFTImpl;
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
        require(vars.transactionModule == address(0), "Invalid Profile Creation");
        unchecked {
            uint256 profileId = ++_profileCounter;
            userToId[msg.sender] = _profileCounter;
            idToUser[_profileCounter] = msg.sender;
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
        profileInitiated[msg.sender] == false;
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

    /// @inheritdoc IRejig
    function emitTransactionNFTTransferEvent(
        uint256 profileId,
        uint256 transactionNFTId,
        address from,
        address to
    ) external override {
        address expectedTransactionNFT = _profileById[profileId].transactionNFT;
        if (msg.sender != expectedTransactionNFT) revert Errors.CallerNotTransactionNFT();
        emit Events.TransactionNFTTransferred(profileId, transactionNFTId, from, to, block.timestamp);
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
            require(idToFollowerBools[profileIds[i]][msg.sender] == false, "Can't follow again");
            require(idToUser[profileIds[i]] != msg.sender, "Can't follow self");
            _profileById[profileIds[i]].followerCount++;
            if (_profileById[profileIds[i]].followerCount >= minFollowerCount){
                _profileById[profileIds[i]].approved = true;
            }
            idToFollowerBools[profileIds[i]][msg.sender] = true;
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
                  DataTypes.EndorsedTokenData calldata _tokens) 
                  external 
                  override
                  whenPublishingEnabled
                  returns (uint256) {

        require(NFTStatus == DataTypes.NFTState.Open, "Not open");
        require(_profileById[userToId[msg.sender]].followerCount > creatorThreshold, "Not enough followers");
        _validateCallerIsProfileOwnerOrDispatcher(vars.profileId);

        uint256 NFTId = uint256(keccak256(abi.encode(userToId[msg.sender],_profileById[userToId[msg.sender]].NFTCount)));
        _pubByIdByProfile[userToId[msg.sender]][_profileById[userToId[msg.sender]].pubCount + 1].associatedNFTId = NFTId;

        InteractionLogic.transact(msg.sender, address(this), NFTId, _profileById, userToId);

        address NFT = _profileById[userToId[msg.sender]].transactionNFT;

        _auctionsByProfileByPubCount[msg.sender][_profileById[userToId[msg.sender]].pubCount + 1] = 
        getAuctionAddress(msg.sender,_startingPrice, _discountRate, NFT, NFTId);

        tokensEndorsed[msg.sender][_profileById[userToId[msg.sender]].pubCount + 1] = _tokens;

        if(_tokens.token1 != address(0)){
        require(IERC20(_tokens.token1).allowance(msg.sender, address(this)) >= _tokens.noTokens1, "Not approved");
        }
        if(_tokens.token2 != address(0)){
        require(IERC20(_tokens.token2).allowance(msg.sender, address(this)) >= _tokens.noTokens2, "Not approved");
        }
        if(_tokens.token3 != address(0)){
        require(IERC20(_tokens.token3).allowance(msg.sender, address(this)) >= _tokens.noTokens3, "Not approved");
        }

        _profileById[userToId[msg.sender]].NFTCount++;

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
     * @param _profileId The seller/owner id of the NFT.
     * @param _pubId The publication Id of the NFT.
     */
    function buyNFT(uint _profileId, uint _pubId) payable external  {
        require(NFTStatus == DataTypes.NFTState.Open, "Not open");
        require(_profileById[userToId[msg.sender]].approved == true, "Not approved");
        require(_auctionsByProfileByPubCount[idToUser[_profileId]][_pubId] != address(0), 'Non-existent');

        (bool success, bytes memory data) = _auctionsByProfileByPubCount[idToUser[_profileId]][_pubId].call{value : msg.value}(abi.encodeWithSelector(IDutchAuction.buy.selector,msg.sender));
        require(success, 'No success');
        (uint x) = abi.decode(data,(uint));
        require(x == 1, "Not Enough ETH");

        NFTsBought[idToUser[_profileId]][_pubId] = true;

        if(tokensEndorsed[idToUser[_profileId]][_pubId].token1 != address(0)){
        if(IERC20(tokensEndorsed[idToUser[_profileId]][_pubId].token1).allowance(idToUser[_profileId], address(this)) >= tokensEndorsed[idToUser[_profileId]][_pubId].noTokens1){
        (bool ok1, ) = tokensEndorsed[idToUser[_profileId]][_pubId].token1.call(abi.encodeWithSelector(IERC20.transferFrom.selector,idToUser[_profileId],msg.sender,tokensEndorsed[idToUser[_profileId]][_pubId].noTokens1));
        require(ok1);
        }}
        if(tokensEndorsed[idToUser[_profileId]][_pubId].token2 != address(0)){
        if(IERC20(tokensEndorsed[idToUser[_profileId]][_pubId].token2).allowance(idToUser[_profileId], address(this)) >= tokensEndorsed[idToUser[_profileId]][_pubId].noTokens2){
        (bool ok2, ) = tokensEndorsed[idToUser[_profileId]][_pubId].token2.call(abi.encodeWithSelector(IERC20.transferFrom.selector,idToUser[_profileId],msg.sender,tokensEndorsed[idToUser[_profileId]][_pubId].noTokens2));
        require(ok2);
        }}
        if(tokensEndorsed[idToUser[_profileId]][_pubId].token3 != address(0)){
        if(IERC20(tokensEndorsed[idToUser[_profileId]][_pubId].token3).allowance(idToUser[_profileId], address(this)) >= tokensEndorsed[idToUser[_profileId]][_pubId].noTokens3){
        (bool ok3, ) = tokensEndorsed[idToUser[_profileId]][_pubId].token3.call(abi.encodeWithSelector(IERC20.transferFrom.selector,idToUser[_profileId],msg.sender,tokensEndorsed[idToUser[_profileId]][_pubId].noTokens3));
        require(ok3);
        }}

        uint balanceOfContract = _auctionsByProfileByPubCount[idToUser[_profileId]][_pubId].balance;

        DataTypes.Bond memory transactionBond;
    
        transactionBond.owner = msg.sender;
        transactionBond.amount = uint((balanceOfContract * shareToBonds * 10**4)/10**6);
        transactionBond.followerDifference = int(_profileById[userToId[idToUser[_profileId]]].followerCount - _profileById[userToId[msg.sender]].followerCount);

        _bondsById[userToId[msg.sender]][bondCounter[msg.sender]] = transactionBond;

        _followerDifferenceByEncodedBondID[abi.encode(userToId[msg.sender],[bondCounter[msg.sender]])] = int(_profileById[userToId[idToUser[_profileId]]].followerCount - _profileById[userToId[msg.sender]].followerCount);
        bondBytes.push(abi.encode(userToId[msg.sender],[bondCounter[msg.sender]]));
        bondCounter[msg.sender]++;
    }

    function getCoefficient(uint _days) internal pure returns(uint) {
        if (_days < 90){
            return 5*_days;
        } if (_days > 89 && _days < 360) {
            1000 + (_days - 90)*2;
        } else {
            1000 + (_days - 90)*2 + (_days - 360)/10;
        }
    } 

    /**
     * @dev The function allows users to withdraw their ETH funds remaining with the Protocol.
     */
    function withdrawFunds(uint[] calldata _withdrawals) external {
        require(NFTStatus == DataTypes.NFTState.Open);
        require(bondCounter[msg.sender] != 0);
        uint availableToWithdraw;
        for(uint i = 0; i < _withdrawals.length; i++) {
            require(bondCounter[msg.sender] + 1 > _withdrawals[i]);
            uint maturity = uint((block.timestamp - _bondsById[userToId[msg.sender]][_withdrawals[i]].timestamp)/(1 days));
            availableToWithdraw += (_bondsById[userToId[msg.sender]][_withdrawals[i]].yield*getCoefficient(maturity))/1000;
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
    function getTransactionNFTImpl() external view override returns (address) {
        return TRANSACTION_NFT_IMPL;
    }

    /// @inheritdoc IRejig
    function getGovernance() external view override returns (address) {
        return _governance;
    }

    /// @inheritdoc IRejig
    function getIdFromUser(address user) external view override returns (uint) {
        return userToId[user];
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
    function getTransactionNFTURI(uint256 profileId) external view override returns (string memory) {
        return _profileById[profileId].transactionNFTURI;
    }

    /// @inheritdoc IRejig
    function getFollowModule(uint256 profileId) external view override returns (address) {
        return _profileById[profileId].followModule;
    }

    /// @inheritdoc IRejig
    function getTransactionModule(uint256 profileId) external view override returns (address) {
        return _profileById[profileId].transactionModule;
    }

    /// @inheritdoc IRejig
    function getNFTBought(address _owner, uint _pubId) external view returns(bool){
        return NFTsBought[_owner][_pubId];
    }

    /// @inheritdoc IRejig
    function getNFTPrice(address _owner, uint _pubId) payable external returns (uint256) {
        (bool success, bytes memory data) = _auctionsByProfileByPubCount[_owner][_pubId].delegatecall(abi.encodeWithSignature("getPrice"));
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
    function postTokenURI(uint _profileId, uint _pubId) public view returns(string memory) {
        return
            PostNFTTokenURILogic.getPostNFTTokenURI(
                _profileId,
                _pubByIdByProfile[_profileId][_pubId].associatedNFTId,
                _pubByIdByProfile[_profileId][_pubId].contentURI,
                idToUser[_profileId],
                _profileById[_profileId].handle
            );
    }

    function getProtocolStatus() internal view returns (DataTypes.ProtocolState) {
        return ProtocolStatus;
    }

    function getNFTStatus() internal view returns (DataTypes.NFTState) {
        return NFTStatus;
    }

    function getAuctionAddress(address _owner,uint _startingPrice, uint _discountRate, address _nft, uint _nftId) internal returns(address) {
        return address(new DutchAuction(_owner,_startingPrice,_discountRate,_nft,_nftId,shareToOwner));
    }

    function getAvailableToWithdraw(uint[] calldata _withdrawals) external view override returns(uint){
        require(bondCounter[msg.sender] != 0);
        uint availableToWithdraw;
        for(uint i = 0; i < _withdrawals.length; i++) {
            require(bondCounter[msg.sender] + 1 > _withdrawals[i]);
            uint maturity = uint((block.timestamp - _bondsById[userToId[msg.sender]][_withdrawals[i]].timestamp)/(1 days));
            availableToWithdraw += (_bondsById[userToId[msg.sender]][_withdrawals[i]].yield*getCoefficient(maturity))/10**12;
        }

        return availableToWithdraw;
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
            _loopDistribution(id,count,rep,sum2,fivePercent,false);
            }
            else {
                while (sum2 > fivePercent){
                _loopDistribution(id,count,rep,sum2,fivePercent,true);
                }
                _loopDistribution(id,count,rep,sum2,fivePercent,false);
            }
        }
    }

    function _loopDistribution(uint id, uint count, uint rep, uint sum2, uint fivePercent, bool exceeded) internal {
        if (exceeded == false) {
                _bondsById[id][count].yield += uint((_bondsById[id][count].amount*(YIELD_COEF**(rep)*(100)**(TIERS - rep)))/(100**TIERS));
                _bondsById[id][count].amount = 0; 
        } else {
                uint currentYield = _bondsById[id][count].amount - (sum2 - fivePercent);
                _bondsById[id][count].yield += uint((currentYield*(YIELD_COEF**(rep)*(100)**(TIERS - rep)))/(100**TIERS));
                _bondsById[id][count].amount -= currentYield;
                rep++;
                sum2 -= fivePercent;
        }
    }

    receive() external payable {}

}

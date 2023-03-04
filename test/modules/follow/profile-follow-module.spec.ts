import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { BytesLike } from 'ethers';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { getTimestamp, matchEvent, waitForTx } from '../../helpers/utils';
import {
  abiCoder,
  FIRST_PROFILE_ID,
  governance,
  rejig,
  rejigImpl,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_TRANSACTION_NFT_URI,
  profileFollowModule,
  userAddress,
  userThreeAddress,
  userTwo,
  userTwoAddress,
} from '../../__setup.spec';

makeSuiteCleanRoom('Profile Follow Module', function () {
  let EMPTY_BYTES: BytesLike;
  let DEFAULT_FOLLOW_DATA: BytesLike;

  before(async function () {
    EMPTY_BYTES = '0x';
    DEFAULT_FOLLOW_DATA = abiCoder.encode(['uint256'], [FIRST_PROFILE_ID + 1]);
  });

  context('Negatives', function () {
    context('Initialization', function () {
      it('Initialize call should fail when sender is not the hub', async function () {
        await expect(
          profileFollowModule.initializeFollowModule(FIRST_PROFILE_ID, EMPTY_BYTES)
        ).to.be.revertedWith(ERRORS.NOT_HUB);
      });
    });

    context('Following', function () {
      beforeEach(async function () {
        await expect(
          rejig.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: profileFollowModule.address,
            followModuleInitData: EMPTY_BYTES,
            followNFTURI: MOCK_FOLLOW_NFT_URI,
            transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
          })
        ).to.not.be.reverted;
      });

      it('UserTwo should fail to process follow without being the hub', async function () {
        await expect(
          profileFollowModule.connect(userTwo).processFollow(userTwoAddress, FIRST_PROFILE_ID, [])
        ).to.be.revertedWith(ERRORS.NOT_HUB);
      });

      it('Follow should fail when data is not holding the follower profile id encoded', async function () {
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [])).to.be.revertedWith(
          ERRORS.ARRAY_MISMATCH
        );
      });

      it('Follow should fail when the passed follower profile does not exist because has never been minted', async function () {
        const data = abiCoder.encode(['uint256'], [FIRST_PROFILE_ID + 1]);
        await expect(
          rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
        ).to.be.revertedWith(ERRORS.ERC721_QUERY_FOR_NONEXISTENT_TOKEN);
      });

      it('Follow should fail when the passed follower profile does not exist because has been burned', async function () {
        const secondProfileId = FIRST_PROFILE_ID + 1;
        await expect(
          rejig.connect(userTwo).createProfile({
            to: userTwoAddress,
            handle: 'usertwo',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
            transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
          })
        ).to.not.be.reverted;
        await expect(rejig.connect(userTwo).burn(secondProfileId)).to.not.be.reverted;

        const data = abiCoder.encode(['uint256'], [secondProfileId]);
        await expect(
          rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
        ).to.be.revertedWith(ERRORS.ERC721_QUERY_FOR_NONEXISTENT_TOKEN);
      });

      it('Follow should fail when follower address is not the owner of the passed follower profile', async function () {
        const data = abiCoder.encode(['uint256'], [FIRST_PROFILE_ID]);
        await expect(
          rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [data])
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER);
      });
      it('Follow should fail when the passed follower profile has already followed the profile', async function () {
        await expect(
          rejig.connect(userTwo).createProfile({
            to: userTwoAddress,
            handle: 'usertwo',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
            transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
          })
        ).to.not.be.reverted;
        await expect(
          rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [DEFAULT_FOLLOW_DATA])
        ).to.not.be.reverted;
        const followerProfileId = FIRST_PROFILE_ID + 1;
        expect(
          await profileFollowModule.isProfileFollowing(followerProfileId, FIRST_PROFILE_ID)
        ).to.be.true;
        await expect(
          rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [DEFAULT_FOLLOW_DATA])
        ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
      });

      it('Follow should fail when the passed follower profile has already followed the profile even after the profile nft has been transfered', async function () {
        await expect(
          rejig.connect(userTwo).createProfile({
            to: userTwoAddress,
            handle: 'usertwo',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
            transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
          })
        ).to.not.be.reverted;
        await expect(
          rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [DEFAULT_FOLLOW_DATA])
        ).to.not.be.reverted;
        const followerProfileId = FIRST_PROFILE_ID + 1;
        expect(
          await profileFollowModule.isProfileFollowing(followerProfileId, FIRST_PROFILE_ID)
        ).to.be.true;

        await expect(
          rejig.transferFrom(userAddress, userThreeAddress, FIRST_PROFILE_ID)
        ).to.not.be.reverted;
        expect(
          await profileFollowModule.isProfileFollowing(followerProfileId, FIRST_PROFILE_ID)
        ).to.be.true;

        await expect(
          rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [DEFAULT_FOLLOW_DATA])
        ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
      });
    });
  });

  context('Scenarios', function () {
    context('Initialization', function () {
      it('Initialize call should succeed returning empty bytes even when sending non-empty data as input', async function () {
        expect(
          await profileFollowModule
            .connect(rejig.address)
            .callStatic.initializeFollowModule(FIRST_PROFILE_ID, abiCoder.encode(['uint256'], [0]))
        ).to.eq(EMPTY_BYTES);
      });

      it('Profile creation using profile follow module should succeed and emit expected event', async function () {
        const tx = rejig.createProfile({
          to: userAddress,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: profileFollowModule.address,
          followModuleInitData: EMPTY_BYTES,
          followNFTURI: MOCK_FOLLOW_NFT_URI,
          transactionModule: ZERO_ADDRESS,
          transactionNFTURI: MOCK_TRANSACTION_NFT_URI
        });

        const receipt = await waitForTx(tx);

        expect(receipt.logs.length).to.eq(2);
        matchEvent(receipt, 'Transfer', [ZERO_ADDRESS, userAddress, FIRST_PROFILE_ID], rejigImpl);
        matchEvent(receipt, 'ProfileCreated', [
          FIRST_PROFILE_ID,
          userAddress,
          userAddress,
          MOCK_PROFILE_HANDLE,
          MOCK_PROFILE_URI,
          profileFollowModule.address,
          EMPTY_BYTES,
          MOCK_FOLLOW_NFT_URI,
          await getTimestamp(),
        ]);
      });

      it('User should create a profile then set the profile follow module as the follow module, correct event should be emitted', async function () {
        await expect(
          rejig.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
            transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
          })
        ).to.not.be.reverted;

        const tx = rejig.setFollowModule(
          FIRST_PROFILE_ID,
          profileFollowModule.address,
          EMPTY_BYTES
        );

        const receipt = await waitForTx(tx);

        expect(receipt.logs.length).to.eq(1);
        matchEvent(receipt, 'FollowModuleSet', [
          FIRST_PROFILE_ID,
          profileFollowModule.address,
          EMPTY_BYTES,
          await getTimestamp(),
        ]);
      });
    });

    context('Processing follow', function () {
      beforeEach(async function () {
        await expect(
          rejig.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: profileFollowModule.address,
            followModuleInitData: EMPTY_BYTES,
            followNFTURI: MOCK_FOLLOW_NFT_URI,
            transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
          })
        ).to.not.be.reverted;
      });

      it('Follow call should work when follower profile exists, is owned by the follower address and has not already followed the profile', async function () {
        await expect(
          rejig.connect(userTwo).createProfile({
            to: userTwoAddress,
            handle: 'usertwo',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
            transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
          })
        ).to.not.be.reverted;
        const followerProfileId = FIRST_PROFILE_ID + 1;
        expect(
          await profileFollowModule.isProfileFollowing(followerProfileId, FIRST_PROFILE_ID)
        ).to.be.false;
        await expect(
          rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [DEFAULT_FOLLOW_DATA])
        ).to.not.be.reverted;
      });
    });
  });
});

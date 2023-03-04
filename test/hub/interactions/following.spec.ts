import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { FollowNFT__factory } from '../../../typechain-types';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import {
  expectEqualArrays,
  followReturningTokenIds,
  getAbbreviation,
  getTimestamp,
} from '../../helpers/utils';
import {
  rejig,
  FIRST_PROFILE_ID,
  makeSuiteCleanRoom,
  MOCK_PROFILE_HANDLE,
  testWallet,
  user,
  userTwo,
  userTwoAddress,
  MOCK_PROFILE_URI,
  userAddress,
  MOCK_FOLLOW_NFT_URI,
  governance,
  MOCK_TRANSACTION_NFT_URI
} from '../../__setup.spec';

makeSuiteCleanRoom('Following', function () {
  beforeEach(async function () {
    await expect(
      rejig.createProfile({
        to: userAddress,
        handle: MOCK_PROFILE_HANDLE,
        imageURI: MOCK_PROFILE_URI,
        followModule: ZERO_ADDRESS,
        followModuleInitData: [],
        followNFTURI: MOCK_FOLLOW_NFT_URI,
        transactionModule: ZERO_ADDRESS,
        transactionNFTURI: MOCK_TRANSACTION_NFT_URI,
      })
    ).to.not.be.reverted;
  });
  context('Generic', function () {
    context('Negatives', function () {
      it('UserTwo should fail to follow a nonexistent profile', async function () {
        await expect(
          rejig.connect(userTwo).follow([FIRST_PROFILE_ID + 1], [[]])
        ).to.be.revertedWith(ERRORS.TOKEN_DOES_NOT_EXIST);
      });

      it('UserTwo should fail to follow with array mismatch', async function () {
        await expect(
          rejig.connect(userTwo).follow([FIRST_PROFILE_ID, FIRST_PROFILE_ID], [[]])
        ).to.be.revertedWith(ERRORS.ARRAY_MISMATCH);
      });

      it('UserTwo should fail to follow a profile that has been burned', async function () {
        await expect(rejig.burn(FIRST_PROFILE_ID)).to.not.be.reverted;
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.be.revertedWith(
          ERRORS.TOKEN_DOES_NOT_EXIST
        );
      });
    });

    context('Scenarios', function () {
      it('UserTwo should follow profile 1, receive a followNFT with ID 1, followNFT properties should be correct', async function () {
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const timestamp = await getTimestamp();

        const followNFTAddress = await rejig.getFollowNFT(FIRST_PROFILE_ID);
        const followNFT = FollowNFT__factory.connect(followNFTAddress, user);
        expect(followNFT.address).to.not.eq(ZERO_ADDRESS);
        const id = await followNFT.tokenOfOwnerByIndex(userTwoAddress, 0);
        const name = await followNFT.name();
        const symbol = await followNFT.symbol();
        const owner = await followNFT.ownerOf(id);
        const mintTimestamp = await followNFT.mintTimestampOf(id);
        const followNFTURI = await followNFT.tokenURI(id);
        const tokenData = await followNFT.tokenDataOf(id);

        expect(id).to.eq(1);
        expect(name).to.eq(MOCK_PROFILE_HANDLE + '-Follower');
        expect(symbol).to.eq(getAbbreviation(MOCK_PROFILE_HANDLE) + '-Fl');
        expect(owner).to.eq(userTwoAddress);
        expect(tokenData.owner).to.eq(userTwoAddress);
        expect(tokenData.mintTimestamp).to.eq(timestamp);
        expect(followNFTURI).to.eq(MOCK_FOLLOW_NFT_URI);
        expect(mintTimestamp).to.eq(timestamp);
      });

      it('UserTwo should follow profile 1 twice, receiving followNFTs with IDs 1 and 2', async function () {
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFTAddress = await rejig.getFollowNFT(FIRST_PROFILE_ID);
        const followNFT = FollowNFT__factory.connect(followNFTAddress, user);
        const idOne = await followNFT.tokenOfOwnerByIndex(userTwoAddress, 0);
        const idTwo = await followNFT.tokenOfOwnerByIndex(userTwoAddress, 1);
        expect(idOne).to.eq(1);
        expect(idTwo).to.eq(2);
      });

      it('UserTwo should follow profile 1 3 times in the same call, receive IDs 1,2 and 3', async function () {
        await expect(
          rejig
            .connect(userTwo)
            .follow([FIRST_PROFILE_ID, FIRST_PROFILE_ID, FIRST_PROFILE_ID], [[], [], []])
        ).to.not.be.reverted;
        const followNFTAddress = await rejig.getFollowNFT(FIRST_PROFILE_ID);
        const followNFT = FollowNFT__factory.connect(followNFTAddress, user);
        const idOne = await followNFT.tokenOfOwnerByIndex(userTwoAddress, 0);
        const idTwo = await followNFT.tokenOfOwnerByIndex(userTwoAddress, 1);
        const idThree = await followNFT.tokenOfOwnerByIndex(userTwoAddress, 2);
        expect(idOne).to.eq(1);
        expect(idTwo).to.eq(2);
        expect(idThree).to.eq(3);
      });
    });
  });
});

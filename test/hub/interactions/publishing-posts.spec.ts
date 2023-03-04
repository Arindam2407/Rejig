import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { ethers } from 'hardhat';
import {
  postReturningTokenId,
} from '../../helpers/utils';
import {
  FIRST_PROFILE_ID,
  accounts,
  governance,
  rejig,
  rejigERC20Address,
  makeSuiteCleanRoom,
  mockModuleData,
  mockReferenceModule,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  testWallet,
  userAddress,
  user,
  userTwo,
  userThree,
  userFour,
  userFive,
  userSix,
  userSeven,
  userEight,
  userNine,
  userTen,
  userEleven,
  userTwelve,
  userThirteen,
  userFourteen,
  userFifteen,
  abiCoder,
  userTwoAddress,
  MOCK_TRANSACTION_NFT_URI
} from '../../__setup.spec';
import { zeroPad } from 'ethers/lib/utils';

let ac;

makeSuiteCleanRoom('Publishing Posts', function () {
  context('Generic', function () {
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
          transactionNFTURI: MOCK_TRANSACTION_NFT_URI
        })
      ).to.not.be.reverted;
    });

    context('Negatives', function () {
      it('UserTwo should fail to post to a profile owned by User', async function () {
        await expect(
          rejig.connect(userTwo).post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER_OR_DISPATCHER);
      });

      it('User should fail to post with invalid reference module data format', async function () {

        await expect(
          rejig.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: mockReferenceModule.address,
            referenceModuleInitData: [0x12, 0x23],
          })
        ).to.be.revertedWith(ERRORS.NO_REASON_ABI_DECODE);
      });
    });

    context('Scenarios', function () {
      it('Should return the expected token IDs when mirroring publications', async function () {

        await expect(
          rejig.connect(testWallet).createProfile({
            to: testWallet.address,
            handle: 'testwallet',
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
            transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
          })
        ).to.not.be.reverted;
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

        expect(
          await postReturningTokenId({
            vars: {
              profileId: FIRST_PROFILE_ID,
              contentURI: MOCK_URI,
              referenceModule: ZERO_ADDRESS,
              referenceModuleInitData: [],
            },
          })
        ).to.eq(1);

        expect(
          await postReturningTokenId({
            sender: userTwo,
            vars: {
              profileId: FIRST_PROFILE_ID + 2,
              contentURI: MOCK_URI,
              referenceModule: ZERO_ADDRESS,
              referenceModuleInitData: [],
            },
          })
        ).to.eq(1);

        expect(
          await postReturningTokenId({
            sender: testWallet,
            vars: {
              profileId: FIRST_PROFILE_ID + 1,
              contentURI: MOCK_URI,
              referenceModule: ZERO_ADDRESS,
              referenceModuleInitData: [],
            },
          })
        ).to.eq(1);
      });

      it('User should create a post with empty reference module data, fetched post data should be accurate', async function () {

        await expect(
          rejig.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        const pub = await rejig.getPub(FIRST_PROFILE_ID, 1);
        expect(pub.profileIdPointed).to.eq(0);
        expect(pub.pubIdPointed).to.eq(0);
        expect(pub.contentURI).to.eq(MOCK_URI);
        expect(pub.referenceModule).to.eq(ZERO_ADDRESS);
      });
    });
    context('Post NFT Scenarios', function () {
      it('Creators should be able to post NFTs', async function () {
        const list = [userTwo,userThree,userFour,userFive,userSix,userSeven,userEight,userNine,userTen];

        for(let i = 0; i < list.length; i++){
          ac = rejig.connect(list[i]);
          await ac.follow([FIRST_PROFILE_ID], [[]]);
        }
          
        await expect(rejig.postNFT({
          profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
        }, ethers.utils.parseEther('0.05'), ethers.utils.parseEther('0.0000000001'),
        { token1: rejigERC20Address,
          noTokens1: 1000000,
          token2: ZERO_ADDRESS,
          noTokens2: 0,
          token3: ZERO_ADDRESS,
          noTokens3: 0
        })).to.not.be.reverted;
      });
    });
  });
});

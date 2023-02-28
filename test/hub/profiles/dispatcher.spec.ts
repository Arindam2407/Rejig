import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { profile } from 'console';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import {
  FIRST_PROFILE_ID,
  governance,
  rejig,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  testWallet,
  userAddress,
  userTwo,
  userTwoAddress,
  abiCoder,
} from '../../__setup.spec';

makeSuiteCleanRoom('Dispatcher Functionality', function () {
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
        })
      ).to.not.be.reverted;
    });

    context('Negatives', function () {
      it('UserTwo should fail to set dispatcher on profile owned by user 1', async function () {
        await expect(
          rejig.connect(userTwo).setDispatcher(FIRST_PROFILE_ID, userTwoAddress)
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER);
      });

      it('UserTwo should fail to publish on profile owned by user 1 without being a dispatcher', async function () {
        await expect(
          rejig.connect(userTwo).post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER_OR_DISPATCHER);
      });

      it("User should set userTwo as dispatcher, userTwo should fail to set follow module on user's profile", async function () {
        await expect(rejig.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.not.be.reverted;
        await expect(
          rejig.connect(userTwo).setFollowModule(FIRST_PROFILE_ID, ZERO_ADDRESS, [])
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER);
      });
    });

    context('Scenarios', function () {
      it('User should set user two as a dispatcher on their profile, user two should post, comment and mirror', async function () {
        await expect(rejig.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.not.be.reverted;

        await expect(
          rejig.connect(userTwo).post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(
          rejig.connect(userTwo).comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(
          rejig.connect(userTwo).mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });
    });
  });

  context('Meta-tx', function () {
    beforeEach(async function () {
      await expect(
        rejig.connect(testWallet).createProfile({
          to: testWallet.address,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: ZERO_ADDRESS,
          followModuleInitData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
        })
      ).to.not.be.reverted;
    });

    context('Scenarios', function () {
      it('TestWallet should set user two as dispatcher for their profile, user two should post, comment and mirror', async function () {
        await expect(rejig.connect(testWallet).setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.not.be.reverted;

        await expect(
          rejig.connect(userTwo).post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(
          rejig.connect(userTwo).comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(
          rejig.connect(userTwo).mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });
    });
  });
});

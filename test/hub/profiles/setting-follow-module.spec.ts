import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import {
  FIRST_PROFILE_ID,
  governance,
  rejig,
  makeSuiteCleanRoom,
  mockFollowModule,
  mockModuleData,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  testWallet,
  userAddress,
  userTwo,
} from '../../__setup.spec';

makeSuiteCleanRoom('Setting Follow Module', function () {
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
      it('UserTwo should fail to set the follow module for the profile owned by User', async function () {
        await expect(
          rejig.connect(userTwo).setFollowModule(FIRST_PROFILE_ID, userAddress, [])
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER);
      });

      it('User should fail to set a follow module with invalid follow module data format', async function () {
        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, mockFollowModule.address, [0x12, 0x34])
        ).to.be.revertedWith(ERRORS.NO_REASON_ABI_DECODE);
      });
    });

    context('Scenarios', function () {
      it('User should set a whitelisted follow module, fetching the profile follow module should return the correct address, user then sets it to the zero address and fetching returns the zero address', async function () {
        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, mockFollowModule.address, mockModuleData)
        ).to.not.be.reverted;
        expect(await rejig.getFollowModule(FIRST_PROFILE_ID)).to.eq(mockFollowModule.address);

        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, ZERO_ADDRESS, [])
        ).to.not.be.reverted;
        expect(await rejig.getFollowModule(FIRST_PROFILE_ID)).to.eq(ZERO_ADDRESS);
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
  });
});

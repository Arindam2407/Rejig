import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import {
  FIRST_PROFILE_ID,
  governance,
  rejig,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  revertFollowModule,
  userAddress,
  userTwo,
} from '../../__setup.spec';

makeSuiteCleanRoom('Revert Follow Module', function () {
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
    context('Initialization', function () {
      it('Initialize call should fail when sender is not the hub', async function () {
        await expect(
          revertFollowModule.initializeFollowModule(FIRST_PROFILE_ID, [])
        ).to.be.revertedWith(ERRORS.NOT_HUB);
      });
    });

    context('Processing follow', function () {
      it('UserTwo should fail to process follow', async function () {
        await rejig.setFollowModule(FIRST_PROFILE_ID, revertFollowModule.address, []);
        expect(await rejig.getFollowModule(FIRST_PROFILE_ID)).to.be.equal(
          revertFollowModule.address
        );
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.be.revertedWith(
          ERRORS.FOLLOW_INVALID
        );
      });
    });
  });

  context('Scenarios', function () {
    context('Initialization', function () {
      it('Initialize call should succeed when passing non empty data and return empty bytes', async function () {
        const nonEmptyData = '0x1234';
        expect(
          await revertFollowModule
            .connect(rejig.address)
            .initializeFollowModule(FIRST_PROFILE_ID, nonEmptyData)
        ).to.be.equals('0x');
      });
    });
  });
});

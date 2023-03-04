import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { getTimestamp, matchEvent, waitForTx } from '../../helpers/utils';
import {
  abiCoder,
  approvalFollowModule,
  FIRST_PROFILE_ID,
  governance,
  rejig,
  rejigImpl,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_TRANSACTION_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  user,
  userAddress,
  userTwo,
  userTwoAddress,
} from '../../__setup.spec';

makeSuiteCleanRoom('Approval Follow Module', function () {
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
    context('Initialization', function () {
      it('Initialize call should fail when sender is not the hub', async function () {
        await expect(
          approvalFollowModule.initializeFollowModule(FIRST_PROFILE_ID, [])
        ).to.be.revertedWith(ERRORS.NOT_HUB);
      });
    });

    context('Approvals', function () {
      it('Approve should fail when calling it with addresses and toApprove params having different lengths', async function () {
        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
        ).to.not.be.reverted;
        await expect(
          approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userTwoAddress], [])
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });

      it('Approve should fail when sender differs from profile owner', async function () {
        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
        ).to.not.be.reverted;
        await expect(
          approvalFollowModule.connect(userTwo).approve(FIRST_PROFILE_ID, [userTwoAddress], [false])
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER);
      });
    });

    context('Processing follow', function () {
      it('UserTwo should fail to process follow without being the hub', async function () {
        await expect(
          approvalFollowModule.connect(userTwo).processFollow(userTwoAddress, FIRST_PROFILE_ID, [])
        ).to.be.revertedWith(ERRORS.NOT_HUB);
      });

      it('Follow should fail when follower address is not approved', async function () {
        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
        ).to.not.be.reverted;
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.be.revertedWith(
          ERRORS.FOLLOW_NOT_APPROVED
        );
      });

      it('Follow should fail when follower address approval is revoked after being approved', async function () {
        const data = abiCoder.encode(['address[]'], [[userTwoAddress]]);
        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, data)
        ).to.not.be.reverted;
        await expect(
          approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userTwoAddress], [false])
        ).to.not.be.reverted;
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.be.revertedWith(
          ERRORS.FOLLOW_NOT_APPROVED
        );
      });

      it('Follow should fail when follower address is not approved even when following itself', async function () {
        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
        ).to.not.be.reverted;
        await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.be.revertedWith(
          ERRORS.FOLLOW_NOT_APPROVED
        );
      });
    });
  });

  context('Scenarios', function () {

    context('Approvals and follows', function () {
      it('Approval should emit expected event', async function () {
        const tx = approvalFollowModule
          .connect(user)
          .approve(FIRST_PROFILE_ID, [userTwoAddress], [true]);

        const receipt = await waitForTx(tx);

        expect(receipt.logs.length).to.eq(1);
        matchEvent(receipt, 'FollowsApproved', [
          userAddress,
          FIRST_PROFILE_ID,
          [userTwoAddress],
          [true],
          await getTimestamp(),
        ]);
      });

      it('Follow call should work when address was previously approved', async function () {
        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
        ).to.not.be.reverted;
        await expect(
          approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userTwoAddress], [true])
        ).to.not.be.reverted;
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
      });

      it('Follow call to self should work when address was previously approved', async function () {
        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
        ).to.not.be.reverted;
        await expect(
          approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userAddress], [true])
        ).to.not.be.reverted;
        await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
      });
    });

    context('View Functions', function () {
      beforeEach(async function () {
        const data = abiCoder.encode(['address[]'], [[userTwoAddress]]);
        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, data)
        ).to.not.be.reverted;
      });

      it('Single approval getter should return expected values', async function () {
        expect(
          await approvalFollowModule.isApproved(userAddress, FIRST_PROFILE_ID, userTwoAddress)
        ).to.eq(true);

        expect(
          await approvalFollowModule.isApproved(userAddress, FIRST_PROFILE_ID, userAddress)
        ).to.eq(false);
      });

      it('Array approval getter should return expected values', async function () {
        const result = await approvalFollowModule.isApprovedArray(userAddress, FIRST_PROFILE_ID, [
          userTwoAddress,
          userAddress,
        ]);
        expect(result[0]).to.eq(true);
        expect(result[1]).to.eq(false);
      });
    });
  });
});

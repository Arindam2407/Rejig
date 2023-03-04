import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { FollowNFT__factory } from '../../../typechain-types';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { getTimestamp, matchEvent, waitForTx } from '../../helpers/utils';
import {
  FIRST_PROFILE_ID,
  followerOnlyReferenceModule,
  governance,
  rejig,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  user,
  userAddress,
  userThreeAddress,
  userTwo,
  userTwoAddress,
  abiCoder,
  MOCK_TRANSACTION_NFT_URI
} from '../../__setup.spec';

makeSuiteCleanRoom('Follower Only Reference Module', function () {
  const SECOND_PROFILE_ID = FIRST_PROFILE_ID + 1;

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
    await expect(
      rejig.connect(userTwo).createProfile({
        to: userTwoAddress,
        handle: 'user2',
        imageURI: MOCK_PROFILE_URI,
        followModule: ZERO_ADDRESS,
        followModuleInitData: [],
        followNFTURI: MOCK_FOLLOW_NFT_URI,
        transactionModule: ZERO_ADDRESS,
        transactionNFTURI: MOCK_TRANSACTION_NFT_URI
      })
    ).to.not.be.reverted;
    await expect(
      rejig.post({
        profileId: FIRST_PROFILE_ID,
        contentURI: MOCK_URI,
        referenceModule: followerOnlyReferenceModule.address,
        referenceModuleInitData: [],
      })
    ).to.not.be.reverted;
  });

  context('Negatives', function () {
    // We don't need a `publishing` or `initialization` context because initialization never reverts in the FollowerOnlyReferenceModule.
    context('Commenting', function () {
      it('Commenting should fail if commenter is not a follower and follow NFT not yet deployed', async function () {
        await expect(
          rejig.connect(userTwo).comment({
            profileId: SECOND_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
      });

      it('Commenting should fail if commenter follows, then transfers the follow NFT before attempting to comment', async function () {
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFT = FollowNFT__factory.connect(
          await rejig.getFollowNFT(FIRST_PROFILE_ID),
          user
        );

        await expect(
          followNFT.connect(userTwo).transferFrom(userTwoAddress, userThreeAddress, 1)
        ).to.not.be.reverted;

        await expect(
          rejig.connect(userTwo).comment({
            profileId: SECOND_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
      });
    });

    context('Mirroring', function () {
      it('Mirroring should fail if mirrorer is not a follower and follow NFT not yet deployed', async function () {
        await expect(
          rejig.connect(userTwo).mirror({
            profileId: SECOND_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
      });

      it('Mirroring should fail if mirrorer follows, then transfers the follow NFT before attempting to mirror', async function () {
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFT = FollowNFT__factory.connect(
          await rejig.getFollowNFT(FIRST_PROFILE_ID),
          user
        );

        await expect(
          followNFT.connect(userTwo).transferFrom(userTwoAddress, userAddress, 1)
        ).to.not.be.reverted;

        await expect(
          rejig.connect(userTwo).mirror({
            profileId: SECOND_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
      });
    });
  });

  context('Scenarios', function () {
    context('Publishing', function () {
      it('Posting with follower only reference module as reference module should emit expected events', async function () {
        const tx = rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: followerOnlyReferenceModule.address,
          referenceModuleInitData: [],
        });
        const receipt = await waitForTx(tx);

        expect(receipt.logs.length).to.eq(1);
        matchEvent(receipt, 'PostCreated', [
          FIRST_PROFILE_ID,
          2,
          MOCK_URI,
          followerOnlyReferenceModule.address,
          [],
          await getTimestamp(),
        ]);
      });
    });

    context('Commenting', function () {
      it('Commenting should work if the commenter is a follower', async function () {
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFT = FollowNFT__factory.connect(
          await rejig.getFollowNFT(FIRST_PROFILE_ID),
          user
        );

        await expect(
          rejig.connect(userTwo).comment({
            profileId: SECOND_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });

      it('Commenting should work if the commenter is the publication owner and he is following himself', async function () {
        await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFT = FollowNFT__factory.connect(
          await rejig.getFollowNFT(FIRST_PROFILE_ID),
          user
        );

        await expect(
          rejig.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });

      it('Commenting should work if the commenter is the publication owner even when he is not following himself and follow NFT was not deployed', async function () {
        await expect(
          rejig.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });

      it('Commenting should work if the commenter is the publication owner even when he is not following himself and follow NFT was deployed', async function () {
        await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFT = FollowNFT__factory.connect(
          await rejig.getFollowNFT(FIRST_PROFILE_ID),
          user
        );

        await expect(followNFT.transferFrom(userAddress, userTwoAddress, 1)).to.not.be.reverted;

        await expect(
          rejig.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });

      it('Commenting should work if the commenter follows, transfers the follow NFT then receives it back before attempting to comment', async function () {
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFT = FollowNFT__factory.connect(
          await rejig.getFollowNFT(FIRST_PROFILE_ID),
          user
        );

        await expect(
          followNFT.connect(userTwo).transferFrom(userTwoAddress, userAddress, 1)
        ).to.not.be.reverted;

        await expect(followNFT.transferFrom(userAddress, userTwoAddress, 1)).to.not.be.reverted;

        await expect(
          rejig.connect(userTwo).comment({
            profileId: SECOND_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });
    });

    context('Mirroring', function () {
      it('Mirroring should work if mirrorer is a follower', async function () {
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFT = FollowNFT__factory.connect(
          await rejig.getFollowNFT(FIRST_PROFILE_ID),
          user
        );

        await expect(
          rejig.connect(userTwo).mirror({
            profileId: SECOND_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });

      it('Mirroring should work if mirrorer follows, transfers the follow NFT then receives it back before attempting to mirror', async function () {
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFT = FollowNFT__factory.connect(
          await rejig.getFollowNFT(FIRST_PROFILE_ID),
          user
        );

        await expect(
          followNFT.connect(userTwo).transferFrom(userTwoAddress, userAddress, 1)
        ).to.not.be.reverted;

        await expect(followNFT.transferFrom(userAddress, userTwoAddress, 1)).to.not.be.reverted;

        await expect(
          rejig.connect(userTwo).mirror({
            profileId: SECOND_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });

      it('Mirroring should work if the mirrorer is the publication owner and he is following himself', async function () {
        await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFT = FollowNFT__factory.connect(
          await rejig.getFollowNFT(FIRST_PROFILE_ID),
          user
        );

        await expect(
          rejig.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });

      it('Mirroring should work if the mirrorer is the publication owner even when he is not following himself and follow NFT was not deployed', async function () {
        await expect(
          rejig.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });

      it('Mirroring should work if the mirrorer is the publication owner even when he is not following himself and follow NFT was deployed', async function () {
        await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFT = FollowNFT__factory.connect(
          await rejig.getFollowNFT(FIRST_PROFILE_ID),
          user
        );

        await expect(followNFT.transferFrom(userAddress, userTwoAddress, 1)).to.not.be.reverted;

        await expect(
          rejig.mirror({
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

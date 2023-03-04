import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import {
  commentReturningTokenId,
} from '../../helpers/utils';
import {
  abiCoder,
  FIRST_PROFILE_ID,
  governance,
  rejig,
  makeSuiteCleanRoom,
  mockReferenceModule,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  OTHER_MOCK_URI,
  testWallet,
  userAddress,
  userTwo,
  userTwoAddress,
  MOCK_TRANSACTION_NFT_URI,
} from '../../__setup.spec';

makeSuiteCleanRoom('Publishing Comments', function () {
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

      await expect(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;
    });

    context('Negatives', function () {
      it('UserTwo should fail to publish a comment to a profile owned by User', async function () {
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
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER_OR_DISPATCHER);
      });

      it('User should fail to comment with invalid reference module data format', async function () {
        await expect(
          rejig.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: mockReferenceModule.address,
            referenceModuleInitData: [0x12, 0x23],
          })
        ).to.be.revertedWith(ERRORS.NO_REASON_ABI_DECODE);
      });

      it('User should fail to comment on a publication that does not exist', async function () {
        await expect(
          rejig.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 3,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.PUBLICATION_DOES_NOT_EXIST);
      });

      it('User should fail to comment on the same comment they are creating (pubId = 2, commentCeption)', async function () {
        await expect(
          rejig.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 2,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.CANNOT_COMMENT_ON_SELF);
      });
    });

    context('Scenarios', function () {
      it('User should create a comment with empty reference module, and reference module data, fetched comment data should be accurate', async function () {
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

        const pub = await rejig.getPub(FIRST_PROFILE_ID, 2);
        expect(pub.profileIdPointed).to.eq(FIRST_PROFILE_ID);
        expect(pub.pubIdPointed).to.eq(1);
        expect(pub.contentURI).to.eq(MOCK_URI);
        expect(pub.referenceModule).to.eq(ZERO_ADDRESS);
      });
 
      it('Should return the expected token IDs when commenting publications', async function () {
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

        expect(
          await commentReturningTokenId({
            sender: testWallet,
            vars: {
              profileId: FIRST_PROFILE_ID + 1,
              contentURI: MOCK_URI,
              profileIdPointed: FIRST_PROFILE_ID,
              pubIdPointed: 1,
              referenceModuleData: [],
              referenceModule: ZERO_ADDRESS,
              referenceModuleInitData: [],
            },
          })
        ).to.eq(1);
      });

      it('User should create a post using the mock reference module as reference module, then comment on that post', async function () {
        const data = abiCoder.encode(['uint256'], ['1']);
        await expect(
          rejig.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: mockReferenceModule.address,
            referenceModuleInitData: data,
          })
        ).to.not.be.reverted;

        await expect(
          rejig.comment({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 2,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      });
    });
  });
});

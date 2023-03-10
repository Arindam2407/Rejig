import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { FollowNFT__factory, UIDataProvider__factory } from '../../typechain-types';
import { MAX_UINT256, ZERO_ADDRESS } from '../helpers/constants';
import { ERRORS } from '../helpers/errors';
import {
  getDecodedSvgImage,
  getMetadataFromBase64TokenUri,
  getTimestamp,
  loadTestResourceAsUtf8String,
  matchEvent,
  waitForTx,
} from '../helpers/utils';
import {
  approvalFollowModule,
  deployer,
  FIRST_PROFILE_ID,
  followerOnlyReferenceModule,
  governance,
  governanceAddress,
  rejig,
  makeSuiteCleanRoom,
  mockFollowModule,
  mockModuleData,
  MOCK_FOLLOW_NFT_URI,
  MOCK_TRANSACTION_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  moduleGlobals,
  OTHER_MOCK_URI,
  treasuryAddress,
  TREASURY_FEE_BPS,
  user,
  userAddress,
  userTwo,
  userTwoAddress,
  abiCoder,
  userThree,
  testWallet,
  rejigPeriphery,
  followNFTImpl,
} from '../__setup.spec';

/**
 * @dev Some of these tests may be redundant, but are still present to ensure an isolated environment,
 * in particular if other test files are changed.
 */
makeSuiteCleanRoom('Misc', function () {
  context('NFT Transfer Emitters', function () {
    it('User should not be able to call the follow NFT transfer event emitter function', async function () {
      await expect(
        rejig.emitFollowNFTTransferEvent(FIRST_PROFILE_ID, 1, userAddress, userTwoAddress)
      ).to.be.revertedWith(ERRORS.NOT_FOLLOW_NFT);
    });
  });

  context('Rejig Misc', function () {
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

    it('UserTwo should fail to burn profile owned by user without being approved', async function () {
      await expect(rejig.connect(userTwo).burn(FIRST_PROFILE_ID)).to.be.revertedWith(
        ERRORS.NOT_OWNER_OR_APPROVED
      );
    });

    it('User should burn profile owned by user', async function () {
      await expect(rejig.burn(FIRST_PROFILE_ID)).to.not.be.reverted;
    });

    it('UserTwo should burn profile owned by user if approved', async function () {
      await expect(rejig.approve(userTwoAddress, FIRST_PROFILE_ID)).to.not.be.reverted;
      await expect(rejig.connect(userTwo).burn(FIRST_PROFILE_ID)).to.not.be.reverted;
    });

    it('Governance getter should return proper address', async function () {
      expect(await rejig.getGovernance()).to.eq(governanceAddress);
    });

    it('Profile handle getter should return the correct handle', async function () {
      expect(await rejig.getHandle(FIRST_PROFILE_ID)).to.eq(MOCK_PROFILE_HANDLE);
    });

    it('Profile dispatcher getter should return the zero address when no dispatcher is set', async function () {
      expect(await rejig.getDispatcher(FIRST_PROFILE_ID)).to.eq(ZERO_ADDRESS);
    });

    it('Profile dispatcher getter should return the correct dispatcher address when it is set, then zero after it is transferred', async function () {
      await expect(rejig.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.not.be.reverted;
      expect(await rejig.getDispatcher(FIRST_PROFILE_ID)).to.eq(userTwoAddress);

      await expect(
        rejig.transferFrom(userAddress, userTwoAddress, FIRST_PROFILE_ID)
      ).to.not.be.reverted;
      expect(await rejig.getDispatcher(FIRST_PROFILE_ID)).to.eq(ZERO_ADDRESS);
    });

    it('Profile follow NFT getter should return the zero address before the first follow, then the correct address afterwards', async function () {
      expect(await rejig.getFollowNFT(FIRST_PROFILE_ID)).to.eq(ZERO_ADDRESS);

      await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

      expect(await rejig.getFollowNFT(FIRST_PROFILE_ID)).to.not.eq(ZERO_ADDRESS);
    });

    it('Profile follow module getter should return the zero address, then the correct follow module after it is set', async function () {
      expect(await rejig.getFollowModule(FIRST_PROFILE_ID)).to.eq(ZERO_ADDRESS);

      await expect(
        rejig.setFollowModule(FIRST_PROFILE_ID, mockFollowModule.address, mockModuleData)
      ).to.not.be.reverted;
      expect(await rejig.getFollowModule(FIRST_PROFILE_ID)).to.eq(mockFollowModule.address);
    });

    it('Profile publication count getter should return zero, then the correct amount after some publications', async function () {
      expect(await rejig.getPubCount(FIRST_PROFILE_ID)).to.eq(0);

      const expectedCount = 5;
      for (let i = 0; i < expectedCount; i++) {
        await expect(
          rejig.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;
      }
      expect(await rejig.getPubCount(FIRST_PROFILE_ID)).to.eq(expectedCount);
    });

    it('Follow NFT impl getter should return the correct address', async function () {
      expect(await rejig.getFollowNFTImpl()).to.eq(followNFTImpl.address);
    });

    it('Profile tokenURI should return the accurate URI', async function () {
      const tokenUri = await rejig.tokenURI(FIRST_PROFILE_ID);
      const metadata = await getMetadataFromBase64TokenUri(tokenUri);
      expect(metadata.name).to.eq(`@${MOCK_PROFILE_HANDLE}`);
      expect(metadata.description).to.eq(`@${MOCK_PROFILE_HANDLE} - Rejig profile`);
      const expectedAttributes = [
        { trait_type: 'id', value: `#${FIRST_PROFILE_ID.toString()}` },
        { trait_type: 'followers', value: '0' },
        { trait_type: 'owner', value: userAddress.toLowerCase() },
        { trait_type: 'handle', value: `@${MOCK_PROFILE_HANDLE}` },
      ];
      expect(metadata.attributes).to.eql(expectedAttributes);
      const actualSvg = await getDecodedSvgImage(metadata);
      const expectedSvg = loadTestResourceAsUtf8String('profile-token-uri-images/mock-profile.svg');
      expect(actualSvg).to.eq(expectedSvg);
    });

    it('Publication reference module getter should return the correct reference module (or zero in case of no reference module)', async function () {

      await expect(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;
      expect(await rejig.getReferenceModule(FIRST_PROFILE_ID, 1)).to.eq(ZERO_ADDRESS);

      await expect(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: followerOnlyReferenceModule.address,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;
      expect(await rejig.getReferenceModule(FIRST_PROFILE_ID, 2)).to.eq(
        followerOnlyReferenceModule.address
      );
    });

    it('Publication pointer getter should return an empty pointer for posts', async function () {

      await expect(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;

      const pointer = await rejig.getPubPointer(FIRST_PROFILE_ID, 1);
      expect(pointer[0]).to.eq(0);
      expect(pointer[1]).to.eq(0);
    });

    it('Publication pointer getter should return the correct pointer for comments', async function () {

      await expect(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;

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

      const pointer = await rejig.getPubPointer(FIRST_PROFILE_ID, 2);
      expect(pointer[0]).to.eq(FIRST_PROFILE_ID);
      expect(pointer[1]).to.eq(1);
    });

    it('Publication pointer getter should return the correct pointer for mirrors', async function () {
      await expect(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;

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

      const pointer = await rejig.getPubPointer(FIRST_PROFILE_ID, 2);
      expect(pointer[0]).to.eq(FIRST_PROFILE_ID);
      expect(pointer[1]).to.eq(1);
    });

    it('Publication content URI getter should return the correct URI for posts', async function () {

      await expect(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;

      expect(await rejig.getContentURI(FIRST_PROFILE_ID, 1)).to.eq(MOCK_URI);
    });

    it('Publication content URI getter should return the correct URI for comments', async function () {

      await expect(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;

      await expect(
        rejig.comment({
          profileId: FIRST_PROFILE_ID,
          contentURI: OTHER_MOCK_URI,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 1,
          referenceModuleData: [],
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;

      expect(await rejig.getContentURI(FIRST_PROFILE_ID, 2)).to.eq(OTHER_MOCK_URI);
    });

    it('Publication content URI getter should return the correct URI for mirrors', async function () {

      await expect(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;

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
      expect(await rejig.getContentURI(FIRST_PROFILE_ID, 2)).to.eq('');
    });

    it('Publication type getter should return the correct publication type for all publication types, or nonexistent', async function () {

      await expect(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;

      await expect(
        rejig.comment({
          profileId: FIRST_PROFILE_ID,
          contentURI: OTHER_MOCK_URI,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 1,
          referenceModuleData: [],
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;

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

      expect(await rejig.getPubType(FIRST_PROFILE_ID, 1)).to.eq(0);
      expect(await rejig.getPubType(FIRST_PROFILE_ID, 2)).to.eq(1);
      expect(await rejig.getPubType(FIRST_PROFILE_ID, 3)).to.eq(2);
      expect(await rejig.getPubType(FIRST_PROFILE_ID, 4)).to.eq(3);
    });

    it('Profile getter should return accurate profile parameters', async function () {
      const fetchedProfile = await rejig.getProfile(FIRST_PROFILE_ID);
      expect(fetchedProfile.pubCount).to.eq(0);
      expect(fetchedProfile.handle).to.eq(MOCK_PROFILE_HANDLE);
      expect(fetchedProfile.followModule).to.eq(ZERO_ADDRESS);
      expect(fetchedProfile.followNFT).to.eq(ZERO_ADDRESS);
    });
  });

  context('Follow Module Misc', function () {
    beforeEach(async function () {

      await expect(
        rejig.createProfile({
          to: userAddress,
          handle: MOCK_PROFILE_HANDLE,
          imageURI: MOCK_PROFILE_URI,
          followModule: approvalFollowModule.address,
          followModuleInitData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
          transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
        })
      ).to.not.be.reverted;
    });

    it('User should fail to call processFollow directly on a follow module inheriting from the FollowValidatorFollowModuleBase', async function () {
      await expect(approvalFollowModule.processFollow(ZERO_ADDRESS, 0, [])).to.be.revertedWith(
        ERRORS.NOT_HUB
      );
    });

    it('Follow module following check when there are no follows, and thus no deployed Follow NFT should return false', async function () {
      expect(
        await approvalFollowModule.isFollowing(FIRST_PROFILE_ID, userTwoAddress, 0)
      ).to.be.false;
    });

    it('Follow module following check with zero ID input should return false after another address follows, but not the queried address', async function () {
      await expect(
        approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userAddress], [true])
      ).to.not.be.reverted;
      await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

      expect(
        await approvalFollowModule.isFollowing(FIRST_PROFILE_ID, userTwoAddress, 0)
      ).to.be.false;
    });

    it('Follow module following check with specific ID input should revert after following, but the specific ID does not exist yet', async function () {
      await expect(
        approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userAddress], [true])
      ).to.not.be.reverted;
      await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

      await expect(
        approvalFollowModule.isFollowing(FIRST_PROFILE_ID, userAddress, 2)
      ).to.be.revertedWith(ERRORS.ERC721_QUERY_FOR_NONEXISTENT_TOKEN);
    });

    it('Follow module following check with specific ID input should return false if another address owns the specified follow NFT', async function () {
      await expect(
        approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userAddress], [true])
      ).to.not.be.reverted;
      await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

      expect(
        await approvalFollowModule.isFollowing(FIRST_PROFILE_ID, userTwoAddress, 1)
      ).to.be.false;
    });

    it('Follow module following check with specific ID input should return true if the queried address owns the specified follow NFT', async function () {
      await expect(
        approvalFollowModule.connect(user).approve(FIRST_PROFILE_ID, [userAddress], [true])
      ).to.not.be.reverted;
      await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

      expect(await approvalFollowModule.isFollowing(FIRST_PROFILE_ID, userAddress, 1)).to.be.true;
    });
  });

  context('Module Globals', function () {
    context('Negatives', function () {
      it('User should fail to set the governance address on the module globals', async function () {
        await expect(moduleGlobals.connect(user).setGovernance(ZERO_ADDRESS)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE
        );
      });

      it('User should fail to set the treasury on the module globals', async function () {
        await expect(moduleGlobals.connect(user).setTreasury(ZERO_ADDRESS)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE
        );
      });

      it('User should fail to set the treasury fee on the module globals', async function () {
        await expect(moduleGlobals.connect(user).setTreasuryFee(0)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE
        );
      });
    });

    context('Scenarios', function () {
      it('Governance should set the governance address on the module globals', async function () {
        await expect(
          moduleGlobals.connect(governance).setGovernance(userAddress)
        ).to.not.be.reverted;
      });

      it('Governance should set the treasury on the module globals', async function () {
        await expect(moduleGlobals.connect(governance).setTreasury(userAddress)).to.not.be.reverted;
      });

      it('Governance should set the treasury fee on the module globals', async function () {
        await expect(moduleGlobals.connect(governance).setTreasuryFee(0)).to.not.be.reverted;
      });

      it('Governance should fail to whitelist the zero address as a currency', async function () {
        await expect(
          moduleGlobals.connect(governance).whitelistCurrency(ZERO_ADDRESS, true)
        ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
      });

      it('Governance getter should return expected address', async function () {
        expect(await moduleGlobals.getGovernance()).to.eq(governanceAddress);
      });

      it('Treasury getter should return expected address', async function () {
        expect(await moduleGlobals.getTreasury()).to.eq(treasuryAddress);
      });

      it('Treasury fee getter should return the expected fee', async function () {
        expect(await moduleGlobals.getTreasuryFee()).to.eq(TREASURY_FEE_BPS);
      });
    });
  });

  context('UI Data Provider', function () {
    it('UI Data Provider should return expected values', async function () {
      // First, create a profile,
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

      // Then, publish twice
      const firstURI = 'first publication';
      const secondURI = 'second publication';
      await expect(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: firstURI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;

      await expect(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: secondURI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      ).to.not.be.reverted;

      // Then, deploy the data provider
      const rejigPeriphery = await new UIDataProvider__factory(deployer).deploy(rejig.address);

      // `getLatestDataByProfile`, validate the result from the data provider
      const resultByProfileId = await rejigPeriphery.getLatestDataByProfile(FIRST_PROFILE_ID);
      const pubByProfileIdStruct = resultByProfileId.publicationStruct;
      const profileByProfileIdStruct = resultByProfileId.profileStruct;

      expect(profileByProfileIdStruct.pubCount).to.eq(2);
      expect(profileByProfileIdStruct.followModule).to.eq(ZERO_ADDRESS);
      expect(profileByProfileIdStruct.followNFT).to.eq(ZERO_ADDRESS);
      expect(profileByProfileIdStruct.handle).to.eq(MOCK_PROFILE_HANDLE);
      expect(profileByProfileIdStruct.imageURI).to.eq(MOCK_PROFILE_URI);
      expect(profileByProfileIdStruct.followNFTURI).to.eq(MOCK_FOLLOW_NFT_URI);

      expect(pubByProfileIdStruct.profileIdPointed).to.eq(0);
      expect(pubByProfileIdStruct.pubIdPointed).to.eq(0);
      expect(pubByProfileIdStruct.contentURI).to.eq(secondURI);
      expect(pubByProfileIdStruct.referenceModule).to.eq(ZERO_ADDRESS);

      // `getLatestDataByHandle`, validate the result from the data provider
      const resultByHandle = await rejigPeriphery.getLatestDataByHandle(MOCK_PROFILE_HANDLE);
      const pubByHandleStruct = resultByHandle.publicationStruct;
      const profileByHandleStruct = resultByHandle.profileStruct;

      expect(profileByHandleStruct.pubCount).to.eq(2);
      expect(profileByHandleStruct.followModule).to.eq(ZERO_ADDRESS);
      expect(profileByHandleStruct.followNFT).to.eq(ZERO_ADDRESS);
      expect(profileByHandleStruct.handle).to.eq(MOCK_PROFILE_HANDLE);
      expect(profileByHandleStruct.imageURI).to.eq(MOCK_PROFILE_URI);
      expect(profileByHandleStruct.followNFTURI).to.eq(MOCK_FOLLOW_NFT_URI);

      expect(pubByHandleStruct.profileIdPointed).to.eq(0);
      expect(pubByHandleStruct.pubIdPointed).to.eq(0);
      expect(pubByHandleStruct.contentURI).to.eq(secondURI);
      expect(pubByHandleStruct.referenceModule).to.eq(ZERO_ADDRESS);
    });
  });

  context('rejigPeriphery', async function () {
    context('ToggleFollowing', function () {
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
        await expect(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        await expect(
          rejig.connect(userThree).follow([FIRST_PROFILE_ID], [[]])
        ).to.not.be.reverted;
        await expect(
          rejig.connect(testWallet).follow([FIRST_PROFILE_ID], [[]])
        ).to.not.be.reverted;
      });

      context('Generic', function () {
        context('Negatives', function () {
          it('UserTwo should fail to toggle follow with an incorrect profileId', async function () {
            await expect(
              rejigPeriphery.connect(userTwo).toggleFollow([FIRST_PROFILE_ID + 1], [true])
            ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
          });

          it('UserTwo should fail to toggle follow with array mismatch', async function () {
            await expect(
              rejigPeriphery.connect(userTwo).toggleFollow([FIRST_PROFILE_ID, FIRST_PROFILE_ID], [])
            ).to.be.revertedWith(ERRORS.ARRAY_MISMATCH);
          });

          it('UserTwo should fail to toggle follow from a profile that has been burned', async function () {
            await expect(rejig.burn(FIRST_PROFILE_ID)).to.not.be.reverted;
            await expect(
              rejigPeriphery.connect(userTwo).toggleFollow([FIRST_PROFILE_ID], [true])
            ).to.be.revertedWith(ERRORS.TOKEN_DOES_NOT_EXIST);
          });

          it('UserTwo should fail to toggle follow for a followNFT that is not owned by them', async function () {
            const followNFTAddress = await rejig.getFollowNFT(FIRST_PROFILE_ID);
            const followNFT = FollowNFT__factory.connect(followNFTAddress, user);

            await expect(
              followNFT.connect(userTwo).transferFrom(userTwoAddress, userAddress, 1)
            ).to.not.be.reverted;

            await expect(
              rejigPeriphery.connect(userTwo).toggleFollow([FIRST_PROFILE_ID], [true])
            ).to.be.revertedWith(ERRORS.FOLLOW_INVALID);
          });
        });

        context('Scenarios', function () {
          it('UserTwo should toggle follow with true value, correct event should be emitted', async function () {
            const tx = rejigPeriphery.connect(userTwo).toggleFollow([FIRST_PROFILE_ID], [true]);

            const receipt = await waitForTx(tx);

            expect(receipt.logs.length).to.eq(1);
            matchEvent(receipt, 'FollowsToggled', [
              userTwoAddress,
              [FIRST_PROFILE_ID],
              [true],
              await getTimestamp(),
            ]);
          });

          it('UserTwo should toggle follow with false value, correct event should be emitted', async function () {
            const tx = rejigPeriphery.connect(userTwo).toggleFollow([FIRST_PROFILE_ID], [false]);

            const receipt = await waitForTx(tx);

            expect(receipt.logs.length).to.eq(1);
            matchEvent(receipt, 'FollowsToggled', [
              userTwoAddress,
              [FIRST_PROFILE_ID],
              [false],
              await getTimestamp(),
            ]);
          });
        });
      });
      });
    });

    context('Profile Metadata URI', function () {
      const MOCK_DATA = 'd171c8b1d364bb34553299ab686caa41ac7a2209d4a63e25947764080c4681da';

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
          it('User two should fail to set profile metadata URI for a profile that is not theirs while they are not the dispatcher', async function () {
            await expect(
              rejigPeriphery.connect(userTwo).setProfileMetadataURI(FIRST_PROFILE_ID, MOCK_DATA)
            ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER_OR_DISPATCHER);
          });
        });

        context('Scenarios', function () {
          it("User should set user two as dispatcher, user two should set profile metadata URI for user one's profile, fetched data should be accurate", async function () {
            await expect(
              rejig.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)
            ).to.not.be.reverted;
            await expect(
              rejigPeriphery.connect(userTwo).setProfileMetadataURI(FIRST_PROFILE_ID, MOCK_DATA)
            ).to.not.be.reverted;

            expect(await rejigPeriphery.getProfileMetadataURI(FIRST_PROFILE_ID)).to.eq(MOCK_DATA);
            expect(await rejigPeriphery.getProfileMetadataURI(FIRST_PROFILE_ID)).to.eq(MOCK_DATA);
          });

          it('Setting profile metadata should emit the correct event', async function () {
            const tx = await waitForTx(
              rejigPeriphery.setProfileMetadataURI(FIRST_PROFILE_ID, MOCK_DATA)
            );

            matchEvent(tx, 'ProfileMetadataSet', [
              FIRST_PROFILE_ID,
              MOCK_DATA,
              await getTimestamp(),
            ]);
          });

          it('Setting profile metadata via dispatcher should emit the correct event', async function () {
            await expect(
              rejig.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)
            ).to.not.be.reverted;

            const tx = await waitForTx(
              rejigPeriphery.connect(userTwo).setProfileMetadataURI(FIRST_PROFILE_ID, MOCK_DATA)
            );

            matchEvent(tx, 'ProfileMetadataSet', [
              FIRST_PROFILE_ID,
              MOCK_DATA,
              await getTimestamp(),
            ]);
          });
        });
      });

      context('Meta-tx', async function () {
        beforeEach(async function () {
          await expect(
            rejig.connect(testWallet).createProfile({
              to: testWallet.address,
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
      });
    });
  });

import { TransactionReceipt } from '@ethersproject/providers';
import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { TransparentUpgradeableProxy__factory } from '../../typechain-types';
import { MAX_UINT256, ZERO_ADDRESS } from '../helpers/constants';
import {
  getAbbreviation,
  getTimestamp,
  matchEvent,
  ProtocolState,
  waitForTx,
} from '../helpers/utils';
import {
  approvalFollowModule,
  deployer,
  deployerAddress,
  FIRST_PROFILE_ID,
  governance,
  governanceAddress,
  rejig,
  rejigImpl,
  REJIG_NFT_NAME,
  REJIG_NFT_SYMBOL,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_TRANSACTION_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  moduleGlobals,
  treasuryAddress,
  TREASURY_FEE_BPS,
  user,
  userAddress,
  userTwo,
  userTwoAddress,
  abiCoder,
  currency,
} from '../__setup.spec';

/**
 * Note: We use the `rejigImpl` contract to test ERC721 specific events.
 *
 * TODO: Add specific test cases to ensure all module encoded return data parameters are
 * as expected.
 *
 * TODO: Add module deployment tests.
 */
makeSuiteCleanRoom('Events', function () {
  let receipt: TransactionReceipt;

  context('Misc', function () {
    it('Proxy initialization should emit expected events', async function () {
      let data = rejigImpl.interface.encodeFunctionData('initialize', [
        REJIG_NFT_NAME,
        REJIG_NFT_SYMBOL,
        governanceAddress,
      ]);

      let proxy = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        rejigImpl.address,
        deployerAddress,
        data
      );

      receipt = await waitForTx(proxy.deployTransaction, true);

      expect(receipt.logs.length).to.eq(5);
      matchEvent(receipt, 'Upgraded', [rejigImpl.address], proxy);
      matchEvent(receipt, 'AdminChanged', [ZERO_ADDRESS, deployerAddress], proxy);
      matchEvent(receipt, 'GovernanceSet', [
        deployerAddress,
        ZERO_ADDRESS,
        governanceAddress,
        await getTimestamp(),
      ]);
      matchEvent(receipt, 'StateSet', [
        deployerAddress,
        ProtocolState.Unpaused,
        ProtocolState.Paused,
        await getTimestamp(),
      ]);
      matchEvent(receipt, 'BaseInitialized', [
        REJIG_NFT_NAME,
        REJIG_NFT_SYMBOL,
        await getTimestamp(),
      ]);
    });
  });

  context('Hub Governance', function () {
    it('Governance change should emit expected event', async function () {
      receipt = await waitForTx(rejig.connect(governance).setGovernance(userAddress));
      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'GovernanceSet', [
        governanceAddress,
        governanceAddress,
        userAddress,
        await getTimestamp(),
      ]);
    });

    it('Emergency admin change should emit expected event', async function () {
      receipt = await waitForTx(rejig.connect(governance).setEmergencyAdmin(userAddress));
      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'EmergencyAdminSet', [
        governanceAddress,
        ZERO_ADDRESS,
        userAddress,
        await getTimestamp(),
      ]);
    });

    it('Protocol state change by governance should emit expected event', async function () {
      receipt = await waitForTx(rejig.connect(governance).setState(ProtocolState.Paused));

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'StateSet', [
        governanceAddress,
        ProtocolState.Unpaused,
        ProtocolState.Paused,
        await getTimestamp(),
      ]);

      receipt = await waitForTx(
        rejig.connect(governance).setState(ProtocolState.PublishingPaused)
      );

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'StateSet', [
        governanceAddress,
        ProtocolState.Paused,
        ProtocolState.PublishingPaused,
        await getTimestamp(),
      ]);

      receipt = await waitForTx(rejig.connect(governance).setState(ProtocolState.Unpaused));

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'StateSet', [
        governanceAddress,
        ProtocolState.PublishingPaused,
        ProtocolState.Unpaused,
        await getTimestamp(),
      ]);
    });

    it('Protocol state change by emergency admin should emit expected events', async function () {
      await waitForTx(rejig.connect(governance).setEmergencyAdmin(userAddress));

      receipt = await waitForTx(rejig.connect(user).setState(ProtocolState.PublishingPaused));

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'StateSet', [
        userAddress,
        ProtocolState.Unpaused,
        ProtocolState.PublishingPaused,
        await getTimestamp(),
      ]);

      receipt = await waitForTx(rejig.connect(user).setState(ProtocolState.Paused));

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'StateSet', [
        userAddress,
        ProtocolState.PublishingPaused,
        ProtocolState.Paused,
        await getTimestamp(),
      ]);
    });
  });

  context('Hub Interaction', function () {
    async function createProfile() {
      await waitForTx(
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
      );
    }

    it('Profile creation should emit the correct events', async function () {
      receipt = await waitForTx(
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
      );

      expect(receipt.logs.length).to.eq(2);
      matchEvent(receipt, 'Transfer', [ZERO_ADDRESS, userAddress, FIRST_PROFILE_ID], rejigImpl);
      matchEvent(receipt, 'ProfileCreated', [
        FIRST_PROFILE_ID,
        userAddress,
        userAddress,
        MOCK_PROFILE_HANDLE,
        MOCK_PROFILE_URI,
        ZERO_ADDRESS,
        [],
        MOCK_FOLLOW_NFT_URI,
        await getTimestamp(),
      ]);
    });

    it('Setting follow module should emit correct events', async function () {
      await createProfile();

      receipt = await waitForTx(
        rejig.setFollowModule(FIRST_PROFILE_ID, approvalFollowModule.address, [])
      );

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'FollowModuleSet', [
        FIRST_PROFILE_ID,
        approvalFollowModule.address,
        [],
        await getTimestamp(),
      ]);
    });

    it('Setting dispatcher should emit correct events', async function () {
      await createProfile();

      receipt = await waitForTx(rejig.setDispatcher(FIRST_PROFILE_ID, userAddress));

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'DispatcherSet', [FIRST_PROFILE_ID, userAddress, await getTimestamp()]);
    });

    it('Posting should emit the correct events', async function () {
      await createProfile();

      receipt = await waitForTx(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      );

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'PostCreated', [
        FIRST_PROFILE_ID,
        1,
        MOCK_URI,
        ZERO_ADDRESS,
        [],
        await getTimestamp(),
      ]);
    });

    it('Commenting should emit the correct events', async function () {
      await createProfile();

      await waitForTx(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      );

      receipt = await waitForTx(
        rejig.comment({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 1,
          referenceModuleData: [],
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      );

      expect(receipt.logs.length).to.eq(1);

      matchEvent(receipt, 'CommentCreated', [
        FIRST_PROFILE_ID,
        2,
        MOCK_URI,
        FIRST_PROFILE_ID,
        1,
        [],
        ZERO_ADDRESS,
        [],
        await getTimestamp(),
      ]);
    });

    it('Mirroring should emit the correct events', async function () {
      await createProfile();

      await waitForTx(
        rejig.post({
          profileId: FIRST_PROFILE_ID,
          contentURI: MOCK_URI,
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      );

      receipt = await waitForTx(
        rejig.mirror({
          profileId: FIRST_PROFILE_ID,
          profileIdPointed: FIRST_PROFILE_ID,
          pubIdPointed: 1,
          referenceModuleData: [],
          referenceModule: ZERO_ADDRESS,
          referenceModuleInitData: [],
        })
      );

      expect(receipt.logs.length).to.eq(1);

      matchEvent(receipt, 'MirrorCreated', [
        FIRST_PROFILE_ID,
        2,
        FIRST_PROFILE_ID,
        1,
        [],
        ZERO_ADDRESS,
        [],
        await getTimestamp(),
      ]);
    });

    it('Following should emit correct events', async function () {
      await createProfile();

      const mockData = abiCoder.encode(['uint256'], [123]);
      receipt = await waitForTx(rejig.connect(userTwo).follow([FIRST_PROFILE_ID], [mockData]));
      const followNFT = await rejig.getFollowNFT(FIRST_PROFILE_ID);

      const expectedName = MOCK_PROFILE_HANDLE + '-Follower';
      const expectedSymbol = getAbbreviation(MOCK_PROFILE_HANDLE) + '-Fl';

      expect(receipt.logs.length).to.eq(5);
      matchEvent(receipt, 'FollowNFTDeployed', [FIRST_PROFILE_ID, followNFT, await getTimestamp()]);
      matchEvent(receipt, 'Followed', [
        userTwoAddress,
        [FIRST_PROFILE_ID],
        [mockData],
        await getTimestamp(),
      ]);
      matchEvent(receipt, 'Transfer', [ZERO_ADDRESS, userTwoAddress, 1], rejigImpl);
      matchEvent(receipt, 'FollowNFTTransferred', [
        FIRST_PROFILE_ID,
        1,
        ZERO_ADDRESS,
        userTwoAddress,
        await getTimestamp(),
      ]);
    });
  });

  context('Module Globals Governance', function () {
    it('Governance change should emit expected event', async function () {
      receipt = await waitForTx(moduleGlobals.connect(governance).setGovernance(userAddress));

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'ModuleGlobalsGovernanceSet', [
        governanceAddress,
        userAddress,
        await getTimestamp(),
      ]);
    });

    it('Treasury change should emit expected event', async function () {
      receipt = await waitForTx(moduleGlobals.connect(governance).setTreasury(userAddress));

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'ModuleGlobalsTreasurySet', [
        treasuryAddress,
        userAddress,
        await getTimestamp(),
      ]);
    });

    it('Treasury fee change should emit expected event', async function () {
      receipt = await waitForTx(moduleGlobals.connect(governance).setTreasuryFee(123));

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'ModuleGlobalsTreasuryFeeSet', [
        TREASURY_FEE_BPS,
        123,
        await getTimestamp(),
      ]);
    });

    it('Currency whitelisting should emit expected event', async function () {
      receipt = await waitForTx(
        moduleGlobals.connect(governance).whitelistCurrency(userAddress, true)
      );

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'ModuleGlobalsCurrencyWhitelisted', [
        userAddress,
        false,
        true,
        await getTimestamp(),
      ]);

      receipt = await waitForTx(
        moduleGlobals.connect(governance).whitelistCurrency(userAddress, false)
      );

      expect(receipt.logs.length).to.eq(1);
      matchEvent(receipt, 'ModuleGlobalsCurrencyWhitelisted', [
        userAddress,
        true,
        false,
        await getTimestamp(),
      ]);
    });
  });
});

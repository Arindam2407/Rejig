import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import {
  ProtocolState,
} from '../../helpers/utils';
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
  userTwoAddress,
  abiCoder,
} from '../../__setup.spec';

makeSuiteCleanRoom('Multi-State Hub', function () {
  context('Common', function () {
    context('Negatives', function () {
      it('User should fail to set the state on the hub', async function () {
        await expect(rejig.setState(ProtocolState.Paused)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE_OR_EMERGENCY_ADMIN
        );
        await expect(rejig.setState(ProtocolState.Unpaused)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE_OR_EMERGENCY_ADMIN
        );
        await expect(rejig.setState(ProtocolState.PublishingPaused)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE_OR_EMERGENCY_ADMIN
        );
      });

      it('User should fail to set the emergency admin', async function () {
        await expect(rejig.setEmergencyAdmin(userAddress)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE
        );
      });

      it('Governance should set user as emergency admin, user should fail to set protocol state to Unpaused', async function () {
        await expect(rejig.connect(governance).setEmergencyAdmin(userAddress)).to.not.be.reverted;
        await expect(rejig.setState(ProtocolState.Unpaused)).to.be.revertedWith(
          ERRORS.EMERGENCY_ADMIN_CANNOT_UNPAUSE
        );
      });

      it('Governance should set user as emergency admin, user should fail to set protocol state to PublishingPaused or Paused from Paused', async function () {
        await expect(rejig.connect(governance).setEmergencyAdmin(userAddress)).to.not.be.reverted;
        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;
        await expect(rejig.setState(ProtocolState.PublishingPaused)).to.be.revertedWith(
          ERRORS.PAUSED
        );
        await expect(rejig.setState(ProtocolState.Paused)).to.be.revertedWith(ERRORS.PAUSED);
      });
    });

    context('Scenarios', function () {
      it('Governance should set user as emergency admin, user sets protocol state but fails to set emergency admin, governance sets emergency admin to the zero address, user fails to set protocol state', async function () {
        await expect(rejig.connect(governance).setEmergencyAdmin(userAddress)).to.not.be.reverted;

        await expect(rejig.setState(ProtocolState.PublishingPaused)).to.not.be.reverted;
        await expect(rejig.setState(ProtocolState.Paused)).to.not.be.reverted;
        await expect(rejig.setEmergencyAdmin(ZERO_ADDRESS)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE
        );

        await expect(
          rejig.connect(governance).setEmergencyAdmin(ZERO_ADDRESS)
        ).to.not.be.reverted;

        await expect(rejig.setState(ProtocolState.Paused)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE_OR_EMERGENCY_ADMIN
        );
        await expect(rejig.setState(ProtocolState.PublishingPaused)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE_OR_EMERGENCY_ADMIN
        );
        await expect(rejig.setState(ProtocolState.Unpaused)).to.be.revertedWith(
          ERRORS.NOT_GOVERNANCE_OR_EMERGENCY_ADMIN
        );
      });

      it('Governance should set the protocol state, fetched protocol state should be accurate', async function () {
        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;
        expect(await rejig.getState()).to.eq(ProtocolState.Paused);

        await expect(
          rejig.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;
        expect(await rejig.getState()).to.eq(ProtocolState.PublishingPaused);

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;
        expect(await rejig.getState()).to.eq(ProtocolState.Unpaused);
      });

      it('Governance should set user as emergency admin, user should set protocol state to PublishingPaused, then Paused, then fail to set it to PublishingPaused', async function () {
        await expect(rejig.connect(governance).setEmergencyAdmin(userAddress)).to.not.be.reverted;

        await expect(rejig.setState(ProtocolState.PublishingPaused)).to.not.be.reverted;
        await expect(rejig.setState(ProtocolState.Paused)).to.not.be.reverted;
        await expect(rejig.setState(ProtocolState.PublishingPaused)).to.be.revertedWith(
          ERRORS.PAUSED
        );
      });

      it('Governance should set user as emergency admin, user should set protocol state to PublishingPaused, then set it to PublishingPaused again without reverting', async function () {
        await expect(rejig.connect(governance).setEmergencyAdmin(userAddress)).to.not.be.reverted;

        await expect(rejig.setState(ProtocolState.PublishingPaused)).to.not.be.reverted;
        await expect(rejig.setState(ProtocolState.PublishingPaused)).to.not.be.reverted;
      });
    });
  });

  context('Paused State', function () {
    context('Scenarios', async function () {
      it('User should create a profile, governance should pause the hub, transferring the profile should fail', async function () {
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

        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(
          rejig.transferFrom(userAddress, userTwoAddress, FIRST_PROFILE_ID)
        ).to.be.revertedWith(ERRORS.PAUSED);
      });

      it('Governance should pause the hub, profile creation should fail, then governance unpauses the hub and profile creation should work', async function () {
        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(
          rejig.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
          })
        ).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

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

      it('Governance should pause the hub, setting follow module should fail, then governance unpauses the hub and setting follow module should work', async function () {
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

        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, ZERO_ADDRESS, [])
        ).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, ZERO_ADDRESS, [])
        ).to.not.be.reverted;
      });

      it('Governance should pause the hub, setting dispatcher should fail, then governance unpauses the hub and setting dispatcher should work', async function () {
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

        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(rejig.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.be.revertedWith(
          ERRORS.PAUSED
        );

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(rejig.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.not.be.reverted;
      });

      it('Governance should pause the hub, setting profile URI should fail, then governance unpauses the hub and setting profile URI should work', async function () {
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

        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(rejig.setProfileImageURI(FIRST_PROFILE_ID, MOCK_URI)).to.be.revertedWith(
          ERRORS.PAUSED
        );

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(rejig.setProfileImageURI(FIRST_PROFILE_ID, MOCK_URI)).to.not.be.reverted;
      });

      it('Governance should pause the hub, setting follow NFT URI should fail, then governance unpauses the hub and setting follow NFT URI should work', async function () {
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

        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(rejig.setFollowNFTURI(FIRST_PROFILE_ID, MOCK_URI)).to.be.revertedWith(
          ERRORS.PAUSED
        );

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(rejig.setFollowNFTURI(FIRST_PROFILE_ID, MOCK_URI)).to.not.be.reverted;
      });

      it('Governance should pause the hub, posting should fail, then governance unpauses the hub and posting should work', async function () {
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

        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(
          rejig.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
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

      it('Governance should pause the hub, commenting should fail, then governance unpauses the hub and commenting should work', async function () {
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

        await expect(
          rejig.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

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
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
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
      });

      it('Governance should pause the hub, mirroring should fail, then governance unpauses the hub and mirroring should work', async function () {
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

        await expect(
          rejig.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(
          rejig.mirror({
            profileId: FIRST_PROFILE_ID,
            profileIdPointed: FIRST_PROFILE_ID,
            pubIdPointed: 1,
            referenceModuleData: [],
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
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

      });

      it('Governance should pause the hub, burning should fail, then governance unpauses the hub and burning should work', async function () {
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

        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(rejig.burn(FIRST_PROFILE_ID)).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(rejig.burn(FIRST_PROFILE_ID)).to.not.be.reverted;
      });

      it('Governance should pause the hub, following should fail, then governance unpauses the hub and following should work', async function () {
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

        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.be.revertedWith(ERRORS.PAUSED);

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;

        await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
      });

      it('Governance should pause the hub and then governance unpauses the hub', async function () {
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

        await expect(
          rejig.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

        await expect(rejig.connect(governance).setState(ProtocolState.Paused)).to.not.be.reverted;

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
        ).to.not.be.reverted;
      });
    });
  });

  context('PublishingPaused State', function () {
    context('Scenarios', async function () {
      it('Governance should pause publishing, profile creation should work', async function () {
        await expect(
          rejig.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

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

      it('Governance should pause publishing, setting follow module should work', async function () {
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

        await expect(
          rejig.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(
          rejig.setFollowModule(FIRST_PROFILE_ID, ZERO_ADDRESS, [])
        ).to.not.be.reverted;
      });

      it('Governance should pause publishing, setting dispatcher should work', async function () {
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

        await expect(
          rejig.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(rejig.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.not.be.reverted;
      });

      it('Governance should pause publishing, setting profile URI should work', async function () {
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

        await expect(
          rejig.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(rejig.setProfileImageURI(FIRST_PROFILE_ID, MOCK_URI)).to.not.be.reverted;
      });

      it('Governance should pause publishing, posting should fail, then governance unpauses the hub and posting should work', async function () {
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

        await expect(
          rejig.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(
          rejig.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
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

      it('Governance should pause publishing, commenting should fail, then governance unpauses the hub and commenting should work', async function () {
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

        await expect(
          rejig.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(
          rejig.connect(governance).setState(ProtocolState.PublishingPaused)
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
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
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
      });

      it('Governance should pause publishing, mirroring should fail, then governance unpauses the hub and mirroring should work', async function () {
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

        await expect(
          rejig.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })
        ).to.not.be.reverted;

        await expect(
          rejig.connect(governance).setState(ProtocolState.PublishingPaused)
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
        ).to.be.revertedWith(ERRORS.PUBLISHING_PAUSED);

        await expect(
          rejig.connect(governance).setState(ProtocolState.Unpaused)
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
      });

      it('Governance should pause publishing, burning should work', async function () {
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

        await expect(
          rejig.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(rejig.burn(FIRST_PROFILE_ID)).to.not.be.reverted;
      });

      it('Governance should pause publishing, following should work', async function () {
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

        await expect(
          rejig.connect(governance).setState(ProtocolState.PublishingPaused)
        ).to.not.be.reverted;

        await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
      });
    });
  });
});

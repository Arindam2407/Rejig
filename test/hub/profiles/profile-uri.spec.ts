import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { FollowNFT__factory } from '../../../typechain-types';
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import {
  getDecodedSvgImage,
  getMetadataFromBase64TokenUri,
  loadTestResourceAsUtf8String,
} from '../../helpers/utils';
import {
  FIRST_PROFILE_ID,
  rejig,
  makeSuiteCleanRoom,
  MAX_PROFILE_IMAGE_URI_LENGTH,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  OTHER_MOCK_URI,
  testWallet,
  user,
  userAddress,
  userTwo,
  userTwoAddress,
  MOCK_TRANSACTION_NFT_URI
} from '../../__setup.spec';

makeSuiteCleanRoom('Profile URI Functionality', function () {
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
      it('UserTwo should fail to set the profile URI on profile owned by user 1', async function () {
        await expect(
          rejig.connect(userTwo).setProfileImageURI(FIRST_PROFILE_ID, MOCK_URI)
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER_OR_DISPATCHER);
      });

      it('UserTwo should fail to set the profile URI on profile owned by user 1', async function () {
        const profileURITooLong = MOCK_URI.repeat(500);
        expect(profileURITooLong.length).to.be.greaterThan(MAX_PROFILE_IMAGE_URI_LENGTH);
        await expect(
          rejig.setProfileImageURI(FIRST_PROFILE_ID, profileURITooLong)
        ).to.be.revertedWith(ERRORS.INVALID_IMAGE_URI_LENGTH);
      });

      it('UserTwo should fail to change the follow NFT URI for profile one', async function () {
        await expect(
          rejig.connect(userTwo).setFollowNFTURI(FIRST_PROFILE_ID, OTHER_MOCK_URI)
        ).to.be.revertedWith(ERRORS.NOT_PROFILE_OWNER_OR_DISPATCHER);
      });
    });

    context('Scenarios', function () {
      it('User should have a custom picture tokenURI after setting the profile imageURI', async function () {
        await expect(rejig.setProfileImageURI(FIRST_PROFILE_ID, MOCK_URI)).to.not.be.reverted;
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
        const expectedSvg = loadTestResourceAsUtf8String('profile-token-uri-images/mock.svg');
        expect(actualSvg).to.eq(expectedSvg);
      });

      it('Default image should be used when no imageURI set', async function () {
        await expect(rejig.setProfileImageURI(FIRST_PROFILE_ID, '')).to.not.be.reverted;
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
        const expectedSvg = loadTestResourceAsUtf8String('profile-token-uri-images/default.svg');
        expect(actualSvg).to.eq(expectedSvg);
      });

      it('Default image should be used when imageURI contains double-quotes', async function () {
        const imageUri =
          'https://ipfs.io/ipfs/QmbWqxBEKC3P8tqsKc98xmWNzrztRLMiMPL8wBuTGsMnR" <rect x="10" y="10" fill="red';
        await expect(rejig.setProfileImageURI(FIRST_PROFILE_ID, imageUri)).to.not.be.reverted;
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
        const expectedSvg = loadTestResourceAsUtf8String('profile-token-uri-images/default.svg');
        expect(actualSvg).to.eq(expectedSvg);
      });

      it('Should return the correct tokenURI after transfer', async function () {
        const tokenUriBeforeTransfer = await rejig.tokenURI(FIRST_PROFILE_ID);
        const metadataBeforeTransfer = await getMetadataFromBase64TokenUri(tokenUriBeforeTransfer);
        expect(metadataBeforeTransfer.name).to.eq(`@${MOCK_PROFILE_HANDLE}`);
        expect(metadataBeforeTransfer.description).to.eq(`@${MOCK_PROFILE_HANDLE} - Rejig profile`);
        const expectedAttributesBeforeTransfer = [
          { trait_type: 'id', value: `#${FIRST_PROFILE_ID.toString()}` },
          { trait_type: 'followers', value: '0' },
          { trait_type: 'owner', value: userAddress.toLowerCase() },
          { trait_type: 'handle', value: `@${MOCK_PROFILE_HANDLE}` },
        ];
        expect(metadataBeforeTransfer.attributes).to.eql(expectedAttributesBeforeTransfer);
        const svgBeforeTransfer = await getDecodedSvgImage(metadataBeforeTransfer);
        const expectedSvg = loadTestResourceAsUtf8String(
          'profile-token-uri-images/mock-profile.svg'
        );
        expect(svgBeforeTransfer).to.eq(expectedSvg);

        await expect(
          rejig.transferFrom(userAddress, userTwoAddress, FIRST_PROFILE_ID)
        ).to.not.be.reverted;

        const tokenUriAfterTransfer = await rejig.tokenURI(FIRST_PROFILE_ID);
        const metadataAfterTransfer = await getMetadataFromBase64TokenUri(tokenUriAfterTransfer);
        expect(metadataAfterTransfer.name).to.eq(`@${MOCK_PROFILE_HANDLE}`);
        expect(metadataAfterTransfer.description).to.eq(`@${MOCK_PROFILE_HANDLE} - Rejig profile`);
        const expectedAttributesAfterTransfer = [
          { trait_type: 'id', value: `#${FIRST_PROFILE_ID.toString()}` },
          { trait_type: 'followers', value: '0' },
          { trait_type: 'owner', value: userTwoAddress.toLowerCase() },
          { trait_type: 'handle', value: `@${MOCK_PROFILE_HANDLE}` },
        ];
        expect(metadataAfterTransfer.attributes).to.eql(expectedAttributesAfterTransfer);
        const svgAfterTransfer = await getDecodedSvgImage(metadataAfterTransfer);
        expect(svgAfterTransfer).to.eq(expectedSvg);
      });

      it('Should return the correct tokenURI after a follow', async function () {
        const tokenUriBeforeFollow = await rejig.tokenURI(FIRST_PROFILE_ID);
        const metadataBeforeFollow = await getMetadataFromBase64TokenUri(tokenUriBeforeFollow);
        expect(metadataBeforeFollow.name).to.eq(`@${MOCK_PROFILE_HANDLE}`);
        expect(metadataBeforeFollow.description).to.eq(`@${MOCK_PROFILE_HANDLE} - Rejig profile`);
        const expectedAttributesBeforeFollow = [
          { trait_type: 'id', value: `#${FIRST_PROFILE_ID.toString()}` },
          { trait_type: 'followers', value: '0' },
          { trait_type: 'owner', value: userAddress.toLowerCase() },
          { trait_type: 'handle', value: `@${MOCK_PROFILE_HANDLE}` },
        ];
        expect(metadataBeforeFollow.attributes).to.eql(expectedAttributesBeforeFollow);
        const svgBeforeFollow = await getDecodedSvgImage(metadataBeforeFollow);
        const expectedSvg = loadTestResourceAsUtf8String(
          'profile-token-uri-images/mock-profile.svg'
        );
        expect(svgBeforeFollow).to.eq(expectedSvg);

        await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;

        const tokenUriAfterFollow = await rejig.tokenURI(FIRST_PROFILE_ID);
        const metadataAfterFollow = await getMetadataFromBase64TokenUri(tokenUriAfterFollow);
        expect(metadataAfterFollow.name).to.eq(`@${MOCK_PROFILE_HANDLE}`);
        expect(metadataAfterFollow.description).to.eq(`@${MOCK_PROFILE_HANDLE} - Rejig profile`);
        const expectedAttributesAfterFollow = [
          { trait_type: 'id', value: `#${FIRST_PROFILE_ID.toString()}` },
          { trait_type: 'followers', value: '1' },
          { trait_type: 'owner', value: userAddress.toLowerCase() },
          { trait_type: 'handle', value: `@${MOCK_PROFILE_HANDLE}` },
        ];
        expect(metadataAfterFollow.attributes).to.eql(expectedAttributesAfterFollow);
        const svgAfterFollow = await getDecodedSvgImage(metadataAfterFollow);
        expect(svgAfterFollow).to.eq(expectedSvg);
      });

      it('User should set user two as a dispatcher on their profile, user two should set the profile URI', async function () {
        await expect(rejig.setDispatcher(FIRST_PROFILE_ID, userTwoAddress)).to.not.be.reverted;
        await expect(
          rejig.connect(userTwo).setProfileImageURI(FIRST_PROFILE_ID, MOCK_URI)
        ).to.not.be.reverted;
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
        const expectedSvg = loadTestResourceAsUtf8String('profile-token-uri-images/mock.svg');
        expect(actualSvg).to.eq(expectedSvg);
      });

      it('User should follow profile 1, user should change the follow NFT URI, URI is accurate before and after the change', async function () {
        await expect(rejig.follow([FIRST_PROFILE_ID], [[]])).to.not.be.reverted;
        const followNFTAddress = await rejig.getFollowNFT(FIRST_PROFILE_ID);
        const followNFT = FollowNFT__factory.connect(followNFTAddress, user);

        const uriBefore = await followNFT.tokenURI(1);
        expect(uriBefore).to.eq(MOCK_FOLLOW_NFT_URI);

        await expect(rejig.setFollowNFTURI(FIRST_PROFILE_ID, OTHER_MOCK_URI)).to.not.be.reverted;

        const uriAfter = await followNFT.tokenURI(1);
        expect(uriAfter).to.eq(OTHER_MOCK_URI);
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
          transactionModule: ZERO_ADDRESS,
          transactionNFTURI: MOCK_TRANSACTION_NFT_URI
        })
      ).to.not.be.reverted;
    });
  });
});

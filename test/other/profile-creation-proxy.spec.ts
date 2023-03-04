import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../helpers/constants';
import { ERRORS } from '../helpers/errors';
import { ProfileCreationProxy, ProfileCreationProxy__factory } from '../../typechain-types';
import {
  deployer,
  FIRST_PROFILE_ID,
  governance,
  rejig,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_TRANSACTION_NFT_URI,
  MOCK_PROFILE_URI,
  user,
  userAddress,
  deployerAddress,
} from '../__setup.spec';
import { BigNumber } from 'ethers';
import { TokenDataStructOutput } from '../../typechain-types/rejig';
import { getTimestamp } from '../helpers/utils';

makeSuiteCleanRoom('Profile Creation Proxy', function () {
  const REQUIRED_SUFFIX = '.rejig';
  const MINIMUM_LENGTH = 5;

  let profileCreationProxy: ProfileCreationProxy;
  beforeEach(async function () {
    profileCreationProxy = await new ProfileCreationProxy__factory(deployer).deploy(
      deployerAddress,
      rejig.address
    );
  });

  context('Negatives', function () {
    it('Should fail to create profile if handle length before suffix does not reach minimum length', async function () {
      const handle = 'a'.repeat(MINIMUM_LENGTH - 1);
      await expect(
        profileCreationProxy.proxyCreateProfile({
          to: userAddress,
          handle: handle,
          imageURI: MOCK_PROFILE_URI,
          followModule: ZERO_ADDRESS,
          followModuleInitData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
          transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
        })
      ).to.be.revertedWith(ERRORS.INVALID_HANDLE_LENGTH);
    });

    it('Should fail to create profile if handle contains an invalid character before the suffix', async function () {
      await expect(
        profileCreationProxy.proxyCreateProfile({
          to: userAddress,
          handle: 'dots.are.invalid',
          imageURI: MOCK_PROFILE_URI,
          followModule: ZERO_ADDRESS,
          followModuleInitData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
          transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
        })
      ).to.be.revertedWith(ERRORS.HANDLE_CONTAINS_INVALID_CHARACTERS);
    });

    it('Should fail to create profile if handle starts with a dash, underscore or period', async function () {
      await expect(
        profileCreationProxy.proxyCreateProfile({
          to: userAddress,
          handle: '.abcdef',
          imageURI: MOCK_PROFILE_URI,
          followModule: ZERO_ADDRESS,
          followModuleInitData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
          transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
        })
      ).to.be.revertedWith(ERRORS.HANDLE_FIRST_CHARACTER_INVALID);

      await expect(
        profileCreationProxy.proxyCreateProfile({
          to: userAddress,
          handle: '-abcdef',
          imageURI: MOCK_PROFILE_URI,
          followModule: ZERO_ADDRESS,
          followModuleInitData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
          transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
        })
      ).to.be.revertedWith(ERRORS.HANDLE_FIRST_CHARACTER_INVALID);

      await expect(
        profileCreationProxy.proxyCreateProfile({
          to: userAddress,
          handle: '_abcdef',
          imageURI: MOCK_PROFILE_URI,
          followModule: ZERO_ADDRESS,
          followModuleInitData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI,
          transactionModule: ZERO_ADDRESS,
            transactionNFTURI: MOCK_TRANSACTION_NFT_URI
        })
      ).to.be.revertedWith(ERRORS.HANDLE_FIRST_CHARACTER_INVALID);
    });
  });
});

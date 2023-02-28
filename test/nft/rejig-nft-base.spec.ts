import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils';
import { MAX_UINT256, ZERO_ADDRESS } from '../helpers/constants';
import { ERRORS } from '../helpers/errors';
import { utils } from 'ethers';
import {
  getChainId,
} from '../helpers/utils';
import {
  abiCoder,
  FIRST_PROFILE_ID,
  rejig,
  REJIG_NFT_NAME,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  testWallet,
  user,
  userAddress,
} from '../__setup.spec';

makeSuiteCleanRoom('Rejig NFT Base Functionality', function () {
  context('generic', function () {
    it('Domain separator fetched from contract should be accurate', async function () {
      const expectedDomainSeparator = keccak256(
        abiCoder.encode(
          ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
          [
            keccak256(
              toUtf8Bytes(
                'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
              )
            ),
            keccak256(utils.toUtf8Bytes(REJIG_NFT_NAME)),
            keccak256(utils.toUtf8Bytes('1')),
            getChainId(),
            rejig.address,
          ]
        )
      );

      expect(await rejig.getDomainSeparator()).to.eq(expectedDomainSeparator);
    });
  });

  context('meta-tx', function () {
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

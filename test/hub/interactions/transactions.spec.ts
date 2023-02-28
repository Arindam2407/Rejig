import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { ethers, network } from 'hardhat';
import {
  postReturningTokenId,
} from '../../helpers/utils';
import {
  FIRST_PROFILE_ID,
  accounts,
  governance,
  rejig,
  makeSuiteCleanRoom,
  mockModuleData,
  mockReferenceModule,
  MOCK_FOLLOW_NFT_URI,
  MOCK_FOLLOW_NFT_URI_2,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_HANDLE_2,
  MOCK_PROFILE_URI,
  MOCK_URI,
  testWallet,
  userAddress,
  user,
  userTwo,
  userThree,
  userFour,
  userFive,
  userSix,
  userSeven,
  userEight,
  userNine,
  userTen,
  userEleven,
  userTwelve,
  userThirteen,
  userFourteen,
  userFifteen,
  abiCoder,
  userTwoAddress,
} from '../../__setup.spec';

let ac;

makeSuiteCleanRoom('Transactions', function () {
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
        })
      ).to.not.be.reverted;
      await expect(
        rejig.connect(userTwo).createProfile({
          to: userTwoAddress,
          handle: MOCK_PROFILE_HANDLE_2,
          imageURI: MOCK_PROFILE_URI,
          followModule: ZERO_ADDRESS,
          followModuleInitData: [],
          followNFTURI: MOCK_FOLLOW_NFT_URI_2,
        })
      ).to.not.be.reverted;
    });
    context('Buy NFT Scenarios', function () {
        it('Approved users should be able to buy NFTs', async function () {
          const list = [userTwo,userThree,userFour,userFive,userSix,userSeven,userEight,userNine,userTen];
  
          for(let i = 1; i < list.length; i++){
            ac = rejig.connect(list[i]);
            await ac.follow([FIRST_PROFILE_ID, 2], [[],[]]);
          }
          
          await expect(rejig.postNFT({
            profileId: FIRST_PROFILE_ID,
              contentURI: MOCK_URI,
              referenceModule: ZERO_ADDRESS,
              referenceModuleInitData: [],
          }, ethers.utils.parseEther('0.05'), ethers.utils.parseEther('0.0000000001'),[])).to.not.be.reverted;

          await network.provider.send("evm_increaseTime", [2*60*60*24]);
          await network.provider.request({ method: "evm_mine", params: [] });

          await expect(rejig.connect(userTwo).buyNFT(userAddress,0,0, {value: ethers.utils.parseEther('0.01')})).to.not.be.reverted;
        });
    });
});
});
import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { ethers, network } from 'hardhat';
import {
  FIRST_PROFILE_ID,
  rejig,
  rejigERC20Address,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_FOLLOW_NFT_URI_2,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_HANDLE_2,
  MOCK_PROFILE_URI,
  MOCK_URI,
  userAddress,
  userTwo,
  userThree,
  userFour,
  userFive,
  userSix,
  userSeven,
  userEight,
  userNine,
  userTen,
  userTwoAddress,
  MOCK_TRANSACTION_NFT_URI,
  MOCK_TRANSACTION_NFT_URI_2,
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
          transactionModule: ZERO_ADDRESS,
          transactionNFTURI: MOCK_TRANSACTION_NFT_URI
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
          transactionModule: ZERO_ADDRESS,
          transactionNFTURI: MOCK_TRANSACTION_NFT_URI_2
        })
      ).to.not.be.reverted;
    });
    context('Buy NFT Scenarios', function () {
        beforeEach(async function () {
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
          }, ethers.utils.parseEther('0.05'), ethers.utils.parseEther('0.0000000001'),
          { token1: rejigERC20Address,
            noTokens1: 1000000,
            token2: ZERO_ADDRESS,
            noTokens2: 0,
            token3: ZERO_ADDRESS,
            noTokens3: 0
          })).to.not.be.reverted;

          await network.provider.send("evm_increaseTime", [2*60*60*24]);
          await network.provider.request({ method: "evm_mine", params: [] });
        });
        it('Approved users should not be able to buy NFTs without sending enough ETH', async function () {
          await expect(rejig.connect(userTwo).buyNFT(userAddress,0,2)).to.be.revertedWith(ERRORS.NOT_ENOUGH_ETH);
        });
        it('Approved users should be able to buy NFTs with sending enough ETH and payments should be settled', async function () {
          await expect(rejig.connect(userTwo).buyNFT(userAddress,0,2, {value: ethers.utils.parseEther('1')})).to.not.be.reverted;
        });
    });
});
});

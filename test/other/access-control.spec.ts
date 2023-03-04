import hre, { ethers } from 'hardhat';
import fs from 'fs';
import { expect } from 'chai';
import { utils } from 'ethers';
import {
  FollowNFT__factory,
  AccessControl__factory,
  AccessControlV2__factory,
  FeeFollowModule__factory,
  TransparentUpgradeableProxy__factory,
  Rejig__factory,
  MockProfileCreationProxy__factory,
  ModuleGlobals__factory,
} from '../../typechain-types';
import { MAX_UINT256, ZERO_ADDRESS } from '../helpers/constants';
import { ERRORS } from '../helpers/errors';
import { findEvent, getTimestamp, matchEvent, waitForTx } from '../helpers/utils';
import {
  deployer,
  FIRST_PROFILE_ID,
  governance as governanceImported,
  rejig as rejigImported,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  moduleGlobals as moduleGlobalsImported,
  user,
  userAddress,
  userTwo,
  userTwoAddress,
  userThreeAddress,
  abiCoder,
  feeFollowModule as feeFollowModuleImported,
  currency,
  MOCK_TRANSACTION_NFT_URI,
} from '../__setup.spec';
import { formatEther } from 'ethers/lib/utils';

const fork = process.env.FORK;

/**
 * @dev Some of these tests may be redundant, but are still present to ensure an isolated environment,
 * in particular if other test files are changed.
 */
makeSuiteCleanRoom('AccessControlV2', function () {
  let accessControl, accessControlImpl, accessControlV2Impl, accessControlProxy;
  let rejig, mockProfileCreationProxy, feeFollowModule, moduleGlobals;
  let profileId = FIRST_PROFILE_ID;
  let governance;

  before(async function () {
    if (fork) {
      console.log(
        'BALANCE:',
        formatEther(await ethers.provider.getBalance(await deployer.getAddress()))
      );
      await ethers.provider.send('hardhat_setBalance', [
        await deployer.getAddress(),
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      ]);
      const addresses = JSON.parse(fs.readFileSync('addresses.json', 'utf-8'));
      accessControl = AccessControlV2__factory.connect(addresses['accessControl proxy'], user);
      rejig = Rejig__factory.connect(addresses['rejig'], deployer);
      mockProfileCreationProxy = MockProfileCreationProxy__factory.connect(
        addresses['MockProfileCreationProxy'],
        deployer
      );
      feeFollowModule = FeeFollowModule__factory.connect(addresses['FeeFollowModule'], deployer);
      moduleGlobals = ModuleGlobals__factory.connect(addresses['ModuleGlobals'], deployer);
      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [await rejig.getGovernance()],
      });
      governance = await ethers.getSigner(await rejig.getGovernance());
    } else {
      rejig = rejigImported;
      feeFollowModule = feeFollowModuleImported;
      moduleGlobals = moduleGlobalsImported;
      governance = governanceImported;
      accessControlImpl = await new AccessControl__factory(deployer).deploy(rejig.address);

      const data = accessControlImpl.interface.encodeFunctionData('initialize', []);

      accessControlProxy = await new TransparentUpgradeableProxy__factory(deployer).deploy(
        accessControlImpl.address,
        await deployer.getAddress(),
        data
      );

      accessControlV2Impl = await new AccessControlV2__factory(deployer).deploy(rejig.address);

      await expect(accessControlProxy.upgradeToAndCall(accessControlV2Impl.address, data)).to.not.be
        .reverted;

      accessControl = AccessControlV2__factory.connect(accessControlProxy.address, user);
      await expect(accessControl.initialize()).to.be.revertedWith(ERRORS.INITIALIZED);
    }
  });

  beforeEach(async function () {
    const receipt = await waitForTx(
      fork
        ? mockProfileCreationProxy.proxyCreateProfile({
            to: userAddress,
            handle: 'mocktest' + (Math.random() * 100000000000000000).toFixed(0), //MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
            transactionModule: ZERO_ADDRESS,
            transactionNFTURI : MOCK_TRANSACTION_NFT_URI
          })
        : rejig.createProfile({
            to: userAddress,
            handle: MOCK_PROFILE_HANDLE,
            imageURI: MOCK_PROFILE_URI,
            followModule: ZERO_ADDRESS,
            followModuleInitData: [],
            followNFTURI: MOCK_FOLLOW_NFT_URI,
            transactionModule: ZERO_ADDRESS,
            transactionNFTURI : MOCK_TRANSACTION_NFT_URI
          })
    );

    expect(receipt.logs.length).to.eq(2, `Expected 2 events, got ${receipt.logs.length}`);

    if (fork) {
      const event = findEvent(receipt, 'ProfileCreated');
      profileId = event.args.profileId;
    } else {
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
    }
  });

  context('Has Access', function () {
    it('hasAccess should return true if user owns the profile', async function () {
      expect(await rejig.ownerOf(profileId)).to.be.eq(userAddress);
      expect(await accessControl.hasAccess(userAddress, profileId, [])).to.be.true;
    });

    it('hasAccess should return false if user does not own the profile', async function () {
      expect(await rejig.ownerOf(profileId)).to.not.be.eq(userTwoAddress);
      expect(await accessControl.hasAccess(userTwoAddress, profileId, [])).to.be.false;
    });
  });

  context('Is Following', function () {
    before(async function () {

      await moduleGlobals.connect(governance).whitelistCurrency(currency.address, true);

      expect(await moduleGlobals.isCurrencyWhitelisted(currency.address)).to.be.true;
    });

    it('isFollowing should return true if user follows the profile (without follow module, by holding a followNFT)', async function () {
      await rejig.connect(userTwo).follow([profileId], [[]]);
      const followNFTAddress = await rejig.getFollowNFT(profileId);
      const followNFT = FollowNFT__factory.connect(followNFTAddress, user);
      expect(await followNFT.balanceOf(userTwoAddress)).is.gt(0);

      expect(await accessControl.isFollowing(userTwoAddress, profileId, 0, [])).to.be.true;
    });

    it('isFollowing should return false if user does not follow the profile (without follow module, not holding a followNFT)', async function () {
      await rejig.connect(userTwo).follow([profileId], [[]]);
      const followNFTAddress = await rejig.getFollowNFT(profileId);
      const followNFT = FollowNFT__factory.connect(followNFTAddress, user);
      expect(await followNFT.balanceOf(userThreeAddress)).is.eq(0);
      expect(await accessControl.isFollowing(userThreeAddress, profileId, 0, [])).to.be.false;
    });

    it('isFollowing should return true if user follows the profile (with followModule, querying it)', async function () {
      const followModuleInitData = abiCoder.encode(
        ['uint256', 'address', 'address'],
        [1, currency.address, userAddress]
      );
      await rejig
        .connect(user)
        .setFollowModule(profileId, feeFollowModule.address, followModuleInitData);
      await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
      await expect(
        currency.connect(userTwo).approve(feeFollowModule.address, MAX_UINT256)
      ).to.not.be.reverted;
      const data = abiCoder.encode(['address', 'uint256'], [currency.address, 1]);
      await expect(rejig.connect(userTwo).follow([profileId], [data])).to.not.be.reverted;
      const followModuleAddress = await rejig.getFollowModule(profileId);
      const followModule = FeeFollowModule__factory.connect(followModuleAddress, user);
      expect(await followModule.isFollowing(profileId, userTwoAddress, 0)).to.be.true;
      expect(await accessControl.isFollowing(userTwoAddress, profileId, 0, [])).to.be.true;
    });

    it('isFollowing should return false if user doesnt follow the profile (with followModule, querying it)', async function () {
      const followModuleInitData = abiCoder.encode(
        ['uint256', 'address', 'address'],
        [1, currency.address, userAddress]
      );
      await rejig
        .connect(user)
        .setFollowModule(profileId, feeFollowModule.address, followModuleInitData);

      await expect(currency.mint(userTwoAddress, MAX_UINT256)).to.not.be.reverted;
      await expect(
        currency.connect(userTwo).approve(feeFollowModule.address, MAX_UINT256)
      ).to.not.be.reverted;
      const data = abiCoder.encode(['address', 'uint256'], [currency.address, 1]);
      await expect(rejig.connect(userTwo).follow([profileId], [data])).to.not.be.reverted;

      const followModuleAddress = await rejig.getFollowModule(profileId);
      const followModule = FeeFollowModule__factory.connect(followModuleAddress, user);
      expect(await followModule.isFollowing(profileId, userThreeAddress, 0)).to.be.false;
      expect(await accessControl.isFollowing(userThreeAddress, profileId, 0, [])).to.be.false;
    });

    it('isFollowing should return true if user is the owner of the profile', async function () {
      expect(await rejig.ownerOf(profileId)).to.be.eq(userAddress);
      expect(await accessControl.isFollowing(userAddress, profileId, 0, [])).to.be.true;
    });
  });
});

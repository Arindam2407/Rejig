import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import {
  FeeFollowModule__factory,
  FollowNFT__factory,
  Rejig__factory,
  ModuleGlobals__factory,
  TransparentUpgradeableProxy__factory,
} from '../../typechain-types';
import { ZERO_ADDRESS } from '../helpers/constants';
import { ERRORS } from '../helpers/errors';
import {
  BPS_MAX,
  deployer,
  deployerAddress,
  governanceAddress,
  hubLibs,
  rejig,
  rejigImpl,
  transactionNFTImplAddress,
  REJIG_NFT_NAME,
  REJIG_NFT_SYMBOL,
  makeSuiteCleanRoom,
  moduleGlobals,
  treasuryAddress,
  TREASURY_FEE_BPS,
  user,
  userAddress,
  vRFCoordinatorV2Mock,
  CALLBACK_GAS_LIMIT,
  GAS_LANE
} from '../__setup.spec';

makeSuiteCleanRoom('deployment validation', () => {
  it('Should fail to deploy a rejig implementation with zero address follow and transaction NFT impl', async function () {
    await expect(
      new Rejig__factory(hubLibs, deployer).deploy(vRFCoordinatorV2Mock.address, 0x01,GAS_LANE, CALLBACK_GAS_LIMIT,ZERO_ADDRESS,ZERO_ADDRESS)
    ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
  });

  it('Should fail to deploy a FollowNFT implementation with zero address hub', async function () {
    await expect(new FollowNFT__factory(deployer).deploy(ZERO_ADDRESS)).to.be.revertedWith(
      ERRORS.INIT_PARAMS_INVALID
    );
  });

  it('Deployer should not be able to initialize implementation due to address(this) check', async function () {
    await expect(
      rejigImpl.initialize(REJIG_NFT_NAME, REJIG_NFT_SYMBOL, governanceAddress)
    ).to.be.revertedWith(ERRORS.CANNOT_INIT_IMPL);
  });

  it("User should fail to initialize rejig proxy after it's already been initialized via the proxy constructor", async function () {
    // Initialization happens in __setup.spec.ts
    await expect(
      rejig.connect(user).initialize('name', 'symbol', userAddress)
    ).to.be.revertedWith(ERRORS.INITIALIZED);
  });

  it('Deployer should deploy a rejig implementation, a proxy, initialize it, and fail to initialize it again', async function () {
    const newImpl = await new Rejig__factory(hubLibs, deployer).deploy(vRFCoordinatorV2Mock.address, 0x01,GAS_LANE, CALLBACK_GAS_LIMIT,userAddress,transactionNFTImplAddress);

    let data = newImpl.interface.encodeFunctionData('initialize', [
      REJIG_NFT_NAME,
      REJIG_NFT_SYMBOL,
      governanceAddress,
    ]);

    const proxy = await new TransparentUpgradeableProxy__factory(deployer).deploy(
      newImpl.address,
      deployerAddress,
      data
    );

    await expect(
      Rejig__factory.connect(proxy.address, user).initialize('name', 'symbol', userAddress)
    ).to.be.revertedWith(ERRORS.INITIALIZED);
  });

  it('User should not be able to call admin-only functions on proxy (should fallback) since deployer is admin', async function () {
    const proxy = TransparentUpgradeableProxy__factory.connect(rejig.address, user);
    await expect(proxy.upgradeTo(userAddress)).to.be.revertedWith(ERRORS.NO_SELECTOR);
    await expect(proxy.upgradeToAndCall(userAddress, [])).to.be.revertedWith(ERRORS.NO_SELECTOR);
  });

  it('Deployer should be able to call admin-only functions on proxy', async function () {
    const proxy = TransparentUpgradeableProxy__factory.connect(rejig.address, deployer);
    const newImpl = await new Rejig__factory(hubLibs, deployer).deploy(vRFCoordinatorV2Mock.address, 0x01,GAS_LANE, CALLBACK_GAS_LIMIT,userAddress,transactionNFTImplAddress);
    await expect(proxy.upgradeTo(newImpl.address)).to.not.be.reverted;
  });

  it('Deployer should transfer admin to user, deployer should fail to call admin-only functions, user should call admin-only functions', async function () {
    const proxy = TransparentUpgradeableProxy__factory.connect(rejig.address, deployer);

    await expect(proxy.changeAdmin(userAddress)).to.not.be.reverted;

    await expect(proxy.upgradeTo(userAddress)).to.be.revertedWith(ERRORS.NO_SELECTOR);
    await expect(proxy.upgradeToAndCall(userAddress, [])).to.be.revertedWith(ERRORS.NO_SELECTOR);

    const newImpl = await new Rejig__factory(hubLibs, deployer).deploy(vRFCoordinatorV2Mock.address, 0x01,GAS_LANE, CALLBACK_GAS_LIMIT,userAddress,transactionNFTImplAddress);

    await expect(proxy.connect(user).upgradeTo(newImpl.address)).to.not.be.reverted;
  });

  it('Should fail to deploy a fee follow module with zero address hub', async function () {
    await expect(
      new FeeFollowModule__factory(deployer).deploy(ZERO_ADDRESS, moduleGlobals.address)
    ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
  });

  it('Should fail to deploy a fee follow module with zero address module globals', async function () {
    await expect(
      new FeeFollowModule__factory(deployer).deploy(rejig.address, ZERO_ADDRESS)
    ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
  });

  it('Should fail to deploy module globals with zero address governance', async function () {
    await expect(
      new ModuleGlobals__factory(deployer).deploy(ZERO_ADDRESS, treasuryAddress, TREASURY_FEE_BPS)
    ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
  });

  it('Should fail to deploy module globals with zero address treasury', async function () {
    await expect(
      new ModuleGlobals__factory(deployer).deploy(governanceAddress, ZERO_ADDRESS, TREASURY_FEE_BPS)
    ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
  });

  it('Should fail to deploy module globals with treausury fee > BPS_MAX / 2', async function () {
    await expect(
      new ModuleGlobals__factory(deployer).deploy(governanceAddress, treasuryAddress, 5001)
    ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
  });

  it('Should fail to deploy a fee module with treasury fee equal to or higher than maximum BPS', async function () {
    await expect(
      new ModuleGlobals__factory(deployer).deploy(ZERO_ADDRESS, treasuryAddress, BPS_MAX)
    ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);

    await expect(
      new ModuleGlobals__factory(deployer).deploy(ZERO_ADDRESS, treasuryAddress, BPS_MAX + 1)
    ).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
  });

  it('Validates rejig name & symbol', async function () {
    const name = REJIG_NFT_NAME;
    const symbol = await rejig.symbol();

    expect(name).to.eq(REJIG_NFT_NAME);
    expect(symbol).to.eq(REJIG_NFT_SYMBOL);
  });
});

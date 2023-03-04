import { AbiCoder } from '@ethersproject/contracts/node_modules/@ethersproject/abi';
import { parseEther } from '@ethersproject/units';
import '@nomiclabs/hardhat-ethers';
import { expect, use } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BytesLike, Signer, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import {
  ApprovalFollowModule,
  ApprovalFollowModule__factory,
  Currency,
  Currency__factory,
  Events,
  Events__factory,
  RejigERC20,
  RejigERC20__factory,
  FeeFollowModule,
  FeeFollowModule__factory,
  FollowerOnlyReferenceModule,
  FollowerOnlyReferenceModule__factory,
  FollowNFT__factory,
  TransactionNFT__factory,
  Helper,
  Helper__factory,
  InteractionLogic__factory,
  Rejig,
  Rejig__factory,
  MockFollowModule,
  MockFollowModule__factory,
  MockReferenceModule,
  MockReferenceModule__factory,
  ModuleGlobals,
  ModuleGlobals__factory,
  ProfileTokenURILogic__factory,
  PublishingLogic__factory,
  TransparentUpgradeableProxy__factory,
  RejigPeriphery,
  RejigPeriphery__factory,
  ProfileFollowModule,
  ProfileFollowModule__factory,
  FollowNFT,
  TransactionNFT,
  RevertFollowModule,
  RevertFollowModule__factory,
  PostNFTTokenURILogic__factory,
  VRFCoordinatorV2Mock,
  VRFCoordinatorV2Mock__factory
} from '../typechain-types';
import { RejigLibraryAddresses } from '../typechain-types/factories/Rejig__factory';
import { FAKE_PRIVATEKEY, ZERO_ADDRESS } from './helpers/constants';
import {
  computeContractAddress,
  ProtocolState,
  revertToSnapshot,
  takeSnapshot,
} from './helpers/utils';

use(solidity);

export const CURRENCY_MINT_AMOUNT = parseEther('100');
export const BASE_FEE = "250000000000000000"
export const GAS_PRICE_LINK = 1e9
export const GAS_LANE =  "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15";
export const CALLBACK_GAS_LIMIT = "500000"
export const BPS_MAX = 10000;
export const TREASURY_FEE_BPS = 50;
export const REFERRAL_FEE_BPS = 250;
export const MAX_PROFILE_IMAGE_URI_LENGTH = 6000;
export const REJIG_NFT_NAME = 'Rejig Protocol Profiles';
export const REJIG_NFT_SYMBOL = 'LPP';
export const MOCK_PROFILE_HANDLE = 'plant1ghost.eth';
export const MOCK_PROFILE_HANDLE_2 = '2plant1ghost.eth';
export const REJIG_PERIPHERY_NAME = 'RejigPeriphery';
export const FIRST_PROFILE_ID = 1;
export const MOCK_URI = 'https://ipfs.io/ipfs/QmbWqxBEKC3P8tqsKc98xmWNzrzDtRLMiMPL8wBuTGsMnR';
export const OTHER_MOCK_URI = 'https://ipfs.io/ipfs/QmSfyMcnh1wnJHrAWCBjZHapTS859oNSsuDFiAPPdAHgHP';
export const MOCK_PROFILE_URI =
  'https://ipfs.io/ipfs/Qme7ss3ARVgxv6rXqVPiikMJ8u2NLgmgszg13pYrDKEoiu';
export const MOCK_FOLLOW_NFT_URI =
  'https://ipfs.fleek.co/ipfs/ghostplantghostplantghostplantghostplantghostplantghostplan';
export const MOCK_FOLLOW_NFT_URI_2 =
  'https://ipfs.fleek.co/ipfs/2ghostplantghostplantghostplantghostplantghostplantghostplan';
export const MOCK_TRANSACTION_NFT_URI =
  'https://ipfs.fleek.co/ipfs/txghostplantghostplantghostplantghostplantghostplantghostplan';
export const MOCK_TRANSACTION_NFT_URI_2 =
  'https://ipfs.fleek.co/ipfs/tx2ghostplantghostplantghostplantghostplantghostplantghostplan';

export let accounts: Signer[];
export let deployer: Signer;
export let user: Signer;
export let userTwo: Signer;
export let userThree: Signer;
export let userFour: Signer;
export let userFive: Signer;
export let userSix: Signer;
export let userSeven: Signer;
export let userEight: Signer;
export let userNine: Signer;
export let userTen: Signer;
export let userEleven: Signer;
export let userTwelve: Signer;
export let userThirteen: Signer;
export let userFourteen: Signer;
export let userFifteen: Signer;
export let governance: Signer;
export let deployerAddress: string;
export let userAddress: string;
export let userTwoAddress: string;
export let userThreeAddress: string;
export let governanceAddress: string;
export let treasuryAddress: string;
export let testWallet: Wallet;
export let rejigImpl: Rejig;
export let rejig: Rejig;
export let rejigERC20: RejigERC20;
export let rejigERC20Address: string;
export let transactionNFTImplAddress: string;
export let currency: Currency;
export let abiCoder: AbiCoder;
export let mockModuleData: BytesLike;
export let hubLibs: RejigLibraryAddresses;
export let eventsLib: Events;
export let moduleGlobals: ModuleGlobals;
export let helper: Helper;
export let rejigPeriphery: RejigPeriphery;
export let followNFTImpl: FollowNFT;
export let transactionNFTImpl: TransactionNFT;
export let vRFCoordinatorV2Mock: VRFCoordinatorV2Mock;

/* Modules */

// Follow
export let approvalFollowModule: ApprovalFollowModule;
export let profileFollowModule: ProfileFollowModule;
export let feeFollowModule: FeeFollowModule;
export let revertFollowModule: RevertFollowModule;
export let mockFollowModule: MockFollowModule;

// Reference
export let followerOnlyReferenceModule: FollowerOnlyReferenceModule;
export let mockReferenceModule: MockReferenceModule;

export function makeSuiteCleanRoom(name: string, tests: () => void) {
  describe(name, () => {
    beforeEach(async function () {
      await takeSnapshot();
    });
    tests();
    afterEach(async function () {
      await revertToSnapshot();
    });
  });
}

before(async function () {
  abiCoder = ethers.utils.defaultAbiCoder;
  testWallet = new ethers.Wallet(FAKE_PRIVATEKEY).connect(ethers.provider);
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  user = accounts[1];
  userTwo = accounts[2];
  userThree = accounts[4];
  governance = accounts[3];
  userFour = accounts[5];
  userFive = accounts[6];
  userSix = accounts[7];
  userSeven = accounts[8];
  userEight = accounts[9];
  userNine = accounts[10];
  userTen = accounts[11];
  userEleven = accounts[12];
  userTwelve = accounts[13];
  userThirteen = accounts[14];
  userFourteen = accounts[15];
  userFifteen = accounts[16];

  deployerAddress = await deployer.getAddress();
  userAddress = await user.getAddress();
  userTwoAddress = await userTwo.getAddress();
  userThreeAddress = await userThree.getAddress();
  governanceAddress = await governance.getAddress();
  treasuryAddress = await accounts[4].getAddress();
  mockModuleData = abiCoder.encode(['uint256'], [1]);
  // Deployment
  helper = await new Helper__factory(deployer).deploy();
  moduleGlobals = await new ModuleGlobals__factory(deployer).deploy(
    governanceAddress,
    treasuryAddress,
    TREASURY_FEE_BPS
  );

  const publishingLogic = await new PublishingLogic__factory(deployer).deploy();
  const interactionLogic = await new InteractionLogic__factory(deployer).deploy();
  const profileTokenURILogic = await new ProfileTokenURILogic__factory(deployer).deploy();
  const postNFTTokenURILogic = await new PostNFTTokenURILogic__factory(deployer).deploy();

  hubLibs = {
    'contracts/libraries/PublishingLogic.sol:PublishingLogic': publishingLogic.address,
    'contracts/libraries/InteractionLogic.sol:InteractionLogic': interactionLogic.address,
    'contracts/libraries/ProfileTokenURILogic.sol:ProfileTokenURILogic':
      profileTokenURILogic.address,
    'contracts/libraries/PostNFTTokenURILogic.sol:PostNFTTokenURILogic':
      postNFTTokenURILogic.address,
  };

  vRFCoordinatorV2Mock = await new VRFCoordinatorV2Mock__factory(deployer).deploy(BASE_FEE, GAS_PRICE_LINK);

  // Here, we pre-compute the nonces and addresses used to deploy the contracts.
  const nonce = await deployer.getTransactionCount();
  // nonce + 0 is follow NFT impl
  // nonce + 1 is impl
  // nonce + 2 is tx impl
  // nonce + 3 is hub proxy

  const hubProxyAddress = computeContractAddress(deployerAddress, nonce + 3); //'0x' + keccak256(RLP.encode([deployerAddress, hubProxyNonce])).substr(26);

  followNFTImpl = await new FollowNFT__factory(deployer).deploy(hubProxyAddress);
  transactionNFTImpl = await new TransactionNFT__factory(deployer).deploy(hubProxyAddress);

  rejigImpl = await new Rejig__factory(hubLibs, deployer).deploy(vRFCoordinatorV2Mock.address,1,GAS_LANE,CALLBACK_GAS_LIMIT,
    followNFTImpl.address, transactionNFTImpl.address
  );

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

  // Connect the hub proxy to the Rejig factory and the user for ease of use.
  rejig = Rejig__factory.connect(proxy.address, user);

  // RejigPeriphery
  rejigPeriphery = await new RejigPeriphery__factory(deployer).deploy(rejig.address);
  rejigPeriphery = rejigPeriphery.connect(user);

  // Currency
  currency = await new Currency__factory(deployer).deploy();

  // Modules

  feeFollowModule = await new FeeFollowModule__factory(deployer).deploy(
    rejig.address,
    moduleGlobals.address
  );
  profileFollowModule = await new ProfileFollowModule__factory(deployer).deploy(rejig.address);
  approvalFollowModule = await new ApprovalFollowModule__factory(deployer).deploy(rejig.address);
  revertFollowModule = await new RevertFollowModule__factory(deployer).deploy(rejig.address);
  followerOnlyReferenceModule = await new FollowerOnlyReferenceModule__factory(deployer).deploy(
    rejig.address
  );

  mockFollowModule = await new MockFollowModule__factory(deployer).deploy();
  mockReferenceModule = await new MockReferenceModule__factory(deployer).deploy();

  await expect(rejig.connect(governance).setState(ProtocolState.Unpaused)).to.not.be.reverted;

  expect(rejig).to.not.be.undefined;
  expect(currency).to.not.be.undefined;
  expect(mockFollowModule).to.not.be.undefined;
  expect(mockReferenceModule).to.not.be.undefined;

  // Event library deployment is only needed for testing and is not reproduced in the live environment
  eventsLib = await new Events__factory(deployer).deploy();

  const rejigERC20 = await new RejigERC20__factory(user).deploy(rejig.address,1000000);
  rejigERC20Address = await rejigERC20.address;

  transactionNFTImplAddress = await transactionNFTImpl.address;
});

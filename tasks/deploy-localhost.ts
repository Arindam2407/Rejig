import "@nomiclabs/hardhat-ethers";
import { task } from "hardhat/config";
import {frontEndContractsFile, frontEndAbiFile} from "../helper-hardhat-config"
import fs from "fs";

const TREASURY_FEE_BPS = 50;
const REJIG_NFT_NAME = 'Rejig App Profiles';
const REJIG_NFT_SYMBOL = 'RAP';
const BASE_FEE = "250000000000000000"
const GAS_PRICE_LINK = 1e9
const GAS_LANE =  "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";
const CALLBACK_GAS_LIMIT = "500000"

import { deployContract, waitForTx } from "./helpers/utils";
import { ModuleGlobals__factory,
        PublishingLogic__factory,
        InteractionLogic__factory,
        ProfileTokenURILogic__factory,
        PostNFTTokenURILogic__factory,
        Rejig__factory,
        FollowNFT__factory,
        TransparentUpgradeableProxy__factory,
        RejigPeriphery__factory,
        Currency__factory,
        FeeFollowModule__factory,
        ProfileFollowModule__factory,
        RevertFollowModule__factory,
        FollowerOnlyReferenceModule__factory,
        UIDataProvider__factory,
        ProfileCreationProxy__factory,
        VRFCoordinatorV2Mock__factory,
        TransactionNFT__factory,} from "../typechain-types";

task('deploy-localhost', 'deploys the entire Rejig App').setAction(async ({}, hre ) => {
    const ethers = hre.ethers;
    const chainId = hre.network.config.chainId

    // If we are on a local development network, we will deploy the following contracts
    if (chainId == 31337) {
        console.log("Local network detected! Deploying contracts...")

        const accounts = await ethers.getSigners();
        const deployer = accounts[0];
        const governance = accounts[1];
        const treasuryAddress = accounts[2].address;
        const proxyAdminAddress = deployer.address;
        const profileCreatorAddress = deployer.address;

        let deployerNonce = await ethers.provider.getTransactionCount(deployer.address);
        
        console.log('\n\t-- Deploying Module Globals --');
        const moduleGlobals = await deployContract(
            new ModuleGlobals__factory(deployer).deploy(governance.address,treasuryAddress,TREASURY_FEE_BPS, {
              nonce: deployerNonce++,
            })
        );

        console.log('\n\t-- Deploying Publishing Logic --');
        const publishingLogic = await deployContract(
            new PublishingLogic__factory(deployer).deploy({nonce: deployerNonce++})
        );

        console.log('\n\t-- Deploying Interaction Logic --');
        const interactionLogic = await deployContract(
            new InteractionLogic__factory(deployer).deploy({nonce: deployerNonce++})
        );

        console.log('\n\t-- Deploying Profile Token URI Logic --');
        const profileTokenURILogic = await deployContract(
            new ProfileTokenURILogic__factory(deployer).deploy({nonce: deployerNonce++})
        );

        console.log('\n\t-- Deploying Post NFT Token Logic --');
        const postNFTTokenURILogic = await deployContract(
            new PostNFTTokenURILogic__factory(deployer).deploy({nonce: deployerNonce++})
        );

        console.log('\n\t-- Deploying Chainlink Coordinator --');
        const vRFCoordinatorV2Mock = await deployContract(
            new VRFCoordinatorV2Mock__factory(deployer).deploy(BASE_FEE,GAS_PRICE_LINK,{nonce: deployerNonce++})
        );

        const hubLibs = {
          'contracts/libraries/InteractionLogic.sol:InteractionLogic': interactionLogic.address,
          'contracts/libraries/PostNFTTokenURILogic.sol:PostNFTTokenURILogic':
          postNFTTokenURILogic.address,
          'contracts/libraries/ProfileTokenURILogic.sol:ProfileTokenURILogic':
            profileTokenURILogic.address,
          'contracts/libraries/PublishingLogic.sol:PublishingLogic': publishingLogic.address};

        const followNFTNonce = ethers.utils.hexlify(deployerNonce + 2);
        const transactionNFTNonce = ethers.utils.hexlify(deployerNonce + 3)
        const hubProxyNonce = ethers.utils.hexlify(deployerNonce + 5);

        const followNFTImplAddress = '0x' + ethers.utils.keccak256(ethers.utils.RLP.encode([deployer.address, followNFTNonce])).substring(26);
        const transactionNFTImplAddress = '0x' + ethers.utils.keccak256(ethers.utils.RLP.encode([deployer.address, transactionNFTNonce])).substring(26);
        const hubProxyAddress = '0x' + ethers.utils.keccak256(ethers.utils.RLP.encode([deployer.address, hubProxyNonce])).substring(26);
          
        let SUB_ID;
        const txResponse = await vRFCoordinatorV2Mock.connect(deployer).createSubscription({ nonce: deployerNonce++ })
        const txReceipt = await txResponse.wait()
        SUB_ID = txReceipt.events[0].args.subId

        console.log('\n\t-- Deploying Rejig --')
        const rejigImpl = await deployContract(
            new Rejig__factory(hubLibs, deployer).deploy(vRFCoordinatorV2Mock.address,
              SUB_ID,
              GAS_LANE,
              CALLBACK_GAS_LIMIT, 
              followNFTImplAddress, transactionNFTImplAddress, {nonce: deployerNonce++})
        );

        console.log('\n\t-- Deploying Follow NFT and Transaction NFT --');
        const followNFT = await deployContract(
            new FollowNFT__factory(deployer).deploy(hubProxyAddress, {nonce: deployerNonce++})
        );

        const transactionNFT = await deployContract(
          new TransactionNFT__factory(deployer).deploy(hubProxyAddress, { nonce: deployerNonce++ })
        );

        const consumertxResponse = await vRFCoordinatorV2Mock.connect(deployer).addConsumer(SUB_ID,rejigImpl.address,
          { nonce: deployerNonce++ })
        await consumertxResponse.wait()

        let data = rejigImpl.interface.encodeFunctionData('initialize', [
            REJIG_NFT_NAME,
            REJIG_NFT_SYMBOL,
            governance.address,
          ]);
        
          console.log('\n\t-- Deploying Hub Proxy --');
          let proxy = await deployContract(
            new TransparentUpgradeableProxy__factory(deployer).deploy(
              rejigImpl.address,
              proxyAdminAddress,
              data,
              { nonce: deployerNonce++ }
            )
          );
        
          // Connect the hub proxy to the rejig factory and the governance for ease of use.
          const rejig = Rejig__factory.connect(proxy.address, governance);
        
          console.log('\n\t-- Deploying Rejig Periphery --');
          const rejigPeriphery = await new RejigPeriphery__factory(deployer).deploy(rejig.address, {
            nonce: deployerNonce++,
          });
        
  // Currency
  console.log('\n\t-- Deploying Currency --');
  const currency = await deployContract(
  new Currency__factory(deployer).deploy({ nonce: deployerNonce++ })
  );

  // Deploy follow modules
  console.log('\n\t-- Deploying feeFollowModule --');
  const feeFollowModule = await deployContract(
    new FeeFollowModule__factory(deployer).deploy(rejig.address, moduleGlobals.address, {
      nonce: deployerNonce++,
    })
  );
  console.log('\n\t-- Deploying profileFollowModule --');
  const profileFollowModule = await deployContract(
    new ProfileFollowModule__factory(deployer).deploy(rejig.address, {
      nonce: deployerNonce++,
    })
  );
  console.log('\n\t-- Deploying revertFollowModule --');
  const revertFollowModule = await deployContract(
    new RevertFollowModule__factory(deployer).deploy(rejig.address, {
      nonce: deployerNonce++,
    })
  );

  // Deploy reference module
  console.log('\n\t-- Deploying followerOnlyReferenceModule --');
  const followerOnlyReferenceModule = await deployContract(
    new FollowerOnlyReferenceModule__factory(deployer).deploy(rejig.address, {
      nonce: deployerNonce++,
    })
  );

  // Deploy UIDataProvider
  console.log('\n\t-- Deploying UI Data Provider --');
  const uiDataProvider = await deployContract(
    new UIDataProvider__factory(deployer).deploy(rejig.address, {
      nonce: deployerNonce++,
    })
  );

  console.log('\n\t-- Deploying Profile Creation Proxy --');
  const profileCreationProxy = await deployContract(
    new ProfileCreationProxy__factory(deployer).deploy(profileCreatorAddress, rejig.address, {
      nonce: deployerNonce++,
    }));
  
  

  // Whitelist
  let governanceNonce = await ethers.provider.getTransactionCount(governance.address);
  console.log('\n\t-- Whitelisting Currency in Module Globals --');
  await waitForTx(
    moduleGlobals
      .connect(governance)
      .whitelistCurrency(currency.address, true, { nonce: governanceNonce++ })
  );

  //Unpause
  console.log('\n\t-- Unpausing');
  await waitForTx(
    rejig.connect(governance).setState(0, {nonce : governanceNonce++})
  );

  console.log("----------------------------------------------------------")
  console.log("You are deploying to a local network, you'll need a local network running to interact")
  console.log("Please run `yarn hardhat console --network localhost` to interact with the deployed smart contracts!")
  console.log("----------------------------------------------------------")

  console.log("Writing to front end...")
        
        // Save and log the addresses
  const addrs = {
    'rejig proxy': rejig.address,
    'rejig impl': rejigImpl.address,
    'chainlink coordinator' : vRFCoordinatorV2Mock.address,
    'publishing logic lib': publishingLogic.address,
    'interaction logic lib': interactionLogic.address,
    'follow NFT impl': followNFTImplAddress,
    'transaction NFT impl': transactionNFTImplAddress,
    'currency' : currency.address,
    'rejig periphery': rejigPeriphery.address,
    'module globals': moduleGlobals.address,
    'fee follow module': feeFollowModule.address,
    'profile follow module': profileFollowModule.address,
    'revert follow module': revertFollowModule.address,
    'follower only reference module': followerOnlyReferenceModule.address,
    'UI data provider': uiDataProvider.address,
    'Profile creation proxy': profileCreationProxy.address
  };
  const json = JSON.stringify(addrs, null, 2);
  console.log(json);
    
  fs.writeFileSync(frontEndContractsFile, json, 'utf-8');
        
  const abis = {
    'rejig proxy': Rejig__factory.abi,
    'rejig impl': Rejig__factory.abi,
    'publishing logic lib': PublishingLogic__factory.abi,
    'interaction logic lib': InteractionLogic__factory.abi,
    'follow NFT impl': FollowNFT__factory.abi,
    'transaction NFT impl': TransactionNFT__factory.abi,
    'currency' : Currency__factory.abi,
    'rejig periphery': RejigPeriphery__factory.abi,
    'module globals': ModuleGlobals__factory.abi,
    'fee follow module': FeeFollowModule__factory.abi,
    'profile follow module': ProfileFollowModule__factory.abi,
    'revert follow module': RevertFollowModule__factory.abi,
    'follower only reference module': FollowerOnlyReferenceModule__factory.abi,
    'UI data provider': UIDataProvider__factory.abi,
    'Profile creation proxy': ProfileCreationProxy__factory.abi,
  };
  const jsonabi = JSON.stringify(abis, null, 2);
  fs.writeFileSync(frontEndAbiFile, jsonabi, 'utf-8');

  console.log("Front end written!")
}

});

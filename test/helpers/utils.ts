import '@nomiclabs/hardhat-ethers';
import { BigNumberish, Bytes, logger, utils, BigNumber, Contract, Signer } from 'ethers';
import {
  eventsLib,
  helper,
  rejig,
  REJIG_NFT_NAME,
  rejigPeriphery,
  REJIG_PERIPHERY_NAME,
  testWallet,
  user,
} from '../__setup.spec';
import { expect } from 'chai';
import { HARDHAT_CHAINID, MAX_UINT256 } from './constants';
import { BytesLike, hexlify, keccak256, RLP, toUtf8Bytes } from 'ethers/lib/utils';
import { Rejig__factory } from '../../typechain-types';
import { TransactionReceipt, TransactionResponse } from '@ethersproject/providers';
import hre, { ethers } from 'hardhat';
import { readFileSync } from 'fs';
import { join } from 'path';
import {CreateProfileDataStruct, CommentDataStruct,
PostDataStruct, MirrorDataStruct} from '../../typechain-types/Rejig';

export enum ProtocolState {
  Unpaused,
  PublishingPaused,
  Paused,
}

export function matchEvent(
  receipt: TransactionReceipt,
  name: string,
  expectedArgs?: any[],
  eventContract: Contract = eventsLib,
  emitterAddress?: string
) {
  const events = receipt.logs;

  if (events != undefined) {
    // match name from list of events in eventContract, when found, compute the sigHash
    let sigHash: string | undefined;
    for (let contractEvent of Object.keys(eventContract.interface.events)) {
      if (contractEvent.startsWith(name) && contractEvent.charAt(name.length) == '(') {
        sigHash = ethers.utils.keccak256(toUtf8Bytes(contractEvent));
        break;
      }
    }
    // Throw if the sigHash was not found
    if (!sigHash) {
      logger.throwError(
        `Event "${name}" not found in provided contract (default: Events libary). \nAre you sure you're using the right contract?`
      );
    }

    // Find the given event in the emitted logs
    let invalidParamsButExists = false;
    for (let emittedEvent of events) {
      // If we find one with the correct sighash, check if it is the one we're looking for
      if (emittedEvent.topics[0] == sigHash) {
        // If an emitter address is passed, validate that this is indeed the correct emitter, if not, continue
        if (emitterAddress) {
          if (emittedEvent.address != emitterAddress) continue;
        }
        const event = eventContract.interface.parseLog(emittedEvent);
        // If there are expected arguments, validate them, otherwise, return here
        if (expectedArgs) {
          if (expectedArgs.length != event.args.length) {
            logger.throwError(
              `Event "${name}" emitted with correct signature, but expected args are of invalid length`
            );
          }
          invalidParamsButExists = false;
          // Iterate through arguments and check them, if there is a mismatch, continue with the loop
          for (let i = 0; i < expectedArgs.length; i++) {
            // Parse empty arrays as empty bytes
            if (expectedArgs[i].constructor == Array && expectedArgs[i].length == 0) {
              expectedArgs[i] = '0x';
            }

            // Break out of the expected args loop if there is a mismatch, this will continue the emitted event loop
            if (BigNumber.isBigNumber(event.args[i])) {
              if (!event.args[i].eq(BigNumber.from(expectedArgs[i]))) {
                invalidParamsButExists = true;
                break;
              }
            } else if (event.args[i].constructor == Array) {
              let params = event.args[i];
              let expected = expectedArgs[i];
              if (expected != '0x' && params.length != expected.length) {
                invalidParamsButExists = true;
                break;
              }
              for (let j = 0; j < params.length; j++) {
                if (BigNumber.isBigNumber(params[j])) {
                  if (!params[j].eq(BigNumber.from(expected[j]))) {
                    invalidParamsButExists = true;
                    break;
                  }
                } else if (params[j] != expected[j]) {
                  invalidParamsButExists = true;
                  break;
                }
              }
              if (invalidParamsButExists) break;
            } else if (event.args[i] != expectedArgs[i]) {
              invalidParamsButExists = true;
              break;
            }
          }
          // Return if the for loop did not cause a break, so a match has been found, otherwise proceed with the event loop
          if (!invalidParamsButExists) {
            return;
          }
        } else {
          return;
        }
      }
    }
    // Throw if the event args were not expected or the event was not found in the logs
    if (invalidParamsButExists) {
      logger.throwError(`Event "${name}" found in logs but with unexpected args`);
    } else {
      logger.throwError(
        `Event "${name}" not found emitted by "${emitterAddress}" in given transaction log`
      );
    }
  } else {
    logger.throwError('No events were emitted');
  }
}

export function findEvent(
  receipt: TransactionReceipt,
  name: string,
  eventContract: Contract = eventsLib,
  emitterAddress?: string
) {
  const events = receipt.logs;

  if (events != undefined) {
    // match name from list of events in eventContract, when found, compute the sigHash
    let sigHash: string | undefined;
    for (const contractEvent of Object.keys(eventContract.interface.events)) {
      if (contractEvent.startsWith(name) && contractEvent.charAt(name.length) == '(') {
        sigHash = ethers.utils.keccak256(toUtf8Bytes(contractEvent));
        break;
      }
    }
    // Throw if the sigHash was not found
    if (!sigHash) {
      logger.throwError(
        `Event "${name}" not found in provided contract (default: Events libary). \nAre you sure you're using the right contract?`
      );
    }

    for (const emittedEvent of events) {
      // If we find one with the correct sighash, check if it is the one we're looking for
      if (emittedEvent.topics[0] == sigHash) {
        // If an emitter address is passed, validate that this is indeed the correct emitter, if not, continue
        if (emitterAddress) {
          if (emittedEvent.address != emitterAddress) continue;
        }
        const event = eventContract.interface.parseLog(emittedEvent);
        return event;
      }
    }
    // Throw if the event args were not expected or the event was not found in the logs
    logger.throwError(
      `Event "${name}" not found emitted by "${emitterAddress}" in given transaction log`
    );
  } else {
    logger.throwError('No events were emitted');
  }
}

export function computeContractAddress(deployerAddress: string, nonce: number): string {
  const hexNonce = hexlify(nonce);
  return '0x' + keccak256(RLP.encode([deployerAddress, hexNonce])).substring(26);
}

export function getChainId(): number {
  return hre.network.config.chainId || HARDHAT_CHAINID;
}

export function getAbbreviation(handle: string) {
  let slice = handle.substring(0, 4);
  if (slice.charAt(3) == ' ') {
    slice = slice.substring(0, 3);
  }
  return slice;
}

export async function waitForTx(
  tx: Promise<TransactionResponse> | TransactionResponse,
  skipCheck = false
): Promise<TransactionReceipt> {
  if (!skipCheck) await expect(tx).to.not.be.reverted;
  return await (await tx).wait();
}

export async function getBlockNumber(): Promise<number> {
  return (await helper.getBlockNumber()).toNumber();
}

export async function resetFork(): Promise<void> {
  await hre.network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.MAINNET_RPC_URL,
          blockNumber: 12012081,
        },
      },
    ],
  });
  console.log('\t> Fork reset');

  await hre.network.provider.request({
    method: 'evm_setNextBlockTimestamp',
    params: [1614290545], // Original block timestamp + 1
  });

  console.log('\t> Timestamp reset to 1614290545');
}

export async function getTimestamp(): Promise<any> {
  const blockNumber = await hre.ethers.provider.send('eth_blockNumber', []);
  const block = await hre.ethers.provider.send('eth_getBlockByNumber', [blockNumber, false]);
  return block.timestamp;
}

export async function setNextBlockTimestamp(timestamp: number): Promise<void> {
  await hre.ethers.provider.send('evm_setNextBlockTimestamp', [timestamp]);
}

export async function mine(blocks: number): Promise<void> {
  for (let i = 0; i < blocks; i++) {
    await hre.ethers.provider.send('evm_mine', []);
  }
}

let snapshotId: string = '0x1';
export async function takeSnapshot() {
  snapshotId = await hre.ethers.provider.send('evm_snapshot', []);
}

export async function revertToSnapshot() {
  await hre.ethers.provider.send('evm_revert', [snapshotId]);
}

export function expectEqualArrays(actual: BigNumberish[], expected: BigNumberish[]) {
  if (actual.length != expected.length) {
    logger.throwError(
      `${actual} length ${actual.length} does not match ${expected} length ${expect.length}`
    );
  }

  let areEquals = true;
  for (let i = 0; areEquals && i < actual.length; i++) {
    areEquals = BigNumber.from(actual[i]).eq(BigNumber.from(expected[i]));
  }

  if (!areEquals) {
    logger.throwError(`${actual} does not match ${expected}`);
  }
}

export interface CreateProfileReturningTokenIdStruct {
  sender?: Signer;
  vars: CreateProfileDataStruct;
}

export async function createProfileReturningTokenId({
  sender = user,
  vars,
}: CreateProfileReturningTokenIdStruct): Promise<BigNumber> {
  const tokenId = await rejig.connect(sender).callStatic.createProfile(vars);
  await expect(rejig.connect(sender).createProfile(vars)).to.not.be.reverted;
  return tokenId;
}

export interface FollowDataStruct {
  profileIds: BigNumberish[];
  datas: BytesLike[];
}

export interface FollowReturningTokenIdsStruct {
  sender?: Signer;
  vars: FollowDataStruct;
}

export async function followReturningTokenIds({
  sender = user,
  vars,
}: FollowReturningTokenIdsStruct): Promise<BigNumber[]> {
  let tokenIds;
    tokenIds = await rejig.connect(sender).callStatic.follow(vars.profileIds, vars.datas);
    await expect(rejig.connect(sender).follow(vars.profileIds, vars.datas)).to.not.be.reverted;
  return tokenIds;
}

export interface CommentReturningTokenIdStruct {
  sender?: Signer;
  vars: CommentDataStruct;
}

export async function commentReturningTokenId({
  sender = user,
  vars,
}: CommentReturningTokenIdStruct): Promise<BigNumber> {
  let tokenId;
  tokenId = await rejig.connect(sender).callStatic.comment(vars);
  await expect(rejig.connect(sender).comment(vars)).to.not.be.reverted;
  return tokenId;
}

export interface MirrorReturningTokenIdStruct {
  sender?: Signer;
  vars: MirrorDataStruct;
}

export async function mirrorReturningTokenId({
  sender = user,
  vars,
}: MirrorReturningTokenIdStruct): Promise<BigNumber> {
  let tokenId;
    tokenId = await rejig.connect(sender).callStatic.mirror(vars);
    await expect(rejig.connect(sender).mirror(vars)).to.not.be.reverted;
  return tokenId;
}

export interface PostReturningTokenIdStruct {
  sender?: Signer;
  vars: PostDataStruct;
}

export async function postReturningTokenId({
  sender = user,
  vars,
}: PostReturningTokenIdStruct): Promise<BigNumber> {
  let tokenId;
    tokenId = await rejig.connect(sender).callStatic.post(vars);
    await expect(rejig.connect(sender).post(vars)).to.not.be.reverted;
  return tokenId;
}

export interface TokenUriMetadataAttribute {
  trait_type: string;
  value: string;
}

export interface ProfileTokenUriMetadata {
  name: string;
  description: string;
  image: string;
  attributes: TokenUriMetadataAttribute[];
}

export async function getMetadataFromBase64TokenUri(
  tokenUri: string
): Promise<ProfileTokenUriMetadata> {
  const splittedTokenUri = tokenUri.split('data:application/json;base64,');
  if (splittedTokenUri.length != 2) {
    logger.throwError('Wrong or unrecognized token URI format');
  } else {
    const jsonMetadataBase64String = splittedTokenUri[1];
    const jsonMetadataBytes = ethers.utils.base64.decode(jsonMetadataBase64String);
    const jsonMetadataString = ethers.utils.toUtf8String(jsonMetadataBytes);
    return JSON.parse(jsonMetadataString);
  }
}

export async function getDecodedSvgImage(tokenUriMetadata: ProfileTokenUriMetadata) {
  const splittedImage = tokenUriMetadata.image.split('data:image/svg+xml;base64,');
  if (splittedImage.length != 2) {
    logger.throwError('Wrong or unrecognized token URI format');
  } else {
    return ethers.utils.toUtf8String(ethers.utils.base64.decode(splittedImage[1]));
  }
}

export function loadTestResourceAsUtf8String(relativePathToResouceDir: string) {
  return readFileSync(join('test', 'resources', relativePathToResouceDir), 'utf8');
}

function domain(): { name: string; version: string; chainId: number; verifyingContract: string } {
  return {
    name: REJIG_NFT_NAME,
    version: '1',
    chainId: getChainId(),
    verifyingContract: rejig.address,
  };
}

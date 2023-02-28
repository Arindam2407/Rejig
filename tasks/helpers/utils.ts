import '@nomiclabs/hardhat-ethers';
import { Contract, ContractTransaction } from 'ethers';

export async function deployContract(tx: any): Promise<Contract> {
  const result = await tx;
  await result.deployTransaction.wait();
  return result;
}

export async function waitForTx(tx: Promise<ContractTransaction>) {
  await (await tx).wait();
}
import { ethers } from "hardhat";
import { verifyContract } from "./verify";
import { type BaseContract } from "ethers";
import { SnailBrook } from "../../typechain-types";

export async function deploySnailToken(): Promise<SnailBrook> {
  const args = ["SnailBrook", "SNAIL", ethers.parseEther("100000000000000000000000000000")];
  return deployAndVerify<SnailBrook>("SnailBrook", args);
}

export async function deployAndVerify<T extends BaseContract>(contractName: string, args: unknown[]): Promise<T> {
  const contract = await ethers.deployContract(contractName, args);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  await verifyContract(contractAddress, args);
  console.log(`${contractName} deployed & verified to ${contractAddress}`);
  return contract as never as T;
}

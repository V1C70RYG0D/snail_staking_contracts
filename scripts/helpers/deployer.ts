import { retry } from "./utils";
import { ethers } from "hardhat";
import { verifyContract } from "./verify";
import { type BaseContract } from "ethers";
import { SnailBrook } from "../../typechain-types";

export async function deploySnailToken(): Promise<SnailBrook> {
  const args = ["SnailBrook", "SNAIL", ethers.parseEther("100000000000000000000000000000")];
  return deployAndVerify<SnailBrook>("SnailBrook", args);
}

export async function deployAndVerify<T extends BaseContract>(contractName: string, args: unknown[]): Promise<T> {
  console.log(`\nDeploying ${contractName}...`);
  const contract = await ethers.deployContract(contractName, args);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  // Verify the contract. Request might fail in different ways, so we retry a few times.
  await retry(() => verifyContract(contractAddress, args), 5, 1000).catch((error) =>
    console.error("Error verifying contract:", error),
  );
  console.log(`${contractName} deployed & verified to ${contractAddress}`);
  return contract as never as T;
}

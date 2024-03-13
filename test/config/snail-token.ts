import { ethers } from "hardhat";
import { SnailBrook } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

export async function snailTokenDeployer(): Promise<
  [SnailBrook, HardhatEthersSigner, HardhatEthersSigner, HardhatEthersSigner]
> {
  const snailToken = (await ethers.deployContract("SnailBrook", [
    "SnailBrook",
    "SNAIL",
    ethers.parseEther("100000000000000000000000000000"),
  ])) as never as SnailBrook;

  const amount = ethers.parseEther("10000000000000000000");
  const [owner, user1, user2] = await ethers.getSigners();

  for await (const user of [owner, user1, user2]) {
    await snailToken.connect(owner).transfer(user.address, amount);
  }

  return [snailToken, owner, user1, user2];
}

import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SnailBrook, StakingConfigurator, StakingRewardsManager } from "../../typechain-types";

type StakingPoolReward = {
  poolId: number;
  amount: bigint;
};

type StakingRewardsParams = {
  admin: HardhatEthersSigner;
  rewards: StakingPoolReward[];
};

export async function stakingRewardsManagerDeployer(
  snailToken: SnailBrook,
  stakingConfigurator: StakingConfigurator,
  params?: StakingRewardsParams,
): Promise<StakingRewardsManager> {
  const stakingRewardsManager = (await ethers.deployContract("StakingRewardsManager", [
    snailToken,
    stakingConfigurator,
  ])) as never as StakingRewardsManager;

  if (params) {
    for await (const reward of params.rewards) {
      await snailToken.connect(params.admin).approve(stakingRewardsManager, reward.amount);
      await stakingRewardsManager.depositRewards(params.admin, reward.poolId, reward.amount);
    }
  }
  return stakingRewardsManager;
}

import { Signer } from "ethers";
import { ethers } from "hardhat";
import { PearlPointsCalculator, StakingConfigurator, StakingRewardsManager } from "../../typechain-types";

export async function addStakingPool(
  stakingConfiguratorContract: StakingConfigurator,
  duration: number,
  signer: Signer,
) {
  const poolId = await stakingConfiguratorContract.getPoolsCount();
  const txAddStakingPool = await stakingConfiguratorContract.connect(signer).addStakingPool(duration);
  await txAddStakingPool.wait();
  console.log("Staking pool added with duration:", duration);
  return poolId;
}

export async function setPoolPearlMultiplier(
  pearlPointsCalculatorContract: PearlPointsCalculator,
  poolId: number | bigint,
  multiplier: number,
  signer: Signer,
) {
  const txSetPoolPearlMultiplier = await pearlPointsCalculatorContract
    .connect(signer)
    .setPoolPearlMultiplier(poolId, multiplier);
  await txSetPoolPearlMultiplier.wait();
  console.log("Pool Pearl Multiplier set for poolId:", poolId);
}

export async function approveAndDepositRewards(
  snailTokenAddress: string,
  stakingRewardsManager: StakingRewardsManager,
  poolId: number | bigint,
  rewards: number,
  signer: Signer,
) {
  const depositAmount = ethers.parseEther(rewards.toString());

  const snailContract = await ethers.getContractAt("SnailBrook", snailTokenAddress);
  const txApprove = await snailContract.connect(signer).approve(stakingRewardsManager, depositAmount);
  await txApprove.wait();
  console.log("Approved rewards for poolId:", poolId);

  const txDepositRewards = await stakingRewardsManager.connect(signer).depositRewards(signer, poolId, depositAmount);
  await txDepositRewards.wait();
  console.log("Deposited rewards for poolId:", poolId);
}

export async function setStakingPeriod(
  stakingConfiguratorContract: StakingConfigurator,
  timeStart: number,
  timeEnd: number,
  signer: Signer,
) {
  const txSetStakingPeriod = await stakingConfiguratorContract.connect(signer).setStakingPeriod(timeStart, timeEnd);
  await txSetStakingPeriod.wait();
  console.log("Staking period set from:", timeStart, "to:", timeEnd);
}

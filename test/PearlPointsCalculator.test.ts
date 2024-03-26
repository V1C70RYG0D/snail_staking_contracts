import { expect } from "chai";
import { ethers } from "hardhat";
import { StakingOperation } from "./config/staking-manager";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  PearlPointsCalculator,
  SnailBrook,
  StakingConfigurator,
  StakingManager,
  StakingRewardsManager,
} from "../typechain-types";
import {
  pearlPointsCalculatorDeployer,
  snailTokenDeployer,
  stakingConfiguratorDeployer,
  stakingManagerDeployer,
  stakingRewardsManagerDeployer,
} from "./config";

describe("PearlPointsCalculator", function () {
  let token: SnailBrook;
  let stakingManager: StakingManager;
  let stakingConfigurator: StakingConfigurator;
  let stakingRewardsManager: StakingRewardsManager;
  let pearlPointsCalculator: PearlPointsCalculator;

  const pearlPointCoefficient = 1000;
  const depositAmount = ethers.parseEther("100000");

  let owner: HardhatEthersSigner, user1: HardhatEthersSigner, user2: HardhatEthersSigner;

  beforeEach(async function () {
    const setupTime = (await time.latest()) + 100;
    const pools = [
      { poolId: 0, amount: ethers.parseEther("100000000"), duration: 40_000 },
      { poolId: 1, amount: ethers.parseEther("100000000"), duration: 40_000 },
    ];

    stakingConfigurator = await stakingConfiguratorDeployer({
      startTime: setupTime,
      endTime: setupTime + 120_000,
      pools: pools.map(({ duration }) => ({ duration })),
    });

    [token, owner, user1, user2] = await snailTokenDeployer();
    stakingRewardsManager = await stakingRewardsManagerDeployer(token, stakingConfigurator, {
      admin: owner,
      rewards: pools,
    });

    stakingManager = await stakingManagerDeployer(token, stakingConfigurator, stakingRewardsManager, {
      actions: [
        {
          operation: StakingOperation.Deposit,
          amount: depositAmount,
          poolId: 0,
          user: user1,
          timeDelay: 0,
        },
        {
          operation: StakingOperation.Deposit,
          amount: depositAmount,
          poolId: 1,
          user: user1,
          timeDelay: 0,
        },
        {
          operation: StakingOperation.Deposit,
          amount: depositAmount,
          poolId: 1,
          user: user2,
          timeDelay: 0,
        },
        {
          operation: StakingOperation.Withdraw,
          stakeId: 0,
          user: user2,
          timeDelay: 60_000,
        },
      ],
    });

    pearlPointsCalculator = await pearlPointsCalculatorDeployer(stakingManager);
  });

  describe("setPoolPearlMultiplier", function () {
    it("Should set the multiplier successfully", async function () {
      expect(await pearlPointsCalculator.setPoolPearlMultiplier(1, 150)).to.be.not.reverted;
    });

    it("Should fail when non-owner tries to set a multiplier", async function () {
      await expect(pearlPointsCalculator.connect(user1).setPoolPearlMultiplier(1, 150)).to.be.revertedWithCustomError(
        stakingConfigurator,
        "OwnableUnauthorizedAccount",
      );
    });

    it("Should fail when setting a multiplier for an already initialized pool", async function () {
      await pearlPointsCalculator.setPoolPearlMultiplier(1, 150);
      await expect(pearlPointsCalculator.setPoolPearlMultiplier(1, 200)).to.be.revertedWith(
        "Pool multiplier already initialized",
      );
    });

    it("Should fail when setting a multiplier less than 100", async function () {
      await expect(pearlPointsCalculator.setPoolPearlMultiplier(1, 99)).to.be.revertedWith("Must be grater than 100");
    });
  });

  describe("getPoolPearlMultiplier", function () {
    const pool_0 = 0;
    const pool_1 = 1;
    const multiplier_0 = 200;
    const multiplier_1 = 500;

    beforeEach(async function () {
      await pearlPointsCalculator.setPoolPearlMultiplier(pool_0, multiplier_0);
      await pearlPointsCalculator.setPoolPearlMultiplier(pool_1, multiplier_1);
    });

    it("Should return the correct multiplier", async function () {
      expect(await pearlPointsCalculator.getPoolMultiplier(pool_0)).to.equal(multiplier_0);
      expect(await pearlPointsCalculator.getPoolMultiplier(pool_1)).to.equal(multiplier_1);
    });
  });

  describe("getPearlPointsForStake", function () {
    const pool_0 = 0;
    const pool_1 = 1;
    const multiplier_0 = 200;
    const multiplier_1 = 500;

    beforeEach(async function () {
      await pearlPointsCalculator.setPoolPearlMultiplier(pool_0, multiplier_0);
      await pearlPointsCalculator.setPoolPearlMultiplier(pool_1, multiplier_1);
    });

    it("Should calculate pearl points correctly for an active stake", async function () {
      const expectedPearlPoints = (Number(depositAmount) / pearlPointCoefficient) * (multiplier_0 / 100);
      const actualPearlPoints = await pearlPointsCalculator.getPearlPointsForStake(user1.address, 0);

      const poolRewardsFormatted = Math.ceil(Number(ethers.formatEther(actualPearlPoints)));
      const stakeResultFormatted = Math.ceil(Number(ethers.formatEther(BigInt(expectedPearlPoints))));

      expect(stakeResultFormatted).to.equal(poolRewardsFormatted);
    });

    it("Should return 0 for a withdrawn stake", async function () {
      const stakeId = 0;
      expect(await pearlPointsCalculator.getPearlPointsForStake(user2, stakeId)).to.equal(0);
    });
  });

  describe("getTotalPearlPointsForStaker", function () {
    const pool_0 = 0;
    const pool_1 = 1;
    const multiplier_0 = 200;
    const multiplier_1 = 500;

    beforeEach(async function () {
      await pearlPointsCalculator.setPoolPearlMultiplier(pool_0, multiplier_0);
      await pearlPointsCalculator.setPoolPearlMultiplier(pool_1, multiplier_1);
    });

    it("Should calculate pearl points correctly for all active stakes", async function () {
      const expectedPearlPoints_0 = (Number(depositAmount) / pearlPointCoefficient) * (multiplier_0 / 100);
      const actualPearlPoints_0 = await pearlPointsCalculator.getPearlPointsForStake(user1, 0);

      const poolRewardsFormatted_0 = Math.ceil(Number(ethers.formatEther(actualPearlPoints_0)));
      const stakeResultFormatted_0 = Math.ceil(Number(ethers.formatEther(BigInt(expectedPearlPoints_0))));

      const expectedPearlPoints_1 = (Number(depositAmount) / pearlPointCoefficient) * (multiplier_1 / 100);
      const actualPearlPoints_1 = await pearlPointsCalculator.getPearlPointsForStake(user1, 1);

      const poolRewardsFormatted_1 = Math.ceil(Number(ethers.formatEther(actualPearlPoints_1)));
      const stakeResultFormatted_1 = Math.ceil(Number(ethers.formatEther(BigInt(expectedPearlPoints_1))));

      const totalPearlPoints = await pearlPointsCalculator.getTotalPearlPointsForStaker(user1);
      const formattedTotalPearlPoints = Math.ceil(Number(ethers.formatEther(totalPearlPoints)));

      expect(formattedTotalPearlPoints).to.equal(poolRewardsFormatted_0 + poolRewardsFormatted_1);
      expect(formattedTotalPearlPoints).to.equal(stakeResultFormatted_0 + stakeResultFormatted_1);
    });
  });
});

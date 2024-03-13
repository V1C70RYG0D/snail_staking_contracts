import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SnailBrook, StakingConfigurator, StakingManager, StakingRewardsManager } from "../typechain-types";
import {
  DAY_IN_SECONDS,
  snailTokenDeployer,
  stakingConfiguratorDeployer,
  stakingManagerDeployer,
  stakingRewardsManagerDeployer,
} from "./config";

describe("StakingManager", () => {
  let token: SnailBrook;
  let stakingManager: StakingManager;
  let stakingConfigurator: StakingConfigurator;
  let stakingRewardsManager: StakingRewardsManager;

  let owner: HardhatEthersSigner, user1: HardhatEthersSigner, user2: HardhatEthersSigner;

  beforeEach(async function () {
    const setupTime = (await time.latest()) + 100;
    const pools = [
      {
        poolId: 0,
        amount: ethers.parseEther("100000000"),
        duration: DAY_IN_SECONDS * 365 * 0.5,
      },
      {
        poolId: 1,
        amount: ethers.parseEther("100000000"),
        duration: DAY_IN_SECONDS * 365 * 2,
      },
    ];

    stakingConfigurator = await stakingConfiguratorDeployer({
      startTime: setupTime,
      endTime: setupTime + DAY_IN_SECONDS * 365 * 2,
      pools: pools.map(({ duration }) => ({ duration })),
    });

    [token, owner, user1, user2] = await snailTokenDeployer();
    stakingRewardsManager = await stakingRewardsManagerDeployer(token, stakingConfigurator, {
      admin: owner,
      rewards: pools,
    });

    stakingManager = await stakingManagerDeployer(token, stakingConfigurator, stakingRewardsManager);
  });

  describe("Deposit", function () {
    const poolId = 0;
    const depositAmount = ethers.parseEther("10000");

    beforeEach(async function () {
      await token.connect(user1).approve(stakingManager, depositAmount);
    });

    it("allows a user to deposit tokens into a pool", async function () {
      await expect(stakingManager.connect(user1).deposit(poolId, depositAmount)).to.be.not.reverted;

      const userStakes = await stakingManager.getUserStakes(user1);
      expect(userStakes).to.have.lengthOf(1);
      const [userStake] = userStakes;
      expect(userStake.amount).to.equal(depositAmount);
      expect(userStake.poolId).to.equal(poolId);
      expect(userStake.status).to.equal(0); // Assuming 0 signifies 'Deposited'
    });

    it("should emit Deposited event", async function () {
      const stakeId = 0;

      await expect(stakingManager.connect(user1).deposit(poolId, depositAmount))
        .to.emit(stakingManager, "Deposited")
        .withArgs(user1.address, stakeId, poolId, depositAmount);
    });

    it("reverts when the staking amount is zero", async function () {
      const zeroAmount = ethers.parseEther("0");
      await expect(stakingManager.connect(user1).deposit(poolId, zeroAmount)).to.be.revertedWith(
        "Staking amount must be greater than zero",
      );
    });

    it("reverts when the pool does not exist", async function () {
      const nonExistentPoolId = 100; // Assuming pool ID 100 does not exist
      await expect(stakingManager.connect(user1).deposit(nonExistentPoolId, depositAmount)).to.be.revertedWith(
        "Invalid pool ID",
      );
    });
  });

  describe("Withdraw", function () {
    const poolId = 0;
    const stakeId = 0;
    const depositAmount = ethers.parseEther(Number(100_000).toString());

    beforeEach(async function () {
      await token.connect(user1).approve(stakingManager, depositAmount);
      await stakingManager.connect(user1).deposit(poolId, depositAmount);

      // Simulate passing time when the staking period has ended
      const endTime = await stakingConfigurator.getEndTime();
      await time.increaseTo(Number(endTime) + 10_000);
    });

    it("allows a user to withdraw tokens and claim rewards after the staking period", async function () {
      const rewardsAmount = await stakingManager.getRewardsForStake(user1, stakeId);

      const initialBalance = await token.balanceOf(user1);
      await expect(stakingManager.connect(user1).withdraw(stakeId))
        .to.emit(stakingManager, "Withdrawn")
        .withArgs(user1, stakeId, depositAmount, rewardsAmount);

      const [userStake] = await stakingManager.getUserStakes(user1);
      expect(userStake.status).to.equal(1); // Assuming 1 signifies 'Withdrawn'

      const finalBalance = await token.balanceOf(user1);
      expect(finalBalance).to.be.equal(initialBalance + userStake.amount + rewardsAmount);
    });

    it("reverts if trying to withdraw from a non-existent stake", async function () {
      const nonExistentStakeId = 999;
      await expect(stakingManager.connect(user1).withdraw(nonExistentStakeId)).to.be.revertedWith(
        "Stake does not exist",
      );
    });

    it("reverts if trying to withdraw a stake that has already been withdrawn", async function () {
      // First withdrawal
      await stakingManager.connect(user1).withdraw(stakeId);

      // Attempting second withdrawal on the same stake
      await expect(stakingManager.connect(user1).withdraw(stakeId)).to.be.revertedWith("Stake is already withdrawn");
    });

    it("reverts if trying to withdraw before the staking period has ended", async function () {
      await token.connect(user2).approve(stakingManager, depositAmount);
      await stakingManager.connect(user2).deposit(poolId, depositAmount);

      // Reset time to before the end of the staking period
      const latestTime = await time.latest();
      const poolDuration = await stakingConfigurator.getPoolDuration(poolId);
      await time.increaseTo(latestTime + Number(poolDuration) / 2);

      await expect(stakingManager.connect(user2).withdraw(stakeId)).to.be.revertedWith("Withdraw not yet available");
    });
  });

  describe("Staking Pools Information", function () {
    const poolId_0 = 0;
    const poolId_1 = 1;
    const depositAmountUser1 = ethers.parseEther("10000");
    const depositAmountUser2 = ethers.parseEther("20000");

    beforeEach(async function () {
      await token.connect(user1).approve(stakingManager, depositAmountUser1);
      await token.connect(user2).approve(stakingManager, depositAmountUser2);
    });

    it("correctly reports the total staked amount for a specific pool", async function () {
      await stakingManager.connect(user1).deposit(poolId_0, depositAmountUser1);
      await stakingManager.connect(user2).deposit(poolId_0, depositAmountUser2);

      const totalStakedForPoolZero = await stakingManager.getTotalStakedForPool(poolId_0);
      expect(totalStakedForPoolZero).to.equal(depositAmountUser1 + depositAmountUser2);
    });

    it("returns zero for a pool with no stakes", async function () {
      // Assuming poolId_1 has no stakes at this point
      const totalStakedForPoolOne = await stakingManager.getTotalStakedForPool(poolId_1);
      expect(totalStakedForPoolOne).to.equal(0);
    });

    it("correctly reports the total staked amount across all pools", async function () {
      // User1 deposits into poolId_0, User2 into poolId_1
      await stakingManager.connect(user1).deposit(poolId_0, depositAmountUser1);
      await stakingManager.connect(user2).deposit(poolId_1, depositAmountUser2);

      const totalStaked = await stakingManager.getTotalStaked();
      expect(totalStaked).to.equal(depositAmountUser1 + depositAmountUser2);
    });
  });

  describe("APY Calculation", function () {
    const poolId_0 = 0;
    const poolId_1 = 1;
    const initialStakeAmount = ethers.parseEther("750000");
    let totalRewardsPool_0: number, totalRewardsPool_1: number, stakingPeriod: number;

    beforeEach(async function () {
      const startTime = await stakingConfigurator.getStartTime();
      const endTime = await stakingConfigurator.getEndTime();
      stakingPeriod = Number(endTime - startTime);

      const poolRewards_0 = await stakingRewardsManager.getPoolRewards(poolId_0);
      totalRewardsPool_0 = Number(poolRewards_0.totalAmount);

      const poolRewards_1 = await stakingRewardsManager.getPoolRewards(poolId_1);
      totalRewardsPool_1 = Number(poolRewards_1.totalAmount);

      // User stakes in both pools to ensure there are staked amounts for APY calculation
      await token.connect(user1).approve(stakingManager, ethers.parseEther("7500000"));
      await stakingManager.connect(user1).deposit(poolId_0, initialStakeAmount);
      await stakingManager.connect(user1).deposit(poolId_1, initialStakeAmount);
    });

    it("accurately calculates the APY for a pool", async function () {
      const apyPool_0 = await stakingManager.getPoolAPY(poolId_0);
      const expectedApyPool_0 =
        (Number(totalRewardsPool_0) * 365 * DAY_IN_SECONDS) / (Number(initialStakeAmount) * stakingPeriod);
      expect(apyPool_0).to.be.equal(Math.floor(expectedApyPool_0 * 100));

      const apyPool_1 = await stakingManager.getPoolAPY(poolId_1);
      const expectedApyPool_1 =
        (Number(totalRewardsPool_1) * 365 * DAY_IN_SECONDS) / (Number(initialStakeAmount) * stakingPeriod);
      expect(apyPool_1).to.be.equal(Math.floor(expectedApyPool_1 * 100));
    });

    it("returns zero APY for a pool without stakes", async function () {
      const nonExistentPoolId = 150; // Assuming this pool has no stakes
      const apyNonExistentPool = await stakingManager.getPoolAPY(nonExistentPoolId);
      expect(apyNonExistentPool).to.equal(0);
    });
  });

  describe("User Stakes Information", function () {
    const poolId = 0;
    const stakeId = 0;
    const depositAmount = ethers.parseEther("50000");

    beforeEach(async function () {
      await token.connect(user1).approve(stakingManager, ethers.parseEther("5000000"));
      await stakingManager.connect(user1).deposit(poolId, depositAmount);
    });

    it("correctly returns a users stakes", async function () {
      const userStakes = await stakingManager.getUserStakes(user1);
      expect(userStakes.length).to.equal(1);
      const stake = userStakes[0];
      expect(stake.amount).to.equal(depositAmount);
      expect(stake.poolId).to.equal(poolId);
      expect(stake.status).to.equal(0); // Assuming 0 signifies 'Deposited'
    });

    it("correctly returns the details of a specific stake for a user", async function () {
      const stakeDetails = await stakingManager.getUserStake(user1, stakeId);
      expect(stakeDetails.amount).to.equal(depositAmount);
      expect(stakeDetails.poolId).to.equal(poolId);
      expect(stakeDetails.status).to.equal(0); // Assuming 0 signifies 'Deposited'
    });

    it("returns an empty array for a user with no stakes", async function () {
      // Assuming user2 has not made any stakes
      const user2Address = await user2.getAddress();
      const userStakes = await stakingManager.getUserStakes(user2Address);
      expect(userStakes.length).to.equal(0);
    });

    it("should revert if stake does not exist", async () => {
      const stakeId = 100; // Non-existent stake ID
      await expect(stakingManager.getRewardsForStake(user1.address, stakeId)).to.be.revertedWith(
        "Stake does not exist",
      );
    });

    it("should return zero if the user has no stakes", async () => {
      const totalRewards = await stakingManager.getRewardsForAllStakes(user2.address);
      expect(totalRewards).to.equal(0);
    });
  });

  describe("Rewards calculation for user stakes", () => {
    const poolId = 0;
    const amount1 = ethers.parseEther(Number(10_000).toString());

    let poolRewards: { totalAmount: bigint; claimedAmount: bigint };

    beforeEach(async function () {
      poolRewards = await stakingRewardsManager.getPoolRewards(poolId);

      await token.connect(user1).approve(stakingManager, ethers.parseEther("1000000"));
      await stakingManager.connect(user1).deposit(poolId, amount1);
    });

    it("should return the correct rewards for a stake", async () => {
      // Increase time to make withdrawal available
      const endTime = await stakingConfigurator.getEndTime();
      await time.increaseTo(Number(endTime) + 10_000);

      const stakeRewards = await stakingManager.getRewardsForStake(user1.address, 0);
      const stakeResultFormatted = Math.ceil(Number(ethers.formatEther(stakeRewards)));
      const poolRewardsFormatted = Math.ceil(Number(ethers.formatEther(poolRewards.totalAmount)));

      expect(stakeResultFormatted).to.equal(poolRewardsFormatted);
    });

    it("should return the correct total rewards for all stakes", async () => {
      const amount2 = ethers.parseEther(Number(20_000).toString());
      await stakingManager.connect(user1).deposit(poolId, amount2);

      // Increase time to make withdrawal available
      const endTime = await stakingConfigurator.getEndTime();
      await time.increaseTo(Number(endTime) + 10_000);

      const userStakes = await stakingManager.getUserStakes(user1);
      expect(userStakes.length).to.equal(2);

      const totalRewards = await stakingManager.getRewardsForAllStakes(user1.address);
      const expectedRewards =
        (amount1 * poolRewards.totalAmount) / (amount1 + amount2) +
        (amount2 * poolRewards.totalAmount) / (amount1 + amount2);

      expect(totalRewards).to.equal(expectedRewards);
    });
  });
});

import { expect } from "chai";
import { ethers } from "hardhat";
import { StakingOperation } from "./config/staking-manager";
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

const DEPOSITED_STATUS = 0;
const WITHDRAWN_STATUS = 1;

/**
 * Cover comprehensive scenarios for the StakingManager contract
 */
describe("StakingManager", () => {
  let token: SnailBrook;
  let owner: HardhatEthersSigner;

  before(async function () {
    [token, owner] = await snailTokenDeployer();
  });

  describe("Program rewards distribution", function () {
    let stakingConfigurator: StakingConfigurator;
    let stakingRewardsManager: StakingRewardsManager;

    const poolId = 0;
    const poolDuration = 3 * 10_000;
    const depositAmount = ethers.parseEther("100000");

    // Test setup
    before(async () => {
      const latestTime = await time.latest();
      const setupTime = Math.floor(latestTime / 10000) * 10000 + 10_000;

      const pools = [
        {
          poolId,
          amount: ethers.parseEther("1000000"),
          duration: poolDuration,
        },
      ];

      stakingConfigurator = await stakingConfiguratorDeployer({
        startTime: setupTime,
        endTime: setupTime + poolDuration,
        pools: pools.map(({ duration }) => ({ duration })),
      });
      await time.increaseTo(setupTime);

      stakingRewardsManager = await stakingRewardsManagerDeployer(token, stakingConfigurator, {
        admin: owner,
        rewards: pools,
      });
    });

    it("should distribute correct rewards between users", async function () {
      // We have 3 users depositing in the same pool. Pool provides 1mio tokens as rewards
      // Program duration is 3 intervals (each interval is 1/3 of the total duration) 333k tokens per interval
      // Each user deposits 100k tokens and enters at different intervals
      // Rewards are distributed based on the amount of tokens deposited and the time they were deposited
      // We expect the following rewards:
      // User1: 333k + 333k / 2 + 333k / 3 = 611k
      // User2: 333k / 2 + 333k / 3 = 278k
      // User3: 333k / 3 = 112k

      const stakeId = 0;

      const [, user1, user2, user3] = await ethers.getSigners();

      for await (const user of [user1, user2, user3]) {
        await token.connect(owner).transfer(user, depositAmount);
        await token.connect(user).approve(stakingRewardsManager, depositAmount);
      }

      const stakingManager = await stakingManagerDeployer(token, stakingConfigurator, stakingRewardsManager, {
        actions: [
          {
            operation: StakingOperation.Deposit,
            amount: depositAmount,
            poolId,
            user: user1,
            timeDelay: 1_000,
          },
          {
            operation: StakingOperation.Deposit,
            amount: depositAmount,
            poolId,
            user: user2,
            timeDelay: 11_000,
          },
          {
            operation: StakingOperation.Deposit,
            amount: depositAmount,
            poolId,
            user: user3,
            timeDelay: 21_000,
          },
        ],
      });

      expect(await stakingManager.getTotalStakedForPool(poolId)).equal(ethers.parseEther("300000"));

      // Simulate passing time when the staking period has ended
      const startTime = await stakingConfigurator.getStartTime();
      const endTime = await stakingConfigurator.getEndTime();
      await time.increaseTo(Number(endTime) + poolDuration);

      const user1_rewards = await stakingManager.getRewardsForStake(user1, stakeId);
      const user2_rewards = await stakingManager.getRewardsForStake(user2, stakeId);
      const user3_rewards = await stakingManager.getRewardsForStake(user3, stakeId);

      const user1_stake = await stakingManager.getUserStake(user1, stakeId);
      const user2_stake = await stakingManager.getUserStake(user2, stakeId);
      const user3_stake = await stakingManager.getUserStake(user3, stakeId);

      // Expect each user entered at different times
      expect(user1_stake.timestamp).to.be.equal(startTime);
      expect(user1_stake.timestamp).to.be.lt(user2_stake.timestamp);
      expect(user2_stake.timestamp).to.be.lt(user3_stake.timestamp);
      expect(user3_stake.timestamp).to.be.lt(endTime);

      const user1_rewards_formatted = Math.floor(Number(ethers.formatEther(user1_rewards)));
      const user2_rewards_formatted = Math.floor(Number(ethers.formatEther(user2_rewards)));
      const user3_rewards_formatted = Math.floor(Number(ethers.formatEther(user3_rewards)));

      // Check reward distribution
      expect(user1_rewards_formatted).to.be.eq(611111);
      expect(user2_rewards_formatted).to.be.eq(277777);
      expect(user3_rewards_formatted).to.be.eq(111111);

      const totalRewards = user1_rewards + user2_rewards + user3_rewards;
      const expectedTotalRewards = BigInt(ethers.parseEther("1000000"));
      expect(totalRewards).to.be.closeTo(expectedTotalRewards, 1);
    });
  });

  describe("Staking rewards distribution", function () {
    let signers: HardhatEthersSigner[];
    let stakingConfigurator: StakingConfigurator;
    let stakingRewardsManager: StakingRewardsManager;
    let stakingManager: StakingManager;

    const totalUsers = 100;
    const totalRewards = 1_000_000_000;
    const depositAmount = ethers.parseEther("10000");
    const halfDepositAmount = ethers.parseEther("5000");

    before(async () => {
      signers = await ethers.getSigners();

      const setupTime = (await time.latest()) + 100;
      const pools = [
        {
          poolId: 0,
          amount: ethers.parseEther(String(totalRewards)),
          duration: DAY_IN_SECONDS * 30,
        },
      ];

      stakingConfigurator = await stakingConfiguratorDeployer({
        startTime: setupTime,
        endTime: setupTime + DAY_IN_SECONDS * 365 * 2,
        pools: pools.map(({ duration }) => ({ duration })),
      });

      stakingRewardsManager = await stakingRewardsManagerDeployer(token, stakingConfigurator, {
        admin: owner,
        rewards: pools,
      });

      stakingManager = await stakingManagerDeployer(token, stakingConfigurator, stakingRewardsManager);
    });

    it("should correctly maintain hundreds of stakes", async function () {
      const poolId = 0;
      const stakeId = 0;

      const startTime = await stakingConfigurator.getStartTime();
      const endTime = await stakingConfigurator.getEndTime();
      const userEntryDelay = (Number(endTime) - Number(startTime)) / totalUsers / 2;
      let currentTime = await time.latest();

      console.log(`Top up balance and approve spending for ${totalUsers} users. Place deposits.`);
      for (let i = 1; i <= totalUsers; i++) {
        const user = signers[i];
        await token.connect(owner).transfer(user, depositAmount);
        await token.connect(user).approve(stakingManager, depositAmount);

        await stakingManager.connect(user).deposit(poolId, halfDepositAmount);
        await time.increaseTo(currentTime + userEntryDelay * i);
      }

      console.log("First 10 users deposit twice in the middle of the staking period.");
      for (let i = 1; i <= 10; i++) {
        const user = signers[i];

        expect(await stakingManager.connect(user).deposit(poolId, halfDepositAmount)).to.not.be.reverted;
      }

      const totalStaked = await stakingManager.getTotalStakedForPool(poolId);
      const expectedTotalStaked = halfDepositAmount * BigInt(totalUsers) + BigInt(10) * halfDepositAmount;
      expect(totalStaked).equal(expectedTotalStaked);

      currentTime = await time.latest();
      await time.increaseTo(currentTime + DAY_IN_SECONDS * 30);

      console.log("Half of the users withdraw their stakes.");
      for (let i = 1; i <= totalUsers / 2; i++) {
        const user = signers[i];
        expect(await stakingManager.connect(user).withdraw(stakeId)).to.not.be.reverted;
      }

      // Simulate passing time when the staking period has ended
      const poolDuration = await stakingConfigurator.getPoolDuration(poolId);
      await time.increaseTo(endTime + poolDuration);

      console.log("Check rewards for the remaining users and their deposits.");
      for (let i = 1; i <= totalUsers; i++) {
        const user = signers[i];
        const stakes = await stakingManager.getUserStakes(user);
        const rewards = await stakingManager.getRewardsForAllStakes(user);

        expect(rewards).to.be.gt(0);

        if (i <= 10) {
          // First 10 users should have their second deposit still active
          expect(stakes[0].status).to.be.equal(WITHDRAWN_STATUS);
          expect(stakes[1].status).to.be.equal(DEPOSITED_STATUS);
        } else if (i <= totalUsers / 2) {
          // Users from 10 to 50 have their stakes withdrawn
          expect(stakes[0].status).to.be.equal(WITHDRAWN_STATUS);
        } else {
          // Remaining users have their stakes active
          expect(stakes[0].status).to.be.equal(DEPOSITED_STATUS);
        }
      }

      console.log("Remaining users withdraw their stakes.");
      for (let i = 1; i <= totalUsers; i++) {
        const user = signers[i];

        if (i <= 10) {
          expect(await stakingManager.connect(user).withdraw(1)).to.not.be.reverted;
        } else if (i > totalUsers / 2) {
          expect(await stakingManager.connect(user).withdraw(stakeId)).to.not.be.reverted;
        }
      }

      console.log("Expect each user balance to be greater than initial balance.");
      for (let i = 1; i <= totalUsers; i++) {
        const user = signers[i];
        const balance = await token.balanceOf(user);
        expect(balance).to.be.gt(depositAmount);
      }

      console.log("Ensure no more active stakes in the pool.");
      for (let i = 1; i <= totalUsers; i++) {
        const user = signers[i];
        const stakes = await stakingManager.getUserStakes(user);
        stakes.forEach((stake) => expect(stake.status).to.be.equal(WITHDRAWN_STATUS));
      }

      console.log("Ensure all rewards have been distributed.");
      const poolRewards = await stakingRewardsManager.getPoolRewards(poolId);
      expect(poolRewards.totalAmount - poolRewards.claimedAmount).to.be.closeTo(BigInt(0), BigInt(100));
    }).timeout(60000);
  });
});

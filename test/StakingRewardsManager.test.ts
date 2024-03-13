import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SnailBrook, StakingConfigurator, StakingRewardsManager } from "../typechain-types";
import { snailTokenDeployer, stakingConfiguratorDeployer, stakingRewardsManagerDeployer } from "./config";

describe("StakingRewardsManager", function () {
  let snailToken: SnailBrook;
  let stakingRewardsManager: StakingRewardsManager;
  let stakingConfigurator: StakingConfigurator;
  let owner: HardhatEthersSigner, rewardsManager: HardhatEthersSigner, unauthorizedUser: HardhatEthersSigner;

  beforeEach(async function () {
    stakingConfigurator = await stakingConfiguratorDeployer({
      pools: [{ duration: 20_000 }, { duration: 30_000 }],
    });

    [snailToken, owner, rewardsManager, unauthorizedUser] = await snailTokenDeployer();
    stakingRewardsManager = await stakingRewardsManagerDeployer(snailToken, stakingConfigurator);

    await snailToken.connect(owner).approve(stakingRewardsManager, 1000);
    await stakingRewardsManager.grantRole(await stakingRewardsManager.DEFAULT_ADMIN_ROLE(), owner);
    await stakingRewardsManager.grantRole(
      await stakingRewardsManager.REWARDS_CLAIM_MANAGER_ROLE(),
      rewardsManager.address,
    );
  });

  describe("Deployment", function () {
    it("should correctly set initial state after deployment", async function () {
      expect(await stakingRewardsManager.token()).to.equal(snailToken);

      const defaultAdminRole = await stakingRewardsManager.DEFAULT_ADMIN_ROLE();
      expect(await stakingRewardsManager.hasRole(defaultAdminRole, owner)).to.be.true;
    });
  });

  describe("Access Control", function () {
    it("should prevent unauthorized access to depositRewards", async function () {
      await expect(
        stakingRewardsManager.connect(unauthorizedUser).depositRewards(owner, 1, 1000),
      ).to.be.revertedWithCustomError(stakingRewardsManager, "AccessControlUnauthorizedAccount");
    });

    it("should allow admin to depositRewards", async function () {
      await expect(snailToken.balanceOf(owner.address)).to.eventually.be.gte(1000);
      await expect(stakingRewardsManager.connect(owner).depositRewards(owner, 1, 1000)).not.to.be.reverted;
    });

    it("should prevent unauthorized access to claimRewards", async function () {
      await expect(
        stakingRewardsManager.connect(unauthorizedUser).claimRewards(rewardsManager.address, 1, 100),
      ).to.be.revertedWithCustomError(stakingRewardsManager, "AccessControlUnauthorizedAccount");
    });

    it("should allow rewardsManager to claimRewards", async function () {
      await expect(snailToken.balanceOf(owner.address)).to.eventually.be.gte(1000);

      // Assuming some rewards have been deposited to the pool beforehand
      await stakingRewardsManager.connect(owner).depositRewards(owner, 1, 1000);
      await expect(stakingRewardsManager.connect(rewardsManager).claimRewards(rewardsManager.address, 1, 100)).not.to.be
        .reverted;
    });
  });

  describe("Deposit and Claim", function () {
    it("should deposit rewards successfully", async function () {
      await expect(stakingRewardsManager.connect(owner).depositRewards(owner, 1, 1000)).to.be.not.reverted;
      const poolRewards = await stakingRewardsManager.getPoolRewards(1);
      expect(poolRewards.totalAmount).to.equal(1000);
    });

    it("should claim rewards successfully", async function () {
      await stakingRewardsManager.connect(owner).depositRewards(owner, 1, 1000);
      await expect(stakingRewardsManager.connect(rewardsManager).claimRewards(rewardsManager, 1, 500)).to.be.not
        .reverted;
      const poolRewards = await stakingRewardsManager.getPoolRewards(1);
      expect(poolRewards.totalAmount - poolRewards.claimedAmount).to.equal(500);
    });

    it("should revert when depositing zero amount", async function () {
      await expect(stakingRewardsManager.connect(owner).depositRewards(owner, 1, 0)).to.be.revertedWith(
        "Amount must be greater than zero",
      );
    });

    it("should revert when claiming zero amount", async function () {
      await stakingRewardsManager.connect(owner).depositRewards(owner, 1, 1000);

      await expect(
        stakingRewardsManager.connect(rewardsManager).claimRewards(rewardsManager.address, 1, 0),
      ).to.be.revertedWith("Amount must be greater than zero");
    });

    it("should revert when depositing rewards to a non-existing pool", async function () {
      const nonExistingPoolId = 255; // Assuming this pool ID does not exist, shall be less than 255 (uint8)

      await expect(
        stakingRewardsManager.connect(owner).depositRewards(owner, nonExistingPoolId, 1000),
      ).to.be.revertedWith("Staking pool not exists");
    });

    it("should revert when claiming rewards from a non-existing pool", async function () {
      const nonExistingPoolId = 255; // Assuming this pool ID does not exist, shall be less than 255 (uint8)

      await expect(
        stakingRewardsManager.connect(rewardsManager).claimRewards(rewardsManager.address, nonExistingPoolId, 500),
      ).to.be.revertedWith("Staking pool not exists");
    });

    it("should revert when claiming more than available", async function () {
      await stakingRewardsManager.connect(owner).depositRewards(owner, 1, 500);

      // Attempt to claim more than deposited
      await expect(
        stakingRewardsManager.connect(rewardsManager).claimRewards(rewardsManager.address, 1, 1000),
      ).to.be.revertedWith("No rewards available to claim for the pool");
    });
  });

  describe("Claim Rewards Decreases Pool Amount", function () {
    it("pool rewards amount should decrease after rewards are claimed", async function () {
      const poolId = 1;
      const depositAmount = ethers.parseEther("100");
      const claimAmount = ethers.parseEther("40");

      // Deposit rewards into the pool
      await snailToken.connect(owner).approve(stakingRewardsManager, depositAmount);
      await stakingRewardsManager.connect(owner).depositRewards(owner, poolId, depositAmount);

      // Check initial pool rewards amount
      const poolRewards = await stakingRewardsManager.getPoolRewards(poolId);
      expect(poolRewards.totalAmount).to.equal(depositAmount);

      // Claim a portion of the rewards
      await stakingRewardsManager.connect(rewardsManager).claimRewards(unauthorizedUser, poolId, claimAmount);

      // Check the pool rewards amount after the claim
      const finalPoolRewards = await stakingRewardsManager.getPoolRewards(poolId);
      const rewardsLeft = finalPoolRewards.totalAmount - finalPoolRewards.claimedAmount;
      expect(rewardsLeft).to.equal(depositAmount - claimAmount);

      // Verify the final pool amount is less than the initial amount by the claimed amount
      expect(rewardsLeft).to.be.lt(poolRewards.totalAmount);
      expect(rewardsLeft + claimAmount).to.equal(poolRewards.totalAmount);
    });
  });
});

import { expect } from "chai";
import { ethers } from "hardhat";
import { stakingConfiguratorDeployer } from "./config";
import { StakingConfigurator } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("StakingConfigurator", function () {
  let stakingConfigurator: StakingConfigurator;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    stakingConfigurator = await stakingConfiguratorDeployer();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await stakingConfigurator.owner()).to.equal(owner.address);
    });

    it("Should have no staking pools initially", async function () {
      expect(await stakingConfigurator.getPoolsCount()).to.equal(0);
    });

    it("Should have no start and end time initially", async function () {
      expect(await stakingConfigurator.getStartTime()).to.equal(0);
      expect(await stakingConfigurator.getEndTime()).to.equal(0);
    });
  });

  describe("setStakingPeriod", function () {
    let currentTime: number;

    beforeEach(async function () {
      const latestTime = await time.latest();
      currentTime = latestTime + 100;
    });

    it("Sets start and end time correctly", async function () {
      await stakingConfigurator.setStakingPeriod(currentTime + 100, currentTime + 1000);
      expect(await stakingConfigurator.getStartTime()).to.equal(currentTime + 100);
      expect(await stakingConfigurator.getEndTime()).to.equal(currentTime + 1000);
    });

    it("Reverts if period already set", async function () {
      await stakingConfigurator.setStakingPeriod(currentTime + 100, currentTime + 1000);
      await expect(stakingConfigurator.setStakingPeriod(currentTime + 200, currentTime + 1100)).to.be.revertedWith(
        "Period already set",
      );
    });

    it("Reverts if finish time is before start time", async function () {
      await expect(stakingConfigurator.setStakingPeriod(currentTime + 1000, currentTime + 100)).to.be.revertedWith(
        "Finish time must be after start time",
      );
    });

    it("Reverts if start time is in the past", async function () {
      await expect(stakingConfigurator.setStakingPeriod(currentTime - 100, currentTime + 1000)).to.be.revertedWith(
        "Invalid start time - from past",
      );
    });

    it("Reverts when called by a non-owner", async function () {
      await expect(
        stakingConfigurator.connect(user1).setStakingPeriod(currentTime + 100, currentTime + 1000),
      ).to.be.revertedWithCustomError(stakingConfigurator, `OwnableUnauthorizedAccount`);
    });
  });

  describe("addStakingPool", function () {
    it("Allows the owner to add a staking pool with valid duration", async function () {
      await stakingConfigurator.addStakingPool(86400); // Adding a pool with a 1-day duration
      expect(await stakingConfigurator.getPoolsCount()).to.equal(1);
      const poolDuration = await stakingConfigurator.getPoolDuration(0);
      expect(poolDuration).to.equal(86400);
    });

    it("Reverts if duration is zero", async function () {
      await expect(stakingConfigurator.addStakingPool(0)).to.be.revertedWith("Duration must be greater than zero");
    });

    it("Reverts when called by a non-owner", async function () {
      // Trying to add a pool with addr1, which is not the owner
      await expect(stakingConfigurator.connect(user1).addStakingPool(86400)).to.be.revertedWithCustomError(
        stakingConfigurator,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("getPoolDuration and isPoolExist", function () {
    beforeEach(async function () {
      // Add a pool for testing
      await stakingConfigurator.addStakingPool(86400);
    });

    it("Correctly reports existing pools", async function () {
      expect(await stakingConfigurator.isPoolExist(0)).to.be.true;
    });

    it("Correctly reports non-existing pools", async function () {
      expect(await stakingConfigurator.isPoolExist(1)).to.be.false; // No second pool added, should be false
    });

    it("Reverts when querying duration for a non-existing pool", async function () {
      await expect(stakingConfigurator.getPoolDuration(1)).to.be.revertedWith("Pool does not exist");
    });
  });

  describe("Comprehensive Scenarios", function () {
    let currentTime: number;

    beforeEach(async function () {
      const latestTime = await time.latest();
      currentTime = latestTime + 100;
    });

    it("Allows adding pools after the staking period has started", async function () {
      await stakingConfigurator.setStakingPeriod(currentTime, currentTime + 10_000);
      await time.increaseTo(currentTime + 2000);

      await expect(stakingConfigurator.addStakingPool(86400)).to.not.be.reverted;
    });

    it("Allows adding pools before the staking period has started", async function () {
      await stakingConfigurator.setStakingPeriod(currentTime + 1000, currentTime + 2000);

      await expect(stakingConfigurator.addStakingPool(86400)).not.to.be.reverted;
      expect(await stakingConfigurator.getPoolsCount()).to.equal(1);
    });
  });
});

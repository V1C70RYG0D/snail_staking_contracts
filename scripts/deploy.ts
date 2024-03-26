import { ethers, network } from "hardhat";
import { getDeploymentConfig } from "./helpers/env";
import { deployAndVerify, deploySnailToken } from "./helpers/deployer";
import { addStakingPool, approveAndDepositRewards, setPoolPearlMultiplier, setStakingPeriod } from "./helpers/tx";
import { PearlPointsCalculator, StakingConfigurator, StakingManager, StakingRewardsManager } from "../typechain-types";

export async function main() {
  const chainId = network.config.chainId!;
  const config = getDeploymentConfig(chainId);

  // Get or deploy Snail Token
  let snailTokenAddress = config.snailTokenAddress;
  if (!snailTokenAddress) {
    const snailTokenContract = await deploySnailToken();
    snailTokenAddress = await snailTokenContract.getAddress();
  }

  // Get the token owner
  const deployer = (await ethers.getSigners())[0];

  // Deploy and verify StakingConfigurator
  const stakingConfigurator = await deployAndVerify<StakingConfigurator>("StakingConfigurator", []);
  const stakingConfiguratorAddress = await stakingConfigurator.getAddress();

  // Deploy and verify StakingRewardsManager
  const stakingRewardsManager = await deployAndVerify<StakingRewardsManager>("StakingRewardsManager", [
    snailTokenAddress,
    stakingConfiguratorAddress,
  ]);
  const stakingRewardsManagerAddress = await stakingRewardsManager.getAddress();

  // Deploy and verify StakingManager
  const stakingManager = await deployAndVerify<StakingManager>("StakingManager", [
    snailTokenAddress,
    stakingConfiguratorAddress,
    stakingRewardsManagerAddress,
  ]);
  const stakingManagerAddress = await stakingManager.getAddress();

  // Granting the claim manager role for stakingManager
  const claimRole = await stakingRewardsManager.REWARDS_CLAIM_MANAGER_ROLE();
  await stakingRewardsManager.grantRole(claimRole, stakingManager);

  // Burning the administrator role for stakingRewardsManager
  const adminRole = await stakingRewardsManager.DEFAULT_ADMIN_ROLE();
  await stakingRewardsManager.grantRole(adminRole, "0x0000000000000000000000000000000000000000");

  // Deploy and verify PearlPointsCalculator
  const pearlPointsCalculator = await deployAndVerify<PearlPointsCalculator>("PearlPointsCalculator", [
    stakingManagerAddress,
  ]);

  // Add staking pools
  for (const pool of config.stakingPools) {
    const poolId = await addStakingPool(stakingConfigurator, pool.duration, deployer);
    await setPoolPearlMultiplier(pearlPointsCalculator, poolId, pool.pearlMultiplier, deployer);
    await approveAndDepositRewards(snailTokenAddress, stakingRewardsManager, poolId, pool.rewards, deployer);
  }

  // Set the staking period
  await setStakingPeriod(stakingConfigurator, config.timeStart, config.timeEnd, deployer);

  console.log("\nDeployment completed!");
  console.log("Snail Token:", snailTokenAddress);
  console.log("StakingConfigurator:", stakingConfiguratorAddress);
  console.log("StakingRewardsManager:", stakingRewardsManagerAddress);
  console.log("StakingManager:", stakingManagerAddress);
  console.log("PearlPointsCalculator:", await pearlPointsCalculator.getAddress());
}

main().catch((error) => {
  console.error("Error in main:", error);
  process.exitCode = 1;
});

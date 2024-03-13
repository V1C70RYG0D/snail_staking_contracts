import { ethers } from "hardhat";
import { PearlPointsCalculator, StakingManager } from "../../typechain-types";

export async function pearlPointsCalculatorDeployer(stakingManager: StakingManager): Promise<PearlPointsCalculator> {
  return ethers.deployContract("PearlPointsCalculator", [stakingManager]) as never as PearlPointsCalculator;
}

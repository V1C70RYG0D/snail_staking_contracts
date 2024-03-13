import { ethers } from "hardhat";
import { StakingConfigurator } from "../../typechain-types";

type StakingPool = {
  duration: number;
};

type StakingConfiguratorParams = {
  pools: StakingPool[];
  startTime: number;
  endTime: number;
};

export async function stakingConfiguratorDeployer(
  params?: Partial<StakingConfiguratorParams>,
): Promise<StakingConfigurator> {
  const stakingConfigurator = (await ethers.deployContract("StakingConfigurator", [])) as never as StakingConfigurator;

  if (params) {
    if (params.startTime && params.endTime) {
      await stakingConfigurator.setStakingPeriod(params.startTime, params.endTime);
    }

    if (params.pools) {
      for await (const pool of params.pools) {
        await stakingConfigurator.addStakingPool(pool.duration);
      }
    }
  }

  return stakingConfigurator;
}

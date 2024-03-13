import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SnailBrook, StakingConfigurator, StakingManager, StakingRewardsManager } from "../../typechain-types";

export enum StakingOperation {
  Deposit,
  Withdraw,
}

type UserStakeAction = {
  timeDelay: number;
  user: HardhatEthersSigner;
} & (
  | {
      operation: StakingOperation.Deposit;
      poolId: number;
      amount: number | bigint;
    }
  | {
      operation: StakingOperation.Withdraw;
      stakeId: number;
    }
);

type StakingManagerParams = {
  actions: UserStakeAction[];
};

export async function stakingManagerDeployer(
  snailToken: SnailBrook,
  stakingConfigurator: StakingConfigurator,
  stakingRewardsManager: StakingRewardsManager,
  params?: StakingManagerParams,
): Promise<StakingManager> {
  const stakingManager = (await ethers.deployContract("StakingManager", [
    snailToken,
    stakingConfigurator,
    stakingRewardsManager,
  ])) as never as StakingManager;
  await stakingRewardsManager.grantRole(await stakingRewardsManager.REWARDS_CLAIM_MANAGER_ROLE(), stakingManager);

  const startTime = await stakingConfigurator.getStartTime();

  const groupedActions = params?.actions.reduce(
    (acc, act) => {
      if (!acc[act.timeDelay]) {
        acc[act.timeDelay] = [];
      }
      acc[act.timeDelay].push(act);
      return acc;
    },
    {} as Record<number, UserStakeAction[]>,
  );

  if (groupedActions) {
    for await (const actions of Object.values(groupedActions)) {
      const firstAction = actions[0];
      const timestamp = startTime + BigInt(firstAction.timeDelay);
      await time.increaseTo(timestamp);

      for await (const action of actions.filter((a) => a.operation === StakingOperation.Deposit)) {
        const act = action as UserStakeAction & {
          operation: StakingOperation.Deposit;
        };
        await snailToken.connect(act.user).approve(stakingManager, act.amount);
        await stakingManager.connect(act.user).deposit(act.poolId, act.amount);
      }

      for await (const action of actions.filter((a) => a.operation === StakingOperation.Withdraw)) {
        const act = action as UserStakeAction & {
          operation: StakingOperation.Withdraw;
        };
        await stakingManager.connect(act.user).withdraw(act.stakeId);
      }
    }
  }

  return stakingManager;
}

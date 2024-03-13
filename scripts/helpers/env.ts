import deploymentConfig from "./../../envConfig.json";

type PoolConfig = {
  duration: number;
  rewards: number;
  pearlMultiplier: number;
};

export type DeploymentConfig = {
  snailTokenAddress: string;
  timeStart: number;
  timeEnd: number;
  stakingPools: PoolConfig[];
};

export function getDeploymentConfig(chainId: number): DeploymentConfig {
  const MAINNET_CHAIN_ID = 1;
  const defaultConfig = deploymentConfig as never as DeploymentConfig;

  switch (chainId) {
    case MAINNET_CHAIN_ID:
      return {
        ...defaultConfig,
        snailTokenAddress: deploymentConfig.snailMainNetTokenAddress,
      };
    default:
      return defaultConfig;
  }
}

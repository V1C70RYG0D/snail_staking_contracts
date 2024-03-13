import "solidity-coverage";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-toolbox";
import deploymentConfig from "./envConfig.json";
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  etherscan: {
    apiKey: deploymentConfig.etherscanApiKey,
  },

  networks: {
    sepolia_testnet: {
      accounts: deploymentConfig.deployerPrivateKey ? [deploymentConfig.deployerPrivateKey] : [],
      chainId: 11155111,
      url: `https://rpc.sepolia.org`,
    },
    goerli_testnet: {
      accounts: deploymentConfig.deployerPrivateKey ? [deploymentConfig.deployerPrivateKey] : [],
      chainId: 5,
      url: `https://goerli.gateway.tenderly.co`,
    },
    hardhat: {
      accounts: {
        count: 101,
      },
    },
  },

  solidity: {
    compilers: [
      {
        version: "0.8.24",
      },
    ],
  },

  contractSizer: {
    runOnCompile: true,
  },

  gasReporter: {
    enabled: true,
    coinmarketcap: deploymentConfig.coinmarketcapApiKey,
  },

  sourcify: {
    enabled: true,
  },
};

export default config;

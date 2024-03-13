// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.24;

import "../structs/UserStake.sol";

interface IStakingManager {
    event Deposited(address indexed staker, uint8 indexed poolId, uint256 indexed stakeId, uint256 amount);
    event Withdrawn(address indexed staker, uint256 indexed stakeId, uint256 amount, uint256 rewardsAmount);

    function deposit(uint8 poolId, uint256 amount) external;
    function withdraw(uint256 stakeId) external;
    function getTotalStakedForPool(uint8 poolId) external view returns (uint256);
    function getTotalStaked() external view returns (uint256);
    function getPoolAPY(uint8 poolId) external view returns (uint256);
    function getUserStakes(address staker) external view returns (UserStake[] memory);
    function getUserStake(address staker, uint256 stakeId) external view returns (UserStake memory);
    function getRewardsForStake(address staker, uint256 stakeId) external view returns (uint256);
    function getRewardsForAllStakes(address staker) external view returns (uint256);
}

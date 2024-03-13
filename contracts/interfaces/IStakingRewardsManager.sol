// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.24;

import "../structs/PoolRewards.sol";

interface IStakingRewardsManager {
    function depositRewards(address from, uint8 poolId, uint256 amount) external;
    function claimRewards(address to, uint8 poolId, uint256 amount) external;
    function getPoolRewards(uint8 poolId) external view returns (PoolRewards memory);
}

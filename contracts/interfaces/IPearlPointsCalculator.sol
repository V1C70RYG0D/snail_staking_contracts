// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.24;

interface IPearlPointsCalculator {
    function setPoolPearlMultiplier(uint8 poolId, uint16 multiplier) external;
    function getPearlPointsForStake(address staker, uint256 stakeId) external view returns (uint256);
    function getTotalPearlPointsForStaker(address staker) external view returns (uint256);
}

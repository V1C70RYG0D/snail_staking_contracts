// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.24;

import "./interfaces/IStakingManager.sol";
import "./interfaces/IPearlPointsCalculator.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

contract PearlPointsCalculator is IPearlPointsCalculator, Ownable {
    
    IStakingManager private immutable stakingManager;
    mapping(uint8 => uint16) private poolPearlMultipliers;
    
    uint16 private constant pearlPointCoefficient = 1000;
    
    constructor(IStakingManager _stakingManager) Ownable(msg.sender) {
        stakingManager = _stakingManager;
    }
    
    function setPoolPearlMultiplier(uint8 poolId, uint16 multiplier) external onlyOwner {
        require(poolPearlMultipliers[poolId] == 0, "Pool multiplier already initialized");
        require(multiplier >= 100, "Must be grater than 100");
        poolPearlMultipliers[poolId] = multiplier;
    }

    function getPearlPointsForStake(address staker, uint256 stakeId) public view returns (uint256) {
        UserStake memory userStake = stakingManager.getUserStake(staker, stakeId);
        uint16 poolPearlMultiplier = poolPearlMultipliers[userStake.poolId];

        if (userStake.status == StakingStatus.Withdrawn || poolPearlMultiplier == 0) {
            return 0;
        }

        uint256 scaledAmount = userStake.amount * poolPearlMultiplier * 1e18;
        uint256 pearlPoints = scaledAmount / pearlPointCoefficient;

        return pearlPoints / 1e20;
    }


    function getTotalPearlPointsForStaker(address staker) external view returns (uint256) {
        uint256 totalPearlPoints = 0;
        UserStake[] memory stakes = stakingManager.getUserStakes(staker);

        for(uint256 stakeId = 0 ; stakeId < stakes.length ; stakeId++) {
            totalPearlPoints += getPearlPointsForStake(staker, stakeId);
        }

        return totalPearlPoints;
    }
}

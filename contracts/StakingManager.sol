// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.24;

import "./interfaces/IStakingConfigurator.sol";
import "./interfaces/IStakingManager.sol";
import "./interfaces/IStakingRewardsManager.sol";

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./structs/StakingInterval.sol";
import "./structs/UserStake.sol";

contract StakingManager is IStakingManager, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 private immutable token;

    uint16 private constant intervalDuration = 10000;

    IStakingConfigurator private immutable configurator;
    IStakingRewardsManager private immutable rewardsManager;

    mapping(address => UserStake[]) private userStakes;
    mapping(uint8 => StakingInterval[]) private poolStakingIntervals;

    constructor(IERC20 _token, IStakingConfigurator _configurator, IStakingRewardsManager _rewardsManager) {
        token = _token;
        configurator = _configurator;
        rewardsManager = _rewardsManager;
    }

    function deposit(uint8 poolId, uint256 amount) external nonReentrant {
        require(amount > 0, "Staking amount must be greater than zero");
        require(configurator.isPoolExist(poolId), "Invalid pool ID");

        uint256 currentIntervalTimestamp = _getCurrentIntervalTimestamp();

        StakingInterval memory latestStakingIntervals = _getLastStakingInterval(poolId);
        if (latestStakingIntervals.timestamp != currentIntervalTimestamp) {
            poolStakingIntervals[poolId].push(StakingInterval(currentIntervalTimestamp, amount, 0));
        }
        else {
            latestStakingIntervals.depositAmount += amount;
            poolStakingIntervals[poolId][poolStakingIntervals[poolId].length - 1] = latestStakingIntervals;
        }

        userStakes[msg.sender].push(UserStake(amount, currentIntervalTimestamp, poolId, StakingStatus.Deposited));
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(msg.sender, poolId, userStakes[msg.sender].length - 1, amount);
    }

    function withdraw(uint256 stakeId) public nonReentrant {
        require(stakeId < userStakes[msg.sender].length, "Stake does not exist");
        UserStake storage stake = userStakes[msg.sender][stakeId];

        require(stake.status != StakingStatus.Withdrawn, "Stake is already withdrawn");

        uint256 currentIntervalTimestamp = _getCurrentIntervalTimestamp();
        uint256 poolDuration = configurator.getPoolDuration(stake.poolId);
        require(currentIntervalTimestamp > stake.timestamp + poolDuration, "Withdraw not yet available");

        uint256 rewardsAmount = getRewardsForStake(msg.sender, stakeId);

        StakingInterval memory latestStakingIntervals = _getLastStakingInterval(stake.poolId);
        if (latestStakingIntervals.timestamp != currentIntervalTimestamp) {
            poolStakingIntervals[stake.poolId].push(StakingInterval(currentIntervalTimestamp, 0, stake.amount));
        } else {
            latestStakingIntervals.withdrawalAmount += stake.amount;
            poolStakingIntervals[stake.poolId][poolStakingIntervals[stake.poolId].length - 1] = latestStakingIntervals;
        }

        rewardsManager.claimRewards(msg.sender, stake.poolId, rewardsAmount);
        token.safeTransfer(msg.sender, stake.amount);

        stake.status = StakingStatus.Withdrawn;

        emit Withdrawn(msg.sender, stakeId, stake.amount, rewardsAmount);
    }

    function getTotalStakedForPool(uint8 poolId) public view returns (uint256) {
        uint256 totalStaked = 0;
        StakingInterval[] memory poolIntervals = poolStakingIntervals[poolId];
        for (uint256 i = 0; i < poolIntervals.length; i++) {
            StakingInterval memory stakeInterval = poolIntervals[i];

            totalStaked += stakeInterval.depositAmount;
            totalStaked -= stakeInterval.withdrawalAmount;
        }
        return totalStaked;
    }

    function getTotalStaked() external view returns (uint256) {
        uint256 totalStaked = 0;
        uint8 poolsCount = configurator.getPoolsCount();
        for (uint8 poolId = 0; poolId < poolsCount; poolId++) {
            totalStaked += getTotalStakedForPool(poolId);
        }
        return totalStaked;
    }

    function getPoolAPY(uint8 poolId) external view returns (uint256) {
        uint256 tokensStaked = getTotalStakedForPool(poolId);
        uint256 stakingDuration = configurator.getEndTime() - configurator.getStartTime();

        if (tokensStaked == 0) {
            return 0;
        }

        PoolRewards memory poolRewards = rewardsManager.getPoolRewards(poolId);

        // Calculate APY using fixed-point arithmetic
        // We scale up the calculation by a factor of 1e18 to handle decimal points more accurately
        // Remember to adjust the scale of `stakingDuration` as well, converting seconds to days then to years
        uint256 scaledTotalAmount = poolRewards.totalAmount * 1e18;
        uint256 apy = (scaledTotalAmount * 365 * 24 * 3600) / (tokensStaked * stakingDuration);

        // Convert APY back to a more readable format, reducing the scale back down
        // This step depends on how you want your APY to be represented
        // For a percentage representation, you might want to scale down by 1e16 (to adjust for the 1e18 scale and get a percent)
        return apy / 1e16;
    }

    function getUserStakes(address staker) external view returns (UserStake[] memory) {
        return userStakes[staker];
    }

    function getUserStake(address staker, uint256 stakeId) external view returns (UserStake memory) {
        require(stakeId < userStakes[staker].length, "Stake does not exist");
        return userStakes[staker][stakeId];
    }

    function getRewardsForStake(address staker, uint256 stakeId) public view returns (uint256) {
        require(stakeId < userStakes[staker].length, "Stake does not exist");
        UserStake memory stake = userStakes[staker][stakeId];

        uint256 totalDepositAmount = 0;
        uint256 rewardsAmount = 0;
        StakingInterval[] memory poolIntervals = poolStakingIntervals[stake.poolId];

        uint256 prevStakingIntervalTimestamp = configurator.getStartTime();
        PoolRewards memory poolRewards = rewardsManager.getPoolRewards(stake.poolId);

        // scale up by 1e18 to handle decimal points more accurately
        uint256 totalRewardsAmount = poolRewards.totalAmount * 1e18;
        uint256 rewardsPerSecond = totalRewardsAmount / (configurator.getEndTime() - configurator.getStartTime());

        for (uint256 i = 0; i < poolIntervals.length; i++) {
            StakingInterval memory stakeInterval = poolIntervals[i];

            if (stakeInterval.timestamp > stake.timestamp) {
                uint256 totalForInterval = rewardsPerSecond * (stakeInterval.timestamp - prevStakingIntervalTimestamp);
                rewardsAmount += stake.amount * totalForInterval / totalDepositAmount;
            }

            totalDepositAmount += stakeInterval.depositAmount;
            totalDepositAmount -= stakeInterval.withdrawalAmount;

            prevStakingIntervalTimestamp = stakeInterval.timestamp;
        }

        uint256 poolDuration = configurator.getPoolDuration(stake.poolId);
        bool canWithdraw = stake.timestamp + poolDuration < block.timestamp;

        if (canWithdraw) {
            uint256 currentIntervalTimestamp = _getCurrentIntervalTimestamp();
            uint256 lastTokens = rewardsPerSecond * (currentIntervalTimestamp - prevStakingIntervalTimestamp);
            rewardsAmount += stake.amount * lastTokens / totalDepositAmount;
        } else {
            uint256 lastTokens = rewardsPerSecond * (block.timestamp - prevStakingIntervalTimestamp);
            rewardsAmount += stake.amount * rewardsPerSecond * lastTokens / totalDepositAmount;
        }

        // convert rewards precision back
        return rewardsAmount / 1e18;
    }

    function getRewardsForAllStakes(address staker) external view returns (uint256) {
        uint256 totalRewards = 0;
        for (uint256 stakeId = 0; stakeId < userStakes[staker].length; stakeId++) {
            totalRewards += getRewardsForStake(staker, stakeId);
        }

        return totalRewards;
    }

    function _getCurrentIntervalTimestamp() private view returns (uint256) {
        uint256 timeStamp = block.timestamp / intervalDuration * intervalDuration;

        if (timeStamp < configurator.getStartTime()) {
            timeStamp = configurator.getStartTime();
        }
        else if (timeStamp > configurator.getEndTime()) {
            timeStamp = configurator.getEndTime();
        }

        return timeStamp;
    }

    function _getLastStakingInterval(uint8 poolId) private returns (StakingInterval memory) {
        if (poolStakingIntervals[poolId].length == 0) {
            poolStakingIntervals[poolId].push(StakingInterval(_getCurrentIntervalTimestamp(), 0, 0));
        }
        return poolStakingIntervals[poolId][poolStakingIntervals[poolId].length - 1];
    }
}

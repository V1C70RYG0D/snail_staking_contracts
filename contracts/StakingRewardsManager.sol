// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.24;

import "./interfaces/IStakingRewardsManager.sol";
import "./interfaces/IStakingConfigurator.sol";
import "./structs/PoolRewards.sol";

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakingRewardsManager is IStakingRewardsManager, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable token;
    IStakingConfigurator private immutable configurator;

    bytes32 public constant REWARDS_DEPOSIT_MANAGER_ROLE = keccak256("REWARDS_DEPOSIT_MANAGER_ROLE");
    bytes32 public constant REWARDS_CLAIM_MANAGER_ROLE = keccak256("REWARDS_CLAIM_MANAGER_ROLE");

    mapping(uint8 => PoolRewards) private poolRewards;

    constructor(IERC20 _token, IStakingConfigurator _configurator) {
        token = _token;
        configurator = _configurator;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REWARDS_DEPOSIT_MANAGER_ROLE, msg.sender);
    }
    
    function depositRewards(address from, uint8 poolId, uint256 amount) external nonReentrant onlyRole(REWARDS_DEPOSIT_MANAGER_ROLE) {
        require(amount > 0, "Amount must be greater than zero");
        require(configurator.isPoolExist(poolId), "Staking pool not exists");
        require(poolRewards[poolId].totalAmount == 0, "Pool already has rewards deposited");

        poolRewards[poolId].totalAmount = amount;
        token.safeTransferFrom(from, address(this), amount);
    }
    
    function claimRewards(address to, uint8 poolId, uint256 amount) external nonReentrant onlyRole(REWARDS_CLAIM_MANAGER_ROLE) {
        require(amount > 0, "Amount must be greater than zero");
        require(configurator.isPoolExist(poolId), "Staking pool not exists");
        require(poolRewards[poolId].totalAmount >= poolRewards[poolId].claimedAmount + amount, "No rewards available to claim for the pool");
        
        token.safeTransfer(to, amount);
        poolRewards[poolId].claimedAmount += amount;
    }
    
    function getPoolRewards(uint8 poolId) external view returns (PoolRewards memory) {
        require(configurator.isPoolExist(poolId), "Staking pool not exists");
        return poolRewards[poolId];
    }
}

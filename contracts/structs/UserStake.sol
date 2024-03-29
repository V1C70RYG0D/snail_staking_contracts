// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.24;
    
enum StakingStatus {Deposited, Withdrawn}

struct UserStake {
    uint256 amount;
    uint8 poolId;
    StakingStatus status;
    uint256 depositTime;
    uint256 withdrawTime;
}

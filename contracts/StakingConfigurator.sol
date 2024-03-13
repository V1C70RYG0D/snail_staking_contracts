// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.24;

import "./interfaces/IStakingConfigurator.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

import "./structs/StakingPool.sol";

contract StakingConfigurator is IStakingConfigurator, Ownable {
    uint256 private startTime;
    uint256 private endTime;
    StakingPool[] private pools;
    
    constructor() Ownable(msg.sender) {}

    function getStartTime() external view returns (uint256) {
        return startTime;
    }
    
    function getEndTime() external view returns (uint256) {
        return endTime;
    }
    
    function getPoolsCount() external view returns (uint8) {
        return uint8(pools.length);
    }
    
    function getPoolDuration(uint8 id) external view returns (uint256) {
        require(isPoolExist(id), "Pool does not exist");
        return pools[id].duration;
    }
    
    function isPoolExist(uint8 id) public view returns (bool) {
        return id < pools.length;
    }
    
    function setStakingPeriod(uint256 start, uint256 finish) external onlyOwner {
        require(startTime == 0 && endTime == 0, "Period already set");
        require(finish > start, "Finish time must be after start time");
        require(start >= block.timestamp, "Invalid start time - from past");
        startTime = start;
        endTime = finish;
    }

    function addStakingPool(uint256 durationTime) external onlyOwner {
        require(durationTime > 0, "Duration must be greater than zero");
        pools.push(StakingPool(durationTime));
    }
}

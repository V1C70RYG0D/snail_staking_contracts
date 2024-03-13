// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.24;

interface IStakingConfigurator {
    function getStartTime() external view returns (uint256);
    function getEndTime() external view returns (uint256);
    function getPoolsCount() external view returns(uint8);
    function getPoolDuration(uint8 id) external view returns (uint256);
    function isPoolExist(uint8 id) external view returns (bool);
    function setStakingPeriod(uint256 start, uint256 finish) external;
    function addStakingPool(uint256 durationTime) external;
}

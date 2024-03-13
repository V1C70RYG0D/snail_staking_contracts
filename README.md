# Snail Staking and Pearl Points System Documentation
## Proposal:
Develop a staking and rewards calculation system for users, allowing them to earn tokens by participating in staking and holding them for a specific period. The system should ensure fair distribution of rewards based on the amount and duration of staking, and should also account for changes in the total deposit and staking activity of other users. Additionally, the system should calculate "Pearl Points" for each user based on their staking activity. 

## Regulations:
* Users can stake SNAIL tokens with rewards in SNAIL, which will be mined for 2 years.
* The total reward for 2 years will be 2.47% of the total SNAIL token supply (2,000,000,000 tokens).
* Users can stake SNAIL with 7 lock-up period options: 30 days, 45 days, 90 days, 180 days, 365 days, 500 days, and 650 days.
* The longer the lock-up period of a pool, the greater the number of rewards allocated from the total pool reserve.
* Users can make deposits at any time.
* Users have no restrictions on the number of stakes, participation in different pools, or the total amount of staking.
* Users can withdraw their deposit and receive rewards at any time after the lock-up period, including after the farming period ends.
* If a user remains in the pool at the end of the lock-up period, they continue to receive rewards until they withdraw or until the end of the 2-year farming period.
* Staking rewards are paid in tokens based on time and the ratio of the user's stake size to the total deposits in the pool.
* Each user's stake affects their Pearl Point balance, which depends on the stake size and pool multiplier.
* Pearl Points are calculated in real-time and only based on the user's active stakes.
* Administrators can configure the farming period, define pools, add rewards to a pool, set the pool's Pearl Point multiplier, but cannot change these settings afterwards.
* Administrators do not have access to stakers funds and cannot manage the reward funds deposited in the pool.

## Technical requirements:
* Contracts are developed using secure Solidity and OpenZeppelin practices.
* All fund and reward actions occur within smart contracts, ensuring security and transparency.
* Smart contract logic should be clear and transparent, and the code should be publicly available. The code should be accompanied by clear documentation that allows easy understanding of the technical solution and ensures its reliability.
* Any technical possibility of theft of user funds must be excluded, and this must be confirmed by independent auditors.
* Contracts can be easily integrated into an application or service that provides full staking process management for the user, provides them with up-to-date information on active pools, lock-up periods, Pearl Point multipliers, and allows them to see their current Pearl Point balance in real-time.


## Smart Contracts Overview:

![uml.jpg](images%2Fuml.jpg)

### StakingConfigurator Contract:
* setStakingPeriod(uint256 start, uint256 finish): Sets the start and end times for staking.
* addStakingPool(uint256 durationTime): Adds a new staking pool with the specified duration.
* getStartTime(): Returns the start time of the staking period.
* getEndTime(): Returns the end time of the staking period.
* getPoolsCount(): Returns the number of staking pools added.
* getPoolDuration(uint8 id): Returns the duration of the specified staking pool.
* isPoolExist(uint8 id): Checks if a staking pool with the specified ID exists.
### StakingRewardsManager Contract:
* depositRewards(address from, uint8 poolId, uint256 amount): Deposits rewards into the specified staking pool.
* claimRewards(address to, uint8 poolId, uint256 amount): Claims rewards from the pool for distribution to stakers.
* getPoolRewards(uint8 poolId): Returns the total and claimed rewards for the specified staking pool.
### StakingManager Contract:
* deposit(uint8 poolId, uint256 amount): Allows a user to deposit tokens into the specified staking pool for staking.
* withdraw(uint256 stakeId): Allows a user to withdraw their staked tokens and claimed rewards from the specified stake.
* getUserStakes(address staker): Returns an array of all stakes for the specified staker.
* getUserStake(address staker, uint256 stakeId): Returns information about the specified stake for the specified staker.
* getRewardsForStake(address staker, uint256 stakeId): Calculates and returns the rewards for the specified stake for the specified staker.
* getTotalStakedForPool(uint8 poolId): Returns the total amount of tokens staked in the specified pool.
* getTotalStaked(): Returns the total amount of tokens staked in all pools.
* getPoolAPY(uint8 poolId): Calculates and returns the Annual Percentage Yield (APY) for the specified pool.
### PearlPointsCalculator Contract:
* setPoolPearlMultiplier(uint8 poolId, uint16 multiplier): Sets the multiplier for calculating Pearl Points for the specified pool.
* getPearlPointsForStake(address staker, uint256 stakeId): Calculates and returns the Pearl Points for the specified stake for the specified staker.
* getTotalPearlPointsForStaker(address staker): Calculates and returns the total Pearl Points for the specified staker.



## Calculations Specifics:

### Staking Rewards Calculation

The system of intervals was used for calculating rewards for each specific user. Intervals in the contract are used to track changes in the stake size and the total amount of stakes in the staking pool. Each interval represents a specific time period during which changes in stakes occurred. These changes may include adding new stakes, increasing or decreasing the stake size, as well as withdrawing stakes. Intervals play a key role in the accurate calculation of staking rewards, taking into account changes in stakes and the total stake volume in the pool.

Intervals influence reward calculation in the following ways:
* Time of stake consideration: Intervals allow for considering how much time has passed since the stake was added until the current moment. This is important for calculating rewards, as staking rewards are distributed proportionally to the time spent staking.
* Total stake volume in the pool consideration: Intervals also allow for considering changes in the total stake volume in the pool. This is important for fairly distributing rewards among all staking participants, considering their contribution to the total pool.
* Acceleration of calculations: Using intervals speeds up reward calculations. Data from intervals allows for quick reward calculations based on changes in stakes over a specific period of time.
* Security: Fixed intervals help avoid potential contract attacks related to memory overflow or abuse with too much data. Since intervals are fixed and managed by the contract, risks associated with them can be minimized.

#### Reward Calculation Case:

Let's consider the following situation as an example: 6 participants of a staking pool start staking at different times (within different intervals) and stay for different durations. Some stakers exit before others enter, some stakers overlap and compete for rewards based on their staking amounts.

![stakingScheme.jpg](images%2FstakingScheme.jpg)

The formulaic calculation of rewards for staker will be calculated according to the following principle:

![rps.jpg](images%2Frps.jpg)

#### Staker 1:

![staker1Rewards.jpg](images%2Fstaker1Rewards.jpg)

This is the formula for calculating the reward for the first staker in the example, who participated in staking during two time periods. The first term takes into account the reward for the first staking period, and the second term represents the additional reward for overlapping with the second staker.

#### Staker 2:

![staker2Rewards.jpg](images%2Fstaker2Rewards.jpg)

This formula considers the partial reward for overlapping with the first staker in the first term, and the full reward for the second staker being alone in the pool during the second period in the second term.

#### Staker 3:

![staker3Rewards.jpg](images%2Fstaker3Rewards.jpg)

This formula calculates the rewards for the third staker over different time intervals, considering the staker's stake amount and its intersections with other stakers in the pool.



### Pearl Points Calculation
The calculation of pearl points in the PearlPointsCalculator contract is based on the user's stake size and the pool multiplier, which is set by the administrator for each pool.
The calculation of pearl points is performed using integer arithmetic to ensure efficiency and avoid floating-point issues. After the calculation, pearl points can be used for various purposes in the Snailbrook system. Pearl points are calculated only based on active stakes.

![pearlPointsCalc.png](images%2FpearlPointsCalc.png)

## Test Coverage:
All 4 contracts have been fully covered by tests (100% line coverage) and cover a wide range of contract usage scenarios.
For more details, you can review the test suite in the /tests folder.

### Coverage Report:
![coverage.jpg](images%2Fcoverage.jpg)


## Installation and Running
* Ensure Node.js and npm are installed on your machine. You can download and install them from the official Node.js website: https://nodejs.org/

* Install project dependencies using npm:
  ````
  npm install
  ````
  
* Compile the Solidity contracts:
  ````
  npx hardhat compile
  ````
  
* Run tests for the contracts:
  ````
  npx hardhat test
  ````
  
* (Optional) Deploy the contracts to a main or test network:

  ````
  npx hardhat run scripts/deploy.ts --network <network-name>
  ````
  Before deployment, you need to review and fill in all the necessary fields in the configuration file (envConfig.json).









		


// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface WBTCI {
    function allowance(address _owner, address _spender) external view returns (uint256);
    function transferFrom(address _from, address _to, uint256 _value) external returns (bool);
    function balanceOf(address _who) external view returns (uint256);
}


contract H24 is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    address public WbtcContract;
    address public WbtcAddress;

    uint64 public lastClaimed; // the last day for which the payment was made to any client

    // we use 64 and 192 bit to "pack" variables into one 256
    struct Miner {
        uint64 date;  // stake minute
        uint192 stake;
    }

    mapping(address => Miner) public miners;

    // reward in WBTC for a steak of one H24 token on this day
    mapping(uint64 => uint) public rewards; // date => amount256


    string constant ERR_NoWBTC = "We run out of WBTC";
    string constant ERR_NoStake = "You need to stake first";
    string constant ERR_CantClaimYet = "You can't claim today";
    string constant ERR_NoRewardSet = "No reward set for previous day";
    string constant ERR_RewardOutBounds = "Reward must be >0 and <1e25";
    string constant ERR_RewardClaimed = "Already claim for this day";
    string constant ERR_AmountGreaterStake = "Amount > stake";
    string constant ERR_NextRewardSet = "Only last reward can be changed";


    event Stake(address indexed addr, int amount);
    event Claim(address indexed addr, uint amount);


    constructor(address _wbtcContract, address _wbtcAddress, address minter, address oracle) ERC20("Hashing24", "H24") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, minter);
        _setupRole(ORACLE_ROLE, oracle);

        WbtcContract = _wbtcContract;
        WbtcAddress = _wbtcAddress;

        rewards[today()-1] = 1;  // set first reward != 0 so now we can use setReward()
    }


    function stake(uint192 amount, bool force) public {
        if (!force && miners[msg.sender].stake != 0 && _canClaim(msg.sender))
            _claim();

        miners[msg.sender].date = uint64(block.timestamp);
        miners[msg.sender].stake += amount;
        _transfer(msg.sender, address(this), amount);
        emit Stake(msg.sender, int(uint(amount)));
    }

    function unstake(uint192 amount, bool force) public {
        require(miners[msg.sender].stake >= amount, ERR_AmountGreaterStake);
        if (!force && _canClaim(msg.sender))
            _claim();

        miners[msg.sender].date = uint64(block.timestamp);
        miners[msg.sender].stake -= amount;
        _transfer(address(this), msg.sender, amount);
        emit Stake(msg.sender, -int(uint(amount)));
    }

    function unstakeAll(bool force) public {
        require(miners[msg.sender].stake > 0, ERR_NoStake);
        if (!force && _canClaim(msg.sender))
            _claim();

        _transfer(address(this), msg.sender, miners[msg.sender].stake);
        emit Stake(msg.sender, -int(uint(miners[msg.sender].stake)));
        delete miners[msg.sender];
    }

    function canUnstake(address addr) public view returns (bool) {
        require(miners[addr].stake > 0, ERR_NoStake);
        if (_canClaim(addr)) return canClaim(addr);
        return true;
    }

    function getStake(address addr) public view returns (uint) {
        return miners[addr].stake;
    }


    function claim() public {
        _claim();
        miners[msg.sender].date = uint64(block.timestamp / 86400 * 86400);  // start of a day
    }

    function _claim() internal {
        uint reward = getUserReward(msg.sender);
        lastClaimed = today();

        try WBTCI(WbtcContract).transferFrom(WbtcAddress, msg.sender, reward) {}
        catch { revert(ERR_NoWBTC); }

        emit Claim(msg.sender, reward);
    }

    function canClaim(address addr) public view returns (bool) {
        uint reward = getUserReward(addr);
        require(
            WBTCI(WbtcContract).balanceOf(WbtcAddress) >= reward &&
            WBTCI(WbtcContract).allowance(WbtcAddress, address(this)) >= reward,
            ERR_NoWBTC
        );
        return true;
    }

    function _canClaim(address addr) internal view returns (bool) {
        // compare whole day here so we can't omit division
        return block.timestamp / 86400 > miners[addr].date / 86400;
    }


    function getUserReward(address addr) public view returns (uint) {
        Miner memory miner = miners[addr];
        uint64 today = today();
        uint64 stakeDay = miner.date / 86400;

        require(today > stakeDay, ERR_CantClaimYet);
        require(miners[addr].stake > 0, ERR_NoStake);
        require(rewards[today-1] != 0, ERR_NoRewardSet);


        return miner.stake * (
            (rewards[today-1] - rewards[stakeDay]) +  // whole day
            (rewards[stakeDay] - rewards[stakeDay-1]) * ((stakeDay+1) * 86400 - miner.date) / 86400  // part of first day
        );

    }


    function setReward(uint24 date, uint amount) public onlyRole(ORACLE_ROLE) {
        require(date > lastClaimed, ERR_RewardClaimed);
        require(rewards[date-1] != 0, ERR_NoRewardSet);
        require(0 < amount && amount <= 1e25, ERR_RewardOutBounds);
        // we will have wrong calculations on next day if change previous day value
        require(rewards[date+1] == 0, ERR_NextRewardSet);

        rewards[date] = rewards[date-1] + amount;
    }

    function getReward(uint24 date) public view returns (uint){
        return rewards[date] - rewards[date-1];
    }


    function setWbtcAddress(address addr) public onlyRole(DEFAULT_ADMIN_ROLE) {
        WbtcAddress = addr;
    }


    function mint(address to, uint amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function today() internal view returns (uint64) {
        return uint24(block.timestamp / 86400);
    }


}

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

    uint24 public lastClaimed; // the last day for which the payment was made to any client

    // we use 24 and 232 bit to "pack" variables into one 256
    struct Miner {
        uint24 date;
        uint232 stake;
    }

    mapping(address => Miner) public miners;

    // reward in WBTC for a steak of one H24 token on this day
    mapping(uint24 => uint) public rewards; // date => amount


    string constant ERR_NoWBTC = "We run out of WBTC";
    string constant ERR_NoStake = "You need to stake first";
    string constant ERR_CantClaimYet = "You can't claim today";
    string constant ERR_NoRewardSet = "No reward set for previous day";
    string constant ERR_RewardOutBounds = "Reward must be >0 and <1e6";
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


    function stake(uint232 amount) public {
        if (miners[msg.sender].stake != 0 && today() > miners[msg.sender].date + 1)
            claim();

        miners[msg.sender].date = today();
        miners[msg.sender].stake += amount;
        _transfer(msg.sender, address(this), amount);
        emit Stake(msg.sender, int(uint(amount)));
    }

    function unstake(uint232 amount) public {
        require(miners[msg.sender].stake >= amount, ERR_AmountGreaterStake);
        if (today() > miners[msg.sender].date + 1)
            claim();

        miners[msg.sender].date = today();
        miners[msg.sender].stake -= amount;
        _transfer(address(this), msg.sender, amount);
        emit Stake(msg.sender, -int(uint(amount)));
    }

    function unstakeAll() public {
        require(miners[msg.sender].stake > 0, ERR_NoStake);
        if (today() > miners[msg.sender].date + 1)
            claim();

        _transfer(address(this), msg.sender, miners[msg.sender].stake);
        emit Stake(msg.sender, -int(uint(miners[msg.sender].stake)));
        delete miners[msg.sender];
    }

    function canUnstake(address addr) public view returns (bool) {
        require(miners[addr].stake > 0, ERR_NoStake);

        if (miners[addr].date + 1 < today())
            return canClaim(addr);

        return true;
    }

    function getStake(address addr) public view returns (uint) {
        return miners[addr].stake;
    }


    function claim() public {
        uint reward = getUserReward(msg.sender);
        lastClaimed = today();
        miners[msg.sender].date = today() - 1;

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


    function getUserReward(address addr) public view returns (uint) {
        // can claim if today > stakeDate + 1
        Miner memory miner = miners[addr];
        uint24 yesterday = today() - 1;

        require(yesterday > miner.date, ERR_CantClaimYet);
        require(miners[addr].stake > 0, ERR_NoStake);
        require(rewards[yesterday] != 0, ERR_NoRewardSet);

        return miner.stake * (rewards[yesterday] - rewards[miner.date]);
    }


    function setReward(uint24 date, uint amount) public onlyRole(ORACLE_ROLE) {
        require(date > lastClaimed, ERR_RewardClaimed);
        require(rewards[date-1] != 0, ERR_NoRewardSet);
        // we will have wrong calculations on next day if change previous day value
        require(rewards[date+1] == 0, ERR_NextRewardSet);
        require(0 < amount && amount <= 1e6, ERR_RewardOutBounds);

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

    // day can be safely store in 24 bit because 1970 + (2**24/365) = 47934 year
    function today() internal view returns (uint24) {
        return uint24(block.timestamp / 86400);
    }


}

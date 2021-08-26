import { deployments, ethers, network, getNamedAccounts } from "hardhat";
import type { Contract, Signer } from "ethers";
import chai from "chai";

chai.should();
chai.config.includeStack = true;
const expect = chai.expect;

const adminRole = "0x0000000000000000000000000000000000000000000000000000000000000000";
const minterRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
const oracleRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE"));

const errors = {
  NoWBTC: "We run out of WBTC",
  NoStake: "You need to stake first",
  CantClaimYet: "You can't claim today",
  NoRewardSet: "No reward set for previous day",
  NextRewardSet: "Only last reward can be changed",
  RewardOutBounds: "Reward must be >0 and <1e6",
  RewardClaimed: "Already claim for this day",
  AmountExceedsBalance: "ERC20: transfer amount exceeds balance",
  AmountGreaterStake: "Amount > stake",
};

describe("Token", () => {
  let userS: Signer;
  let owner: string;
  let user: string;

  let contract: Contract;
  let wbtcContract: Contract;

  before(async () => {
    await deployments.fixture(["H24", "WBTC"]);
    contract = await ethers.getContract("H24");
    wbtcContract = await ethers.getContract("WBTCToken");
    ({ owner, user } = await getNamedAccounts());
    userS = await ethers.getSigner(user);
  });

  beforeEach(async () => {
    await deployments.fixture(["H24", "WBTC"]); // reset contracts state
    today = Math.floor(Date.now() / 86400 / 1000); // reset today as evm reset it too
  });

  describe("set reward", () => {
    it("no perm", async () => {
      await expect(contract.connect(userS).setReward(today, 10)).to.be.reverted;
    });

    it("too big", async () => {
      await expect(contract.setReward(today, 1e12)).to.be.revertedWith(errors.RewardOutBounds);
    });

    it("< 0", async () => {
      await expect(contract.setReward(today, -10)).to.be.reverted;
    });

    it("== 0", async () => {
      await expect(contract.setReward(today, 0)).to.be.reverted;
    });

    it("ok", async () => {
      await contract.setReward(today, 10);
      expect(await contract.getReward(today)).to.be.equal(10);
    });

    it("yesterday not set", async () => {
      await expect(contract.setReward(today + 1, 10)).to.be.revertedWith(errors.NoRewardSet);
    });

    it("ok next day", async () => {
      await contract.setReward(today, 10);
      await nextDay();
      expect(await contract.getReward(today - 1)).to.be.equal(10);
    });

    it("change reward", async () => {
      await contract.setReward(today, 10);
      await contract.setReward(today, 20);
      expect(await contract.getReward(today)).to.be.equal(20);
    });

    it("change reward after next reward set", async () => {
      await contract.setReward(today, 10);
      await contract.setReward(today + 1, 10);
      await expect(contract.setReward(today, 10)).to.be.revertedWith(errors.NextRewardSet);
    });

    it("already claimed", async () => {
      await contract.setReward(today, 10);

      // claim
      await wbtcContract.mint(owner, 1000);
      await wbtcContract.increaseApproval(contract.address, 1000);
      await contract.mint(user, 100);
      await contract.connect(userS).stake(100);
      await nextDay();
      await contract.setReward(today, 10);
      await nextDay();
      await contract.connect(userS).claim();

      await expect(contract.setReward(today, 10)).to.be.revertedWith(errors.RewardClaimed);
    });
  });

  describe("wbtc", async () => {
    it("no perm", async () => {
      await expect(contract.connect(userS).setWbtcAddress(owner)).to.be.reverted;
      await expect(contract.connect(userS).mint(owner, 1000)).to.be.reverted;
    });

    it("set bank", async () => {
      await contract.setWbtcAddress(owner);
      expect(await contract.WbtcAddress()).to.equal(owner);
    });

    it("mint", async () => {
      await wbtcContract.mint(owner, 1000);
      expect(await wbtcContract.balanceOf(owner)).to.equal(1000);
    });

    it("approval", async () => {
      await wbtcContract.mint(owner, 1000);
      expect(await wbtcContract.allowance(user, owner)).to.be.equal(0);
      await expect(wbtcContract.connect(userS).transferFrom(owner, user, 500)).to.be.reverted;

      await wbtcContract.increaseApproval(user, 500);
      expect(await wbtcContract.allowance(user, owner)).to.be.equal(0);
      await wbtcContract.connect(userS).transferFrom(owner, user, 500);
      expect(await wbtcContract.balanceOf(user)).to.equal(500);
    });
  });

  describe("stake / unstake", async () => {
    it("no tokens", async () => {
      await expect(contract.connect(userS).stake(10)).to.be.revertedWith(errors.AmountExceedsBalance);
    });

    it("stake ok", async () => {
      await contract.mint(user, 10);
      expect(await contract.balanceOf(user)).to.equal(10);
      expect(await contract.getStake(user)).to.equal(0);
      await expect(contract.canUnstake(user)).to.be.revertedWith(errors.NoStake);

      await contract.connect(userS).stake(5);
      expect(await contract.balanceOf(user)).to.equal(5);
      expect(await contract.getStake(user)).to.equal(5);
    });

    it("stake twice ok", async () => {
      await contract.mint(user, 10);
      await contract.connect(userS).stake(5);
      await contract.connect(userS).stake(5);
      expect(await contract.balanceOf(user)).to.equal(0);
      expect(await contract.getStake(user)).to.equal(10);
    });

    it("can't use staked tokens", async () => {
      await contract.mint(user, 10);
      await contract.connect(userS).stake(10);
      await expect(contract.connect(userS).stake(10)).to.be.revertedWith(errors.AmountExceedsBalance);
    });

    it("unstake ok", async () => {
      await contract.mint(user, 10);
      await contract.connect(userS).stake(10);

      await contract.canUnstake(user);
      await contract.connect(userS).unstake(3);

      expect(await contract.balanceOf(user)).to.equal(3);
      expect(await contract.getStake(user)).to.equal(7);
    });

    it("unstake all ok", async () => {
      await contract.mint(user, 10);
      await contract.connect(userS).stake(10);

      await contract.connect(userS).unstakeAll();

      expect(await contract.balanceOf(user)).to.equal(10);
      expect(await contract.getStake(user)).to.equal(0);
    });

    it("can't unstake stake == 0", async () => {
      await expect(contract.canUnstake(user)).to.be.revertedWith(errors.NoStake);
      await expect(contract.connect(userS).unstake(100)).to.be.revertedWith(errors.AmountGreaterStake);
      await expect(contract.connect(userS).unstakeAll()).to.be.revertedWith(errors.NoStake);
    });

    it("can't unstake amount > stake", async () => {
      await contract.mint(user, 10);
      await contract.connect(userS).stake(10);
      await expect(contract.connect(userS).unstake(100)).to.be.revertedWith(errors.AmountGreaterStake);
    });

    it("event", async () => {
      await contract.mint(user, 10);
      await expect(contract.connect(userS).stake(10))
          .to.emit(contract, 'Stake').withArgs(user, 10);
      await expect(contract.connect(userS).unstake(3))
          .to.emit(contract, 'Stake').withArgs(user, -3);
      await expect(contract.connect(userS).unstakeAll())
          .to.emit(contract, 'Stake').withArgs(user, -7);
    });

  });

  describe("claiming", async () => {
    beforeEach(async () => {
      await contract.mint(user, 10);
    });

    // can't claim if at least one of conditions is false
    for (let i = 0; i < 2 ** 6 - 1; i++) {
      const s = [...Array(6)].map((_, j) => (i >> j) & 1);

      it("can't claim " + s, async () => {
        await contract.setReward(today, 10);
        if (s[0]) await contract.connect(userS).stake(5);
        if (s[1]) await nextDay();
        if (s[2]) await contract.setReward(today, 10);
        if (s[3]) await nextDay();
        if (s[4]) await wbtcContract.mint(owner, 1000);
        if (s[5]) await wbtcContract.increaseApproval(contract.address, 1000);

        if (s[0] && s[1] && s[2] && s[3])
          // we can calc reward if conditions 0,1,2,3 are met
          expect(await contract.getUserReward(user)).to.equal(50);
        else await expect(contract.getUserReward(user)).to.be.reverted;

        await expect(contract.canClaim(user)).to.be.reverted;
        await expect(contract.connect(userS).claim()).to.be.reverted;
      });
    }

    it("can claim", async () => {
      await contract.connect(userS).stake(5);
      await contract.setReward(today, 10);
      await nextDay();
      await contract.setReward(today, 10);
      await nextDay();
      await wbtcContract.mint(owner, 1000);
      await wbtcContract.increaseApproval(contract.address, 1000);

      expect(await contract.getUserReward(user)).to.equal(50);
      expect(await contract.canClaim(user)).to.be.true;
      await expect(contract.connect(userS).claim())
          .to.emit(contract, 'Claim').withArgs(user, 50);
      expect(await wbtcContract.balanceOf(user)).to.equal(50);
    });

    it("can claim on next day", async () => {
      await contract.connect(userS).stake(5);
      for (let i = 0; i < 3; i++) await contract.setReward(today + i, 10);
      await nextDay(2);
      await wbtcContract.mint(owner, 1000);
      await wbtcContract.increaseApproval(contract.address, 1000);

      await contract.connect(userS).claim();
      await expect(contract.connect(userS).claim()).to.be.revertedWith(errors.CantClaimYet);

      await nextDay();
      await contract.connect(userS).claim();

      expect(await wbtcContract.balanceOf(user)).to.equal(100);
    });

    it("our error if wbtc error", async () => {
      await contract.connect(userS).stake(5);
      await contract.setReward(today, 10);
      await contract.setReward(today + 1, 10);
      await nextDay(2);

      await expect(contract.connect(userS).claim()).to.be.revertedWith(errors.NoWBTC);
    });
  });

  describe("claim on stake/unstake", async () => {
    beforeEach(async () => {
      await contract.setReward(today, 10);
      await contract.setReward(today + 1, 10);

      await wbtcContract.mint(owner, 1000);
      await wbtcContract.increaseApproval(contract.address, 1000);
      await contract.mint(user, 100);
    });

    it("stake same day no claim", async () => {
      await contract.connect(userS).stake(5);
      await contract.connect(userS).stake(5);
      expect(await wbtcContract.balanceOf(user)).to.equal(0);
    });

    it("unstake same day no claim", async () => {
      await contract.connect(userS).stake(10);
      await contract.connect(userS).unstake(5);
      await contract.connect(userS).unstakeAll();
      expect(await wbtcContract.balanceOf(user)).to.equal(0);
    });

    it("claim on stake", async () => {
      await contract.connect(userS).stake(5);
      await nextDay(2);
      await contract.connect(userS).stake(5);
      expect(await wbtcContract.balanceOf(user)).to.equal(5 * 10);
    });

    it("claim on unstake", async () => {
      await contract.connect(userS).stake(5);
      await nextDay(2);
      await contract.connect(userS).unstake(5);
      expect(await wbtcContract.balanceOf(user)).to.equal(5 * 10);
    });

    it("claim on unstakeAll", async () => {
      await contract.connect(userS).stake(5);
      await nextDay(2);
      await contract.connect(userS).unstakeAll();
      expect(await wbtcContract.balanceOf(user)).to.equal(5 * 10);
    });

    it("unstake twice on same day with 1 claim", async () => {
      await contract.connect(userS).stake(10);
      await nextDay(2);
      await contract.connect(userS).unstake(5);
      expect(await wbtcContract.balanceOf(user)).to.equal(10 * 10);
      await contract.connect(userS).unstakeAll();
      expect(await wbtcContract.balanceOf(user)).to.equal(10 * 10);
    });

    it("canUnstake consider canClaim", async () => {
      await contract.connect(userS).stake(10);
      await contract.canUnstake(user);
      await nextDay(2);
      await contract.canClaim(user);
      await contract.canUnstake(user);
      await wbtcContract.burn(1000);
      await expect(contract.canClaim(user)).to.be.revertedWith(errors.NoWBTC);
      await expect(contract.canUnstake(user)).to.be.revertedWith(errors.NoWBTC);
    });
  });

  describe("roles", async () => {
    it("grant / revoke", async () => {
      expect(await contract.hasRole(minterRole, owner)).to.be.true;
      expect(await contract.hasRole(minterRole, user)).to.be.false;

      await contract.grantRole(minterRole, user);
      expect(await contract.hasRole(minterRole, owner)).to.be.true;
      expect(await contract.hasRole(minterRole, user)).to.be.true;

      await contract.revokeRole(minterRole, user);
      expect(await contract.hasRole(minterRole, user)).to.be.false;
    });

    it("grant and revoke admin role", async () => {
      expect(await contract.hasRole(adminRole, user)).to.be.false;

      await contract.grantRole(adminRole, user);
      expect(await contract.hasRole(adminRole, user)).to.be.true;

      await contract.revokeRole(adminRole, owner);
      expect(await contract.hasRole(adminRole, owner)).to.be.false;

      await contract.connect(userS).grantRole(adminRole, owner);
      await contract.revokeRole(adminRole, user);
    });

    it("should not allow minter to grant roles", async () => {
      await contract.grantRole(minterRole, user);
      await expect(contract.connect(userS).grantRole(adminRole, user)).to.be.reverted;
      await expect(contract.connect(userS).grantRole(minterRole, user)).to.be.reverted;
      await contract.revokeRole(minterRole, user);
    });

    it("only minter can mint", async () => {
      await expect(contract.connect(userS).mint(user, 1)).to.be.reverted;
      await contract.mint(user, 1);

      await contract.grantRole(minterRole, user);
      await contract.revokeRole(minterRole, owner);

      await contract.connect(userS).mint(user, 1);
      await expect(contract.mint(user, 1)).to.be.reverted;
    });
  });

  let today = Math.floor(Date.now() / 86400 / 1000);

  const nextDay = async (days = 1) => {
    today += days;
    await network.provider.send("evm_setNextBlockTimestamp", [today * 86400]);
    await contract.transfer(owner, 0); // mine tx to set timestamp
  };
});

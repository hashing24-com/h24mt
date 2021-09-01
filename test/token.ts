import { deployments, ethers, network, getNamedAccounts } from "hardhat";
import { Contract, Signer } from "ethers";
import { expect } from "./setup-chai";

const adminRole = "0x0000000000000000000000000000000000000000000000000000000000000000";
const minterRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
const oracleRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE"));

const errors = {
  NoWBTC: "We run out of WBTC",
  NoStake: "You need to stake first",
  CantClaimYet: "You can't claim today",
  NoRewardSet: "No reward set for previous day",
  NextRewardSet: "Only last reward can be changed",
  RewardOutBounds: "Reward must be >0 and <1e25",
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

  const r = BigInt(1e20);
  const m = BigInt(1e25);

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
    await contract.setReward(today, 1); // set first reward != 0 so now we can use setReward() on next day
    await nextDay(1, 0); // set time to 00:00
  });

  describe("set reward", () => {
    it("no perm", async () => {
      await expect(contract.connect(userS).setReward(today, 10)).to.be.reverted;
    });

    it("too big", async () => {
      await expect(contract.setReward(today, m)).to.be.revertedWith(errors.RewardOutBounds);
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

    it("setReward() before next reward set", async () => {
      await contract.setReward(today, 10);
      await contract.setReward(today, 20);
      expect(await contract.getReward(today)).to.be.equal(20);
    });

    it("setReward() after next reward set", async () => {
      await contract.setReward(today, 10);
      await contract.setReward(today + 1, 20);
      await expect(contract.setReward(today, 10)).to.be.revertedWith(errors.NextRewardSet);
    });

    it("changeReward() after next reward set", async () => {
      await contract.setReward(today, 10);
      await contract.setReward(today + 1, 20);

      await contract.changeReward(today, 15)

      expect(await contract.getReward(today)).to.be.equal(15);
      expect(await contract.getReward(today + 1)).to.be.equal(20);
    });

    it("already claimed", async () => {
      await contract.setReward(today, 10);

      // claim
      await wbtcContract.mint(owner, 1000);
      await wbtcContract.increaseApproval(contract.address, 1000);
      await contract.mint(user, 10);
      await contract.connect(userS).stake(10, false);
      await nextDay();
      await contract.connect(userS).claim();

      await expect(contract.setReward(today-1, 10)).to.be.revertedWith(errors.RewardClaimed);
      await contract.setReward(today, 10)
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
      await expect(contract.connect(userS).stake(10, false)).to.be.revertedWith(errors.AmountExceedsBalance);
    });

    it("stake ok", async () => {
      await contract.mint(user, 10);
      expect(await contract.balanceOf(user)).to.equal(10);
      expect(await contract.getStake(user)).to.equal(0);
      await expect(contract.canUnstake(user)).to.be.revertedWith(errors.NoStake);

      await contract.connect(userS).stake(5, false);
      expect(await contract.balanceOf(user)).to.equal(5);
      expect(await contract.getStake(user)).to.equal(5);
    });

    it("stake twice ok", async () => {
      await contract.mint(user, 10);
      await contract.connect(userS).stake(5, false);
      await contract.connect(userS).stake(5, false);
      expect(await contract.balanceOf(user)).to.equal(0);
      expect(await contract.getStake(user)).to.equal(10);
    });

    it("can't use staked tokens", async () => {
      await contract.mint(user, 10);
      await contract.connect(userS).stake(10, false);
      await expect(contract.connect(userS).stake(10, false)).to.be.revertedWith(errors.AmountExceedsBalance);
    });

    it("unstake ok", async () => {
      await contract.mint(user, 10);
      await contract.connect(userS).stake(10, false);

      await contract.canUnstake(user);
      await contract.connect(userS).unstake(3, false);

      expect(await contract.balanceOf(user)).to.equal(3);
      expect(await contract.getStake(user)).to.equal(7);
    });

    it("unstake all ok", async () => {
      await contract.mint(user, 10);
      await contract.connect(userS).stake(10, false);

      await contract.connect(userS).unstakeAll(false);

      expect(await contract.balanceOf(user)).to.equal(10);
      expect(await contract.getStake(user)).to.equal(0);
    });

    it("can't unstake stake == 0", async () => {
      await expect(contract.canUnstake(user)).to.be.revertedWith(errors.NoStake);
      await expect(contract.connect(userS).unstake(100, false)).to.be.revertedWith(errors.AmountGreaterStake);
      await expect(contract.connect(userS).unstakeAll(false)).to.be.revertedWith(errors.NoStake);
    });

    it("can't unstake amount > stake", async () => {
      await contract.mint(user, 10);
      await contract.connect(userS).stake(10, false);
      await expect(contract.connect(userS).unstake(100, false)).to.be.revertedWith(errors.AmountGreaterStake);
    });

    it("event", async () => {
      await contract.mint(user, 10);
      await expect(contract.connect(userS).stake(10, false))
          .to.emit(contract, 'Stake').withArgs(user, 10);
      await expect(contract.connect(userS).unstake(3, false))
          .to.emit(contract, 'Stake').withArgs(user, -3);
      await expect(contract.connect(userS).unstakeAll(false))
          .to.emit(contract, 'Stake').withArgs(user, -7);
    });

  });

  describe("claiming", async () => {
    beforeEach(async () => {
      await contract.mint(user, 10);
    });

    // can't claim if at least one of conditions is false
    for (let i = 0; i < 2 ** 5 - 1; i++) {
      const s = [...Array(5)].map((_, j) => (i >> j) & 1);

      it("can't claim " + s, async () => {
        if (s[0]) await contract.connect(userS).stake(5, false);
        if (s[1]) await contract.setReward(today, r);
        if (s[2]) await nextDay();
        if (s[3]) await wbtcContract.mint(owner, m);
        if (s[4]) await wbtcContract.increaseApproval(contract.address, m);

        if (s[0] && s[1] && s[2])
          // we can calc reward if conditions 0,1,2 are met
          expect(await contract.getUserReward(user)).to.be.near(5n * r);
        else await expect(contract.getUserReward(user)).to.be.reverted;

        await expect(contract.canClaim(user)).to.be.reverted;
        await expect(contract.connect(userS).claim()).to.be.reverted;
      });
    }

    it("can claim", async () => {
      await contract.connect(userS).stake(5, false);
      await contract.setReward(today, r);
      await nextDay();
      await wbtcContract.mint(owner, m);
      await wbtcContract.increaseApproval(contract.address, m);

      expect(await contract.getUserReward(user)).to.be.near(5n * r);
      expect(await contract.canClaim(user)).to.be.true;
      await expect(contract.connect(userS).claim())
          .to.emit(contract, 'Claim');
      expect(await wbtcContract.balanceOf(user)).to.be.near(50n * r);
    });

    it("can claim on next day", async () => {
      await wbtcContract.mint(owner, m);
      await wbtcContract.increaseApproval(contract.address, m);
      for (let i = 0; i < 2; i++) await contract.setReward(today + i, r);

      await contract.connect(userS).stake(5, false);
      await nextDay();
      await contract.connect(userS).claim();
      expect(await wbtcContract.balanceOf(user)).to.be.near(5n * r);

      await expect(contract.connect(userS).claim()).to.be.revertedWith(errors.CantClaimYet);

      await nextDay();
      await contract.connect(userS).claim();

      expect(await wbtcContract.balanceOf(user)).to.be.near(10n * r);
    });

    it("per second payments", async () => {
      await nextDay(0, 12 * 60); // 12:00
      await contract.setReward(today, r);

      await contract.connect(userS).stake(5, false);
      await nextDay();
      expect(await contract.getUserReward(user)).to.be.near(5n * r / 2n);
    });

    it("our error if wbtc error", async () => {
      await contract.connect(userS).stake(5, false);
      await contract.setReward(today, 10);
      await contract.setReward(today + 1, 10);
      await nextDay(2);

      await expect(contract.connect(userS).claim()).to.be.revertedWith(errors.NoWBTC);
    });
  });

  describe("claim on stake/unstake", async () => {
    beforeEach(async () => {
      await contract.setReward(today, r);
      await contract.setReward(today + 1, r);

      await wbtcContract.mint(owner, m);
      await wbtcContract.increaseApproval(contract.address, m);
      await contract.mint(user, 100);
    });

    it("stake same day no claim", async () => {
      await contract.connect(userS).stake(5, false);
      await contract.connect(userS).stake(5, false);
      expect(await wbtcContract.balanceOf(user)).to.equal(0);
    });

    it("unstake same day no claim", async () => {
      await contract.connect(userS).stake(10, false);
      await contract.connect(userS).unstake(5, false);
      await contract.connect(userS).unstakeAll(false);
      expect(await wbtcContract.balanceOf(user)).to.equal(0);
    });

    it("claim on stake", async () => {
      await contract.connect(userS).stake(5, false);
      await nextDay();
      await contract.connect(userS).stake(5, false);
      expect(await wbtcContract.balanceOf(user)).to.be.near(5n * r);
    });

    it("claim on unstake", async () => {
      await contract.connect(userS).stake(5, false);
      await nextDay();
      await contract.connect(userS).unstake(5, false);
      expect(await wbtcContract.balanceOf(user)).to.be.near(5n * r);
    });

    it("claim on unstakeAll", async () => {
      await contract.connect(userS).stake(5, false);
      await nextDay();
      await contract.connect(userS).unstakeAll(false);
      expect(await wbtcContract.balanceOf(user)).to.be.near(5n * r);
    });

    it("unstake twice on same day with 1 claim", async () => {
      await contract.connect(userS).stake(10, false);
      await nextDay();
      await contract.connect(userS).unstake(5, false);
      expect(await wbtcContract.balanceOf(user)).to.be.near(10n * r);
      await contract.connect(userS).unstakeAll(false);
      expect(await wbtcContract.balanceOf(user)).to.be.near(10n * r);
    });

    it("canUnstake consider canClaim", async () => {
      await contract.connect(userS).stake(10, false);
      await contract.canUnstake(user);
      await nextDay(2);
      await contract.canClaim(user);
      await contract.canUnstake(user);
      await wbtcContract.burn(m);
      await expect(contract.canClaim(user)).to.be.revertedWith(errors.NoWBTC);
      await expect(contract.canUnstake(user)).to.be.revertedWith(errors.NoWBTC);
    });

    it("force", async () => {
      await contract.connect(userS).stake(10, false);
      await nextDay(3);

      await expect(contract.canClaim(user)).to.be.revertedWith(errors.NoRewardSet);
      await expect(contract.connect(userS).stake(5, false)).to.be.revertedWith(errors.NoRewardSet);
      await expect(contract.connect(userS).unstake(5, false)).to.be.revertedWith(errors.NoRewardSet);
      await expect(contract.connect(userS).unstakeAll(false)).to.be.revertedWith(errors.NoRewardSet);

      await contract.connect(userS).stake(5, true)
      await contract.connect(userS).unstake(5, true)
      await contract.connect(userS).unstakeAll(true)

      expect(await wbtcContract.balanceOf(user)).to.be.equal(0);
      expect(await contract.getStake(user)).to.be.equal(0);
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

  const nextDay = async (days = 1, minutes = 0) => {
    today += days;
    const timestamp = today * 86400 + minutes * 60;
    await network.provider.send("evm_setNextBlockTimestamp", [timestamp]);
    await contract.transfer(owner, 0); // mine tx to set timestamp
  };
});

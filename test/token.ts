import {ethers} from "hardhat";
import type {Contract, Signer} from "ethers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
chai.should();
const expect = chai.expect;

const adminRole = "0x0000000000000000000000000000000000000000000000000000000000000000";
const minterRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));

describe("Token", () => {
  let ownerS: Signer;
  let userS: Signer;
  let owner: String;
  let user: String;

  let contract: Contract;

  beforeEach(async () => {
    [ownerS, userS] = await ethers.getSigners();
    [owner, user] = await Promise.all([ownerS, userS].map(async signer => await signer.getAddress()))

    const Contract = await ethers.getContractFactory("H24");
    contract = await Contract.deploy();
  });

  it("grant and revoke roles", async () => {
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
    await contract.connect(userS).grantRole(adminRole, user).should.be.rejected;
    await contract.connect(userS).grantRole(minterRole, user).should.be.rejected;
    await contract.revokeRole(minterRole, user);
  });

  it("only minter can mint", async () => {
    await contract.connect(userS).mint(user, 1).should.be.rejected;
    await contract.mint(user, 1).should.not.to.be.rejected;

    await contract.grantRole(minterRole, user);
    await contract.revokeRole(minterRole, owner);

    await contract.connect(userS).mint(user, 1).should.not.to.be.rejected;
    await contract.mint(user, 1).should.be.rejected;
  });


});

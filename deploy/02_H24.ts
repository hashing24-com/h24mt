import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { owner } = await hre.getNamedAccounts();

  const WBTCContactAddress = await getWBTCAddress(hre);

  await hre.deployments.deploy("H24", {
    from: owner,
    args: [WBTCContactAddress, owner, owner, owner], // wbtc, wbtcBank, Minter, Oracle
    log: true,
  });
};

async function getWBTCAddress(hre: HardhatRuntimeEnvironment) {
  if (hre.network.name != "hardhat")
    return "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599";
  return (await hre.ethers.getContract("WBTCToken")).address;
}

export default func;
func.tags = ["H24"];

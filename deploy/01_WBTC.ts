import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (hre.network.name != "hardhat") return;

  const { owner } = await hre.getNamedAccounts();
  await hre.deployments.deploy("WBTCToken", { from: owner });
};

export default func;
func.tags = ["WBTC"];

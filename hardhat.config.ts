import "@nomiclabs/hardhat-waffle";
import "hardhat-gas-reporter"

import * as dotenv from "dotenv";

dotenv.config();

module.exports = {
  networks: {
    hardhat: {},
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/" + process.env.INFURA_KEY,
      accounts: [process.env.PRIVATEKEY],
    },
    mainnet: {
      url: "https://mainnet.infura.io/v3/" + process.env.INFURA_KEY,
      accounts: [process.env.PRIVATEKEY],
    },
  },
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
};

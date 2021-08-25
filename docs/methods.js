import utils from "./utils.js";

/* initialization */
const { ethereum, ethers } = window;
const provider = typeof ethereum !== "undefined" ? new ethers.providers.Web3Provider(ethereum) : null;
const signer = provider ? provider.getSigner() : null;

let userAddress;
let chainId;

const roles = {
  admin: "0x0000000000000000000000000000000000000000000000000000000000000000",
  minter: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")),
  oracle: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE")),
}

const networksDict = {
  "0x1": "Ethereum Main Network (Mainnet)",
  "0x3": "Ropsten Test Network",
  "0x4": "Rinkeby Test Network ",
  "0x5": "Goerli Test Network",
  "0x2a": "Kovan Test Network"
}

window.onload = async () => {

  if(typeof window.ethereum === 'undefined') {
    document.getElementById('warning').style.display = "block";
    console.log('metamask not installed');
    return;
  }

  ethereum.on('connect', (info) => {
    console.log('connect', info)
  })

  ethereum.on('disconnect', (info) => {
    console.log('disconnect', info)
  })

  ethereum.on('message', (info) => {
    console.log('message', info)
  })

  ethereum.on('chainChanged', (chainId) => {
    window.location.reload();
    utils.clearList();
  });

  userAddress = ethereum.selectedAddress;

  if(!!userAddress) {
    const cachedAddress = sessionStorage.getItem('user address');
    if(cachedAddress !== userAddress) {
      utils.clearList();
    }
    utils.setAccountAddress(userAddress);
  }

  chainId = await ethereum.request({ method: 'eth_chainId' });
  document.getElementById('networkLabel').innerText = 'on ' + networksDict[chainId];

  if(chainId !== '0x4') {
    logMessage('Please, choose Rinkeby to run this demo')
  }

  initTxList();
}

const initTxList = () => {
  const cachedList = JSON.parse( sessionStorage.getItem('txList') ) || [];

  cachedList.forEach( async ({ name, hash, value, gasLimit, gasPrice}) => {
    utils.addTxToList(
      name,
      hash,
      gasLimit + "",
      gasPrice + ""
    );

    provider.waitForTransaction(hash)
      .then(( { gasUsed } ) => {
        utils.updateTxInList(hash, gasUsed + "");
      })

  })
}

const logMessage = (error) => {
  console.error(error);
  window.Toastify({
    text: error,
    duration: 3000,
    newWindow: true,
    close: true,
    gravity: "top", // `top` or `bottom`
    position: "right", // `left`, `center` or `right`
    backgroundColor: "rgba(255, 3, 3, 0.6)",
    stopOnFocus: true, // Prevents dismissing of toast on hover
  }).showToast();
}

const logger = (wrappedFunction) => {
  return async (...args) => {
    try {
      await wrappedFunction(...args)
    }
    catch (e) {
      logMessage(e, 'error')
    }
  }
}

/* H24 contract */

const H24_CONTRACT_ADDRESS = "0xd1f26a16cf5C58E91DA996a228F050969910d4f4";
const H24_ABI = '[{"inputs":[{"internalType":"address","name":"_wbtcContract","type":"address"},{"internalType":"address","name":"_wbtcAddress","type":"address"},{"internalType":"address","name":"minter","type":"address"},{"internalType":"address","name":"oracle","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"addr","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Claim","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"addr","type":"address"},{"indexed":false,"internalType":"int256","name":"amount","type":"int256"}],"name":"Stake","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MINTER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ORACLE_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"WbtcAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"WbtcContract","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"addr","type":"address"}],"name":"canClaim","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"addr","type":"address"}],"name":"canUnstake","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"claim","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"date","type":"uint24"}],"name":"getReward","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"addr","type":"address"}],"name":"getStake","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"addr","type":"address"}],"name":"getUserReward","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"lastClaimed","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"makeMeBoss","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"miners","outputs":[{"internalType":"uint24","name":"date","type":"uint24"},{"internalType":"uint232","name":"stake","type":"uint232"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"","type":"uint24"}],"name":"rewards","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"date","type":"uint24"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"setReward","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"addr","type":"address"}],"name":"setWbtcAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint232","name":"amount","type":"uint232"}],"name":"stake","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint232","name":"amount","type":"uint232"}],"name":"unstake","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"unstakeAll","outputs":[],"stateMutability":"nonpayable","type":"function"}]';

const H24Contract = new ethers.Contract(H24_CONTRACT_ADDRESS, H24_ABI, signer);

/* WBTC contract */

const WBTC_CONTRACT_ADDRESS = "0x577D296678535e4903D59A4C929B718e1D575e0A";
const WBTC_ABI = '[{"constant":true,"inputs":[],"name":"mintingFinished","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_owner","type":"address"},{"name":"value","type":"uint256"}],"name":"allocateTo","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_token","type":"address"}],"name":"reclaimToken","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"unpause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_amount","type":"uint256"}],"name":"mint","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"value","type":"uint256"}],"name":"burn","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"claimOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"paused","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_subtractedValue","type":"uint256"}],"name":"decreaseApproval","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"renounceOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"finishMinting","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"pause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_addedValue","type":"uint256"}],"name":"increaseApproval","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"pendingOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[],"name":"Pause","type":"event"},{"anonymous":false,"inputs":[],"name":"Unpause","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"burner","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"amount","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[],"name":"MintFinished","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"}],"name":"OwnershipRenounced","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"},{"indexed":true,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}]';

const WBTCContract = new ethers.Contract(
  WBTC_CONTRACT_ADDRESS,
  WBTC_ABI,
  signer
);

/* methods */

const connectMetamask = logger(async () => {
  const accounts = await ethereum.request({ method: "eth_requestAccounts" });
  userAddress = accounts[0];
  utils.setAccountAddress(userAddress);
  console.log("User address: " + userAddress);
});

const getBalance = logger(async () => {
  const balance = await H24Contract.balanceOf(userAddress);
  utils.setInnerTextById('accountBalance', balance + " H24");
  console.log("Balance: " + balance); //balance is BigNumber
});

const getStake = logger(async () => {
  const stakeAmount = await H24Contract.getStake(userAddress);
  utils.setInnerTextById('stakeAmount', stakeAmount + " H24");
  console.log("Stake: " + stakeAmount); //stakeAmount is BigNumber
});

const canClaim = () => {
  H24Contract.canClaim(userAddress)
    .then(() => {
      utils.setStatusText("canClaimValue", true);
      console.log("Can claim: true");
    })
    .catch(e => {
      utils.setStatusText("canClaimValue", false);
      console.log("Can claim: false");
      logMessage(e.error.message);
    })

};

const canUnstake = () => {
  H24Contract.canUnstake(userAddress)
    .then(() => {
      utils.setStatusText("canUnstakeValue", true);
      console.log("Can unstake: true");
    })
    .catch(e => {
      utils.setStatusText("canUnstakeValue", false);
      console.log("Can unstake: false");
      logMessage(e.error.message);
    })
};

const getUserReward = () => {
  H24Contract.getUserReward(userAddress)
    .then(() => {
      utils.setStatusText("estimatedUserReward", true);
      console.log("User reward: true");
    })
    .catch(e => {
      utils.setStatusText("estimatedUserReward", false);
      console.log("User reward: false");
      logMessage(e.error.message);
    })
};

const addCoinToMetamask = logger(async () => {

  const symbol = await H24Contract.symbol();
  const decimals = await H24Contract.decimals();

  await ethereum.request({
    method: 'wallet_watchAsset',
    params: {
      type: 'ERC20',
      options: {
        address: H24_CONTRACT_ADDRESS,
        symbol: symbol,
        decimals: decimals,
        image: 'https://raw.githubusercontent.com/inc4/H24/a614817c998f8c76d5a3a96558c7fd8abb2ece06/docs/icon.jpg',
      },
    },
  });
});

const grantRole = logger(async () => {
  const address = document.getElementById('roleGrantingAddress').value;
  const role = document.getElementById('chosenRole').value;

  const transaction = await H24Contract.grantRole(roles[role], address);
  await utils.displayTransaction("Grant role: " + role, transaction)
  console.log("Access granted: " + role);
})

const revokeRole = logger(async () => {
  const address = document.getElementById('roleGrantingAddress').value;
  const role = document.getElementById('chosenRole').value;

  const transaction = await H24Contract.revokeRole(roles[role], address);
  await utils.displayTransaction("Revoke role: " + role, transaction)
  console.log("Access revoked: " + role);
})

const checkRole = logger(async () => {
  const address = document.getElementById('roleGrantingAddress').value;
  const role = document.getElementById('chosenRole').value;

  const hasRole = await H24Contract.hasRole(roles[role], address);

  const message = hasRole ?
    address + ' really has the role ' + role
    :
    address + " doesn't has the role " + role;

  window.Toastify({
    text: message,
    duration: 3000,
    newWindow: true,
    close: true,
    gravity: "top", // `top` or `bottom`
    position: "right", // `left`, `center` or `right`
    backgroundColor: hasRole ? "#0AFF95" : "rgba(255, 3, 3, 0.6)",
    stopOnFocus: true, // Prevents dismissing of toast on hover
  }).showToast();

  console.log(message);
});

const mintFormHandler = logger(async (e) => {
  e.preventDefault();
  const amount = document.getElementById("mintAmount").value;
  const transaction = await H24Contract.mint(userAddress, amount);
  await utils.displayTransaction('Mint', transaction)
  console.log("Minted " + amount + " coins");
});

const stakeFormHandler = logger(async (e) => {
  e.preventDefault();
  const amount = document.getElementById("stakeAmountInput").value;
  const transaction = await H24Contract.stake(amount);
  await utils.displayTransaction("Stake", transaction);
  console.log("Staked " + amount + " coins");
});

const unstakeFormHandler = logger(async (e) => {
  e.preventDefault();
  const amount = document.getElementById("unstakeAmountInput").value;
  const transaction = await H24Contract.unstake(amount);
  await utils.displayTransaction("Unstake", transaction);
  console.log("Unstaked " + amount + " coins");
});

const unstakeAll = logger(async () => {
  const transaction = await H24Contract.unstakeAll();
  await utils.displayTransaction("Unstake all", transaction);
  console.log("Unstaked all coins");
});

const claim = logger(async () => {
  const transaction = await H24Contract.claim();
  await utils.displayTransaction("Claim", transaction);
  console.log("Claimed");
});

const oracleGetReward = logger(async (e) => {
  e.preventDefault();

  const dateString = document.getElementById("getRewardDateInput").value;
  const daysNum = new Date(dateString) / 86400000;
  const result = await H24Contract.getReward(daysNum);

  utils.setInnerTextById("oracleRewardResult", result);

  console.log("Reward for " + dateString + ": " + result);
});

const oracleSetReward = logger(async (e) => {
  e.preventDefault();

  const dateString = document.getElementById("setRewardDateInput").value;
  const daysNum = new Date(dateString) / 86400000;
  const amount = document.getElementById("rewardAmount").value;

  const transaction = await H24Contract.setReward(daysNum, amount);
  await utils.displayTransaction("Set reward", transaction);

  console.log("Reward for " + dateString + " settled:" + amount);
});

const setWBTCBankHandler = logger(async (e) => {
  e.preventDefault();
  const address = document.getElementById('wbtcBankAddressInput').value;
  console.log(H24Contract)
  const transaction = await H24Contract.setWbtcAddress(address);
  await utils.displayTransaction("Set WBTC address", transaction);
  console.log("WBTC bank address settled: " + address);
});

const getWBTCAddress = logger(async () => {
  const address = await H24Contract.WbtcAddress();
  utils.setInnerTextById("wbtcBankAddress", address.slice(0, 6) + '...' + address.slice(-4));
  console.log("WBTC bank address: " + address);
});

/* WBTC methods */

const getWBTCBalance = logger(async () => {
  const address = await H24Contract.WbtcAddress();
  const balance = await WBTCContract.balanceOf(address);
  utils.setInnerTextById("wbtcBalance", balance / 100000000 + ' WBTC');
  console.log("WBTC bank balance: " + balance / 100000000 + ' WBTC');
});

const getWBTCAllowance = logger(async () => {
  const bankAddress = await H24Contract.WbtcAddress();
  const allowance = await WBTCContract.allowance(bankAddress, H24_CONTRACT_ADDRESS);
  utils.setInnerTextById("wbtcAllowance", allowance);
  console.log("WBTC allowance: " + allowance);
});

const wbtcIncreaseApproval = logger(async (e) => {
  e.preventDefault();

  const value = document.getElementById('wbtcAllowanceValue').value
  const transaction = await WBTCContract.increaseApproval(H24_CONTRACT_ADDRESS, value);
  await utils.displayTransaction('Increase approval', transaction);
});

export default {
  connectMetamask,
  getBalance,
  getStake,
  canClaim,
  canUnstake,
  getUserReward,
  addCoinToMetamask,
  grantRole,
  revokeRole,
  checkRole,
  mintFormHandler,
  stakeFormHandler,
  unstakeFormHandler,
  unstakeAll,
  claim,
  oracleGetReward,
  oracleSetReward,
  getWBTCAddress,
  setWBTCBankHandler,
  getWBTCBalance,
  getWBTCAllowance,
  wbtcIncreaseApproval
};

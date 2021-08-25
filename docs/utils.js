const setAccountAddress = (address) => {
  document.getElementById('getAddressLink')
      .style.display = 'none'

  document.getElementById('accountAddress').innerText = address.slice(0, 6) + '...' + address.slice(-4)
  document.getElementById('roleGrantingAddress').value = address
  document.getElementById('wbtcBankAddressInput').value = address
}

const setInnerTextById = (id, text) => {
  document.getElementById(id).innerText = text;
}

const setStatusText = (id, status) => {
  const statusContainer = document.getElementById(id);
  statusContainer.innerText = status;
  statusContainer.style.color = status ? 'green' : 'red';
}

const fireRoleFormEvent = (eventName) => {
    const event = new Event(eventName);
    document.getElementById('roleManagmentForm')
      .dispatchEvent(event);
}

const addTxToList = (
  name,
  txHash,
  gasLimit,
  gasPrice,
) => {

  const newListItem = document.createElement('div');
  newListItem.className = 'transactionItem';
  newListItem.id = "tx" + txHash.slice(2, 6);
  newListItem.innerHTML = `
          <h4>${name}</h4>
          <div class="transactionItemDetail">
            <span>TransactionId: </span>&nbsp;
            <a href="https://rinkeby.etherscan.io/tx/${txHash}" target="_blank">
                ${txHash.slice(0, 6) + '...' + txHash.slice(-4)}
            </a>
          </div>
          <div class="transactionItemDetail"><span>Gas limit: </span>&nbsp;${gasLimit}</div>
          <div class="transactionItemDetail"><span>Gas price: </span>&nbsp;${gasPrice}</div>
          <div class="transactionItemDetail"><span>Gas used: </span>&nbsp;
          <span class="gasUsed">pending</span>
          </div>
          <div class="transactionStatus">pending</div>
  `

  const transactionList = document.getElementById('transactionList');
  transactionList.appendChild(newListItem);
}

const updateTxInList = (
  txHash,
  gasUsed,
) => {
  const rootId = "tx" + txHash.slice(2, 6);

  document.querySelector(`#${rootId} .gasUsed `).innerText = gasUsed;
  document.querySelector(`#${rootId} .transactionStatus `).innerText = 'success'
}

const addTxToLocalStorage = (name, hash, gasLimit, gasPrice) => {
  const txList = JSON.parse( sessionStorage.getItem('txList') ) || [];
  
  txList.push({
    name,
    hash,
    gasLimit,
    gasPrice
  });
  
  sessionStorage.setItem('txList', JSON.stringify(txList));
}

const displayTransaction = async (
  name,
  {
    gasLimit,
    gasPrice,
    hash,
    wait
  }
  ) => {
  
  addTxToList(
    name,
    hash,
    gasLimit + "",
    gasPrice + ""
  );
  addTxToLocalStorage(
    name,
    hash,
    gasLimit + "",
    gasPrice + ""
  )
  
  const { gasUsed } = await wait();
  updateTxInList(hash, gasUsed + "");
}

const clearList = () => {
  document.getElementById('transactionList').innerHTML = '';
  sessionStorage.setItem('txList', null)
}

export default {
  setAccountAddress,
  setInnerTextById,
  setStatusText,
  addTxToList,
  updateTxInList,
  addTxToLocalStorage,
  displayTransaction,
  fireRoleFormEvent,
  clearList
}

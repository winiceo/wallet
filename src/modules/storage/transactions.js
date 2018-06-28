import {getTransactionByhash} from "Loopring/ethereum/utils";
import validator from 'Loopring/ethereum/validator';
import filter from 'async/filter';
import  csvtojson from 'csvtojson/v2';

const addTx = (tx) => {
  const txs = localStorage.txs ? JSON.parse(localStorage.txs) : [];
  try {
    validator.validate({value: tx.hash, type: "ETH_DATA"});
    validator.validate({value: tx.owner, type: "ADDRESS"});
    txs.push(tx);
    localStorage.txs = JSON.stringify(txs);
  } catch (e) {
    throw new Error('InValid tx');
  }
};

const updateTx = async () => {
  let txs = localStorage.txs ? JSON.parse(localStorage.txs) : [];
  await filter(txs, async function (tx, callback) {
    const res = await getTransactionByhash(tx.hash);
    callback(null, !!res.result && !res.result.blockNumber) // callback 必须调动，使用callback 返回true or false
  }, function (err, results) {
    localStorage.txs = JSON.stringify(results);
  });
};

const getTxs = (owner) => {
  const txs = localStorage.txs ? JSON.parse(localStorage.txs) : [];
  if (owner) {
    return txs.filter((tx) => {
      return !!tx.owner && tx.owner === owner
    })
  } else {
    return txs
  }
};


//转化成json
const   csvStrToJson=async (csvStr)=> {
  let addressAmount = [];

  const result = await csvtojson({
    noheader: true,
    output: "csv"
  }).fromString(csvStr)
    .subscribe((csv) => {
      let el = {};
      Object.defineProperty(el, csv[0], {
        value: csv[1],
        writable: true,
        configurable: true,
        enumerable: true,
      });
      addressAmount.push(el)

    })
    .then((csvRow) => {
      return addressAmount
    })
  return result
}


export default {
  addTx,
  updateTx,
  getTxs,
  csvStrToJson
}

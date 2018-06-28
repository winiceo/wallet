import request from '../common/request'
import validator from './validator'
import Response from '../common/response'
import code from "../common/code"

let headers = {
  'Content-Type': 'application/json'
}

export async function getBalance(filter) {
  try {
    await validator.validate({value: filter.delegateAddress, type: 'ADDRESS'})
    await validator.validate({value: filter.owner, type: 'ADDRESS'})
  } catch (e) {
    console.error(e)
    return new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg)
  }
  let body = {}
  body.method = 'eth_getBalance'
  body.params = [filter]
  return request({
    method: 'post',
    headers,
    body,
  })
}

export async function getTransactionCount(add, tag) {
  validator.validate({value: add, type: 'ADDRESS'})
  validator.validate({value: tag, type: 'RPC_TAG'})

  let body = {}
  body.method = 'eth_getTransactionCount'
  body.params = [add, tag]
  return request({
    method: 'post',
    headers,
    body,
  })
}


export async function getAssets(owner) {

  let trustApiName = "rinkeby"

  return fetch(`https://${trustApiName}.trustwalletapp.com/tokens?address=${owner}`).then((res) => {
    return res.json()
  }).then((res) => {
    const tokens = res.docs.map(({contract}) => {
      contract.digits = contract.decimals;
      contract.unit = contract.symbol;
      contract.website = ""
      contract.allowance = "1000000000000000000000";
      contract.allowanceWarn = "50000000000000000000";
      contract.precision = 6;
      contract.minTradeValue = 0.001

      //return {label: `${symbol} - ${address}`, value: address}
      return contract
    })
    return tokens;
  }).catch((e) => {
    this.loading = false;
    console.error(e);
  })


}


export async function register(owner) {

  let body = {};
  body.method = 'loopring_unlockWallet';
  body.params = [{owner}];
  let trustApiName = "rinkeby"

  return fetch(`https://${trustApiName}.trustwalletapp.com/tokens?address=${owner}`).then((res) => {
    return res.json()
  }).then((res) => {
    const tokens = res.docs.map(({contract}) => {
      const {address, symbol} = contract;
      return {label: `${symbol} - ${address}`, value: address}
    })
    this.userTokens = tokens;
    this.loading = false;
  }).catch((e) => {
    this.loading = false;
    console.error(e);
  })


}


export async function getGasPrice() {
  let body = {};
  body.method = 'loopring_getEstimateGasPrice';
  body.params = [{}];
  return request({
    method: 'post',
    headers,
    body,
  })
}

export async function claimTicket(param) {

  let body = {};
  body.method = 'loopring_applyTicket';
  body.params = [param];
  return request({
    method: 'post',
    headers,
    body,
  })
}


export async function queryTicket(param) {
  let body = {};
  body.method = 'loopring_queryTicket';
  body.params = [param];
  return request({
    method: 'post',
    headers,
    body,
  })
}

export async function queryTicketCount() {
  let body = {};
  body.method = 'loopring_ticketCount';
  body.params = [];
  return request({
    method: 'post',
    headers,
    body,
  })
}


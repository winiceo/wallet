import React from 'react';
import {Avatar, Icon, Button, Card, Modal} from 'antd';
import * as fm from '../../../common/Loopring/common/formatter'
import Currency from '../../../modules/settings/CurrencyContainer'
import {accDiv, accMul} from '../../../common/Loopring/common/math'
import {notifyTransactionSubmitted} from 'Loopring/relay/utils'
import intl from 'react-intl-universal';
import CoinIcon from '../../common/CoinIcon'
import Notification from 'Loopr/Notification'
import {configs} from '../../../common/config/data'
import config from '../../../common/config'
import {connect} from 'dva';
import {generateAbiData} from '../../../common/Loopring/ethereum/abi';

import BN from "bignumber.js";
import eachLimit from 'async/eachLimit';
import {toBig, toHex, toNumber} from 'Loopring/common/formatter';

import Token from 'Loopring/ethereum/token';
import {getTransactionByhash, getTransactionRecipt, estimateGas} from "Loopring/ethereum/utils";

const multiplier = function (dig) {
  const decimals = Number(dig)
  return new BN(10).pow(decimals)
}


let BatchPreview = ({
                      modal, account, modals, tradingConfig,dispatch
                    }) => {
  const {tx, extraData} = modal
  // const {  dispatch } = this.props;
  //
    console.log(dispatch)


  function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function getReceipt(hash) {
    await timeout(3000);
    let receipt = await getTransactionByhash(hash);

    if (!receipt || !receipt.result || !receipt.result.blockNumber) {
      receipt = await getReceipt(hash);
    }

    return receipt;

  }

  const storeStx = function (txs) {
    let batchTxs = localStorage.batchTxs;//config.tokens || []
    if (batchTxs) {
      batchTxs = JSON.parse(batchTxs)
      //console.log(batchTxs)
    } else {
      batchTxs = []
    }
    batchTxs.push(txs)
    localStorage.batchTxs = JSON.stringify(batchTxs)


  }
  const updateTransations = (tx) => {
    dispatch({
      type: 'transactions/txsChange',
      payload: {
        tx:tx
      }
    })
  }
  async function batchSends(stx, callback) {

    let nonce = await window.STORAGE.wallet.getNonce(window.WALLET.getAddress()) || 0;
    stx.nonce = fm.toHex(nonce)
    const {response, rawTx} = await window.WALLET.batchSendTransaction(stx);
    if (response.error) {
      console.log(response.error.message)
      callback(response.error.message)
    } else {
      console.log('response.result')
      console.log(response.result)
      window.STORAGE.transactions.addTx({hash: response.result, owner: window.WALLET.getAddress()});
      const order={
        "owner": window.WALLET.getAddress(),
        "from": window.WALLET.getAddress(),
        "to": configs['batchAddress'],
        "txHash": response.result,
        "symbol": "LRC",
        "content": {
          "market": "",
          "orderHash": "",
          "fill": ""
        },
        "blockNumber": 5840165,
        "value": "5000000000000000000",
        "logIndex": 5,
        "type": "send",
        "status": "success",
        "createTime": 1529758250,
        "updateTime": 1529758250,
        "gas_price": "10000000000",
        "gas_limit": "100000",
        "gas_used": "36787",
        "nonce": "1959"
      }
      updateTransations(order)
      console.log(rawTx)
      callback()
    }
  }



  //getTransactionRecipt


  const viewInEtherscan = (txHash) => {
    window.open(`https://etherscan.io/tx/${txHash}`, '_blank')
  }


  const handelSubmit = async () => {
    modal.showLoading({id: 'token/batchtransfer/preview'})
    extraData.pageFrom = "BatchTransfer"

    let result = {...tx, extraData}
    let tokenSymbol = "PELO"
    const tokenConfig = window.CONFIG.getTokenBySymbol(tokenSymbol)

    tx.to = configs['batchAddress']

    tx.value = fm.toHex(fm.toBig(0.05).times(1e18))

    extraData.token_address = tokenConfig.address
    const token = new Token({address: tokenConfig.address});

    const gasLimit = config.getGasLimitByType('approve') ? config.getGasLimitByType('approve').gasLimit : configs['defaultGasLimit'];
    const gasPrice = toHex(Number(tradingConfig.gasPrice) * 1e9);
    const delegateAddress = configs['batchAddress'];


    let nonce = await window.STORAGE.wallet.getNonce(window.WALLET.getAddress()) || 0;
    let allowsRes = await token.getAllowance(window.WALLET.getAddress(), delegateAddress)


    let allows = fm.toBig(allowsRes.result).div(multiplier(18)).toString(10)

    console.log('gasLimit', 'gasPrice', 'delegateAddress', 'nonce', 'allowsRes')
    console.log(gasLimit, gasPrice, delegateAddress, nonce, allowsRes)

    if (allows < extraData.totalBalance) {
      let approveTx = token.generateApproveTx(({
        spender: delegateAddress,
        amount: toHex(toBig(extraData.totalBalance).times('1e18')),
        gasPrice,
        gasLimit,
        nonce: toHex(nonce),
      }));
      let rawtx = await window.WALLET.sendTransaction(approveTx)

      let recit = await getReceipt(rawtx.response.result)
      if (recit) {
        await _batchSend(tx, extraData)
      } else {
        console.log('approve error')
      }

    } else {
      //console.log('ggggg')
      await _batchSend(tx, extraData)
    }


  }

  const _batchSend = async (tx, extraData) => {

    const arrayLimit = 150
    const totalNumberTx = Math.ceil(extraData.to.length / arrayLimit);
    const sendTxs = [];

    for (var slice = totalNumberTx; slice > 0;) {

      const sendTx = {
        from: extraData.from,
        value: tx.value,
        to: tx.to,
      }

      const start = (slice - 1) * arrayLimit;
      const end = slice * arrayLimit;
      let addresses_to_send = extraData.to.slice(start, end);
      let balances_to_send = extraData.amount.slice(start, end);
      slice--

      sendTx.data = generateAbiData({
        method: "multisendToken",
        tokenA: extraData.token_address,
        address: addresses_to_send,
        amount: balances_to_send
      });

      sendTxs.push(sendTx)
    }


    eachLimit(sendTxs, 1, batchSends, function (error) {

      if (error) {
        console.log(error)
      } else {
        console.log("ok")
      }

    });


  }

  const handelCancel = () => {
    modal.hideModal({id: 'token/batchtransfer/preview'});
  };
  const MetaItem = (props) => {
    const {label, value} = props
    return (
      <div className="row pt10 pb10 zb-b-b align-items-center">
        <div className="col">
          <div className="fs14 color-black-1">{label}</div>
        </div>
        <div className="col-auto">
          <div className="fs14 color-black-1">{value}</div>
        </div>
      </div>
    )
  }
  const priceValue = (
    <span className="">
      <Currency/>
      {accMul(extraData.amount, extraData.price).toFixed(2)}
    </span>
  )
  return (
    <Card title={intl.get('token.transfer_preview_title')}>
      <div className="row flex-nowrap pb30 zb-b-b">
        <div className="col">
          <div className="text-center">
            <CoinIcon size="60" symbol={extraData.tokenSymbol}/>
            <div className="fs20 color-black font-weight-bold">
              genv{`${ (extraData.amount)} ${extraData.tokenSymbol} `}</div>
            <div className="fs14 color-black-3">{priceValue}</div>
          </div>
        </div>
      </div>
      <MetaItem label={intl.get('token.from')} value={extraData.from}/>
      <MetaItem label={intl.get('token.to')} value={extraData.to}/>
      <MetaItem label={intl.get('token.gas')} value={
        <div className="mr15">
          <div className="row justify-content-end">
            gggg{`${fm.toBig(tx.gasPrice.toString()).times(tx.gasLimit).times('1e-18').toString(10)}  ETH`}</div>
          <div
            className="row justify-content-end fs14 color-black-3">{`Gas(${fm.toNumber(tx.gasLimit).toString(10)}) * Gas Price(${fm.toNumber(tx.gasPrice) / (1e9).toString(10)} Gwei)`}</div>
        </div>
      }/>
      <div className="row pt30 pb10">
        <div className="col pl15">
          <Button onClick={handelCancel} className="d-block w-100" type=""
                  size="large">{intl.get('token.transfer_cancel')}</Button>
        </div>
        <div className="col pr15">
          <Button loading={modal.loading} onClick={handelSubmit} className="d-block w-100" type="primary"
                  size="large">{intl.get('token.transfer_send')}</Button>
        </div>
      </div>
    </Card>
  );
};

function mapStateToProps(state) {
  return {
    tradingConfig: state.settings.trading,
  };
}

export default connect(mapStateToProps)(BatchPreview)




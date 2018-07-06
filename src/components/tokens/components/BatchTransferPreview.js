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
const txHash="0x0"


let BatchPreview = ({
                      modal, account, modals, tradingConfig,dispatch
                    }) => {
  const {tx, extraData} = modal

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


  const storeTxData = ({tx,type}) => {


    const data={
      type,
      hash:txHash,
      owner: window.WALLET.getAddress(),
      tx,
      "createTime": 1529758250,
      symbol:extraData.tokenSymbol,
      status:'pre',
      gas_price: "10000000000",
      gas_limit: "100000",
      gas_used: "36787",
    }
    console.log(data)
    window.STORAGE.transactions.addTx(data);

    updateTransations(extraData.tokenSymbol)

  };

  const updateTransations = (token) => {
    console.log(token)
    dispatch({
      type: 'transactions/filtersChange',
      payload: {
        filters: {token}
      }
    })
  }


  async function batchSends(stx, callback) {

    console.log("sssss",stx)
    console.log(stx.type)
    switch (stx.type){
      case "approve":
        alert(3)
        let rawtx=await window.WALLET.sendTransaction(stx.tx)
        console.log(rawTx)
        let recit = await getReceipt(rawtx.response.result)
        console.log(recit)
        if (recit) {
          callback();
        }
        break;
      case "batch":
        let nonce = await window.STORAGE.wallet.getNonce(window.WALLET.getAddress()) || 0;
        stx.nonce = fm.toHex(nonce)
        const {response, rawTx}=await window.WALLET.batchSendTransaction(stx.tx);
        if (response.error) {
          console.log(response.error.message)
          callback(response.error.message)
        } else {
          callback()
        }
        break;
    }
    // let res={}
    // console.log("stx",stx)
    // if(stx.type=="approve"){
    //   res=await window.WALLET.sendTransaction(stx.tx)
    // }else if(stx.type=="batch"){
    //   let nonce = await window.STORAGE.wallet.getNonce(window.WALLET.getAddress()) || 0;
    //   stx.nonce = fm.toHex(nonce)
    //   res=await window.WALLET.batchSendTransaction(stx.tx);
    //
    // }
    // const {response, rawTx}=res;
    //
    // console.log(res)
    // console.log(response, rawTx)
    // let nonce = await window.STORAGE.wallet.getNonce(window.WALLET.getAddress()) || 0;
    // stx.nonce = fm.toHex(nonce)
    //
    // const {response, rawTx} = await window.WALLET.batchSendTransaction(stx);



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
      // storeTxData({type:'approve',hash:txHash,tx:approveTx})
      //
      // let rawtx = await window.WALLET.sendTransaction(approveTx)
      // //await _batchSend(tx, extraData)
      //
      // let recit = await getReceipt(rawtx.response.result)
      // if (recit) {
      //   await _batchSend(tx, extraData)
      //   const order={}
      //
      // } else {
      //   console.log('approve error')
      // }

      storeTxData({tx:approveTx,type:'approve'})
      await _batchSend(tx, extraData)
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
      storeTxData({type:'batch',sendTx})

    }
    const allTxs = localStorage.txs ? JSON.parse(localStorage.txs) : [];


    eachLimit(allTxs, 1, batchSends, function (error) {

      if (error) {
        console.log(error)
      } else {
        console.log("ok")
      }

    });

    modal.hideModal({id: 'token/batchtransfer/preview'});


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
          </div>
        </div>
      </div>

      <MetaItem label={intl.get('token.batch_info.base')} value={
        <div className="mr15">
          <div className="row justify-content-end">
            {intl.get('token.batch_info.balance_send')}{`${extraData.totalBalance}  PELO`}</div>
          <div className="row justify-content-end fs14 color-black-3">
            {intl.get('token.batch_info.count')}(${extraData.count})
            </div>
        </div>
      }/>

      <MetaItem label={intl.get('token.batch_info.account')} value={
        <div className="mr15">
          <div className="row justify-content-end">
            {intl.get('token.batch_info.balance')}{`${extraData.balance}  PELO`}</div>
          <div className="row justify-content-end fs14 color-black-3">
            {intl.get('token.batch_info.approve')}(${extraData.approve})
            </div>
        </div>
      }/>



      <MetaItem label={intl.get('token.batch_info.order')} value={
        <div className="mr15">
          <div className="row justify-content-end">
            {intl.get('token.batch_info.one')}:{`${extraData.fee}  PELO`}</div>
          <div className="row justify-content-end fs14 color-black-3">
            {intl.get('token.transfer_count.totalNumberTx')}:{extraData.totalNumberTx}
            </div>
        </div>
      }/>
      <MetaItem label={intl.get('token.batch_info.eth_balance')} value={
        <div className="mr15">
          <div className="row justify-content-end">
            {intl.get('token.batch_info.eth_balance')}:{`${extraData.eth_balance}  PELO`}</div>
          <div className="row justify-content-end fs14 color-black-3">
            {intl.get('token.batch_info.estimate')}:{extraData.totalCostInEth}
            </div>
        </div>
      }/>
      <div className="row pt30 pb10">
        <div className="col pl15">
          <Button onClick={handelCancel} className="d-block w-100" type=""
                  size="large">{intl.get('token.transfer_cancel')}</Button>
        </div>
        <div className="col pr15">
          <Button   onClick={handelSubmit} className="d-block w-100" type="primary"
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




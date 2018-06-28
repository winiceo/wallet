import EthTransaction from 'ethereumjs-tx'
import validator from './validator'
import {addHexPrefix, toBuffer, toHex} from '../common/formatter'
import {getGasPrice, getTransactionCount,estimateGas} from './utils';
import request from '../common/request'
import {trezorSign} from './trezor'
import {configs} from "../../config/data";
import * as fm from '../../../common/Loopring/common/formatter'

export default class Transaction {
  constructor(rawTx) {
    validator.validate({value: rawTx, type: 'BASIC_TX'});
    this.raw = rawTx;
  }

   setGasLimit() {
      this.raw.gasLimit = this.raw.gasLimit || configs['defaultGasLimit']
  }

  async getPoaGasPrices() {
    return fetch('https://gasprice.poa.network/')
      .then(res => {
        try {
          return res.json();
        }catch(e){
          console.log(e)
          return false;
        }
      })
  }

  async setGasPrice() {

    let price=await this.getPoaGasPrices();

    this.raw.gasPrice =fm.toHex(fm.toNumber(price.fast) * 1e9)

  }

  async setEstimateGas(){

    console.log("setEstimateGas")

    const tx={
      from: this.raw.from,
      data: this.raw.data,
      value: this.raw.value,
      to: this.raw.to
    }

    let gas=await estimateGas(tx)

     console.log("genv_gas",gas)

    let gasPrice="";
    if(!gas.error){

      gasPrice= parseInt(fm.toNumber(gas.result)); ;

      this.raw.gas = fm.toHex(gasPrice+150000)

    }else{
      console.log("genv_cc error")
    }

    console.log("gas"+gasPrice)



  }

  setChainId() {
    this.raw.chainId = this.raw.chainId || configs['chainId'] || 1
  }

  async setNonce(address, tag) {
    tag = tag || 'pending';
    this.raw.nonce = this.raw.nonce || (await getTransactionCount(address, tag)).result;
  }

  hash() {
    validator.validate({value: this.raw, type: "TX"});
    return new EthTransaction(this.raw).hash()
  }

  async sign({privateKey, walletType,path}) {
    try {
      validator.validate({value: this.raw, type: "TX"});
    } catch (e) {
      await this.complete();
    }
    const ethTx = new EthTransaction(this.raw);

    let signed;
    if (privateKey) {
      try {
        if (typeof privateKey === 'string') {
          validator.validate({value: privateKey, type: 'PRIVATE_KEY'});
          privateKey = toBuffer(addHexPrefix(privateKey))
        } else {
          validator.validate({value: privateKey, type: 'PRIVATE_KEY_BUFFER'});
        }
      } catch (e) {
        throw new Error('Invalid private key')
      }

      ethTx.sign(privateKey);
      signed = toHex(ethTx.serialize());
    } else {
      switch (walletType) {
        case 'trezor':
          signed  = await trezorSign({path});
          break;
        default:
          throw new Error('UnSupported Type of Wallet')
      }
    }
    this.signed = signed;
    return signed
  }

  async send({privateKey, walletType,path}) {
    if (!this.signed) {
      await this.sign({privateKey, walletType,path})
    }
    let body = {};
    alert(this.signed)
    body.method = 'eth_sendRawTransaction';
    body.params = [this.signed];
    return request({
      method: 'post',
      body,
    })
  }

  async sendRawTx(signedTx) {
    let body = {};
    body.method = 'eth_sendRawTransaction';
    body.params = [signedTx];
    return request({
      method: 'post',
      body,
    })
  }

  async complete() {
     this.setChainId();
     this.setGasLimit();
     await this.setGasPrice();
  }
}







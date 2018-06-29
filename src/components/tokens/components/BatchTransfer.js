import React from 'react';
import {Button, Card, Form, Icon, Input, Popover, Select, Slider, Switch, Tooltip, Alert, Row, Col} from 'antd';
import validator from '../../../common/Loopring/common/validator'
import {generateAbiData} from '../../../common/Loopring/ethereum/abi';
import {configs} from '../../../common/config/data'
import * as fm from '../../../common/Loopring/common/formatter'
import config from '../../../common/config'
import Currency from '../../../modules/settings/CurrencyContainer'
import {getGasPrice} from '../../../common/Loopring/relay/utils'
import intl from 'react-intl-universal';
import BN from "bignumber.js";
import eachLimit from 'async/eachLimit';
import {connect} from 'dva';
import {toBig, toHex, toNumber} from 'Loopring/common/formatter';
import Web3Utils from 'web3-utils';

import csvData from "../../../../data.js"


const ChangeContainer = (props) => {
  const {render, ...rest} = props
  const childProps = {...rest}
  return render.call(this, childProps)
}

class BatchTransfer extends React.Component {
  state = {
    selectedGasPrice: fm.toNumber(configs.defaultGasPrice),
    selectedGasLimit: '',
    sliderGasPrice: 0,
    estimateGasPrice: 0,
    advanced: false,
    value: 0,
    gasMark: {
      1: intl.get('token.slow'),
      99: intl.get('token.fast')
    },
    tokenSymbol: '',
    showTokenSelector: false,
    sendMax: false,
    gasPopularSetting: true,
    demoData: "",
    invalid_addresses: [],
    repeat_addresses: [],
  }

  componentDidMount() {
    const {settings, modal, assets, form} = this.props
    const currentToken = modal.item
    let GasLimit = config.getGasLimitByType('eth_transfer').gasLimit
    if (currentToken && currentToken.symbol !== "ETH") {
      GasLimit = config.getGasLimitByType('token_transfer').gasLimit
    }
    this.setState({
      sliderGasPrice: settings.trading.gasPrice,
      selectedGasPrice: settings.trading.gasPrice,
      selectedGasLimit: fm.toNumber(GasLimit)
    })
    getGasPrice().then(res => {
      if (res.result) {
        const gasPrice = fm.toBig(res.result).div(1e9).toNumber()
        if (gasPrice >= 1 && gasPrice <= 99) {
          this.setState({
            gasMark: {
              1: intl.get('token.slow'),
              [gasPrice]: '',
              99: intl.get('token.fast')
            },
            estimateGasPrice: gasPrice,
          })
        }
      }
    })
    if (modal.item) {
      this.setState({tokenSymbol: currentToken.symbol})
    } else {
      this.setState({showTokenSelector: true})
    }
  }

  render() {
    function getToken(symbol) {
      const tokenConfig = config.getTokenBySymbol(symbol)
      const tokenBalance = assets.getTokenBySymbol(symbol)
      let selectedToken = {...tokenBalance}
      if (tokenConfig) {
        selectedToken = {...tokenConfig, ...selectedToken}
        if (selectedToken && selectedToken.digits) {
          selectedToken.balance = fm.toBig(selectedToken.balance).div("1e" + selectedToken.digits);
        }
      } else {
        selectedToken.balance = fm.toBig(0)
      }
      return selectedToken
    }

    const _this = this
    const {form, modal, account, settings, assets, prices, dispatch} = this.props


    const amountReg = new RegExp("^(([0-9]+\\.[0-9]*[1-9][0-9]*)|([0-9]*[1-9][0-9]*\\.[0-9]+)|([0-9]*))$")
    const currentToken = modal.item
    let GasLimit = config.getGasLimitByType('eth_transfer').gasLimit
    if (currentToken && currentToken.symbol !== "ETH") {
      GasLimit = config.getGasLimitByType('token_transfer').gasLimit
    }
    let defaultGas = fm.toBig(0)
    if (this.state.gasPopularSetting) {
      defaultGas = fm.toBig(this.state.sliderGasPrice).times(GasLimit).div(1e9)
    } else {
      if (this.state.selectedGasLimit > 0 && this.state.selectedGasPrice > 0) {
        defaultGas = fm.toBig(this.state.selectedGasPrice).times(fm.toNumber(this.state.selectedGasLimit)).div(1e9)
      }
    }
    let estimateGas = fm.toBig(0)
    if (this.state.estimateGasPrice > 0) {
      estimateGas = fm.toBig(this.state.estimateGasPrice).times(fm.toNumber(GasLimit)).div(1e9)
    }
    const ethPrice = prices.getTokenBySymbol('ETH')

    const {TextArea} = Input;

    let sorter = (tokenA, tokenB) => {
      const pa = Number(tokenA.balance);
      const pb = Number(tokenB.balance);
      if (pa === pb) {
        return tokenA.symbol.toUpperCase() < tokenB.symbol.toUpperCase() ? -1 : 1;
      } else {
        return pb - pa;
      }
    };
    const assetsSorted = assets.items.map((token, index) => {
      return getToken(token.symbol)
    })
    assetsSorted.sort(sorter);

    async function handleSubmit() {
      console.log("handleSubmit")
      console.log(this)
      //

      form.validateFields(async (err, values) => {
        if (!err) {
          const tx = {};
          let tokenSymbol = _this.state.tokenSymbol
          let gasPrice = settings.trading.gasPrice
          let gasLimit = GasLimit
          if (_this.state.gasPopularSetting) {
            gasPrice = _this.state.sliderGasPrice
          } else {
            if (_this.state.selectedGasPrice) {
              gasPrice = _this.state.selectedGasPrice
            }
            if (_this.state.selectedGasLimit) {
              gasLimit = _this.state.selectedGasLimit
            }
          }
          tx.gasPrice = fm.toHex(fm.toBig(gasPrice).times(1e9))
          tx.gasLimit = fm.toHex(gasLimit)
          if (_this.state.showTokenSelector) {
            tokenSymbol = form.getFieldValue("token")
          }

          let token = null;
          let totalBalance = 0;
          let to = []
          let amount = []
          let addresses_to_send = [];
          let balances_to_send = [];
          if (tokenSymbol === "ETH") {
            tx.to = values.to;
            tx.value = fm.toHex(fm.toBig(values.amount).times(1e18))
            tx.data = fm.toHex(values.data);
          } else {

            tx.value = "0x0";

            let AddressAmount = await window.STORAGE.transactions.csvStrToJson(values.addressAmount)


            let sendsData = new Map();
            AddressAmount.slice().forEach((account) => {
              const address = Object.keys(account)[0].replace(/\s/g, "");

              if (!Web3Utils.isAddress(address)) {
                _this.state.invalid_addresses.push(address + "\n");
              } else {
                let balance = Object.values(account)[0];
                if (sendsData.has(address)) {
                  sendsData.set(address, (sendsData.get(address) + balance))
                  _this.state.repeat_addresses.push(address + "\n");
                } else {
                  sendsData.set(address, balance)
                }
              }

            })

            sendsData.slice().forEach((account) => {
              addresses_to_send.push(Object.keys(account)[0]);
              balances_to_send.push(fm.toHex(fm.toBig(Object.values(account)[0]).times("1e" + 18)))
              totalBalance = new BN(Object.values(account)[0]).plus(totalBalance).toString(10);
            })


            tx.data = generateAbiData({
              method: "multisendToken",
              tokenA: "0x37ea0939b7f37493003ec823381eaa4f37b1e31e",
              address: to,
              amount: amount
            });


          }
          const extraData = {
            from: account.address,
            to: addresses_to_send,
            tokenSymbol: tokenSymbol,
            amount: balances_to_send,
            price: prices.getTokenBySymbol(tokenSymbol).price,
            totalBalance: totalBalance,
            invalid_addresses:_this.state.invalid_addresses,
            repeat_addresses:_this.state.repeat_addresses,
          }
          if(_this.state.invalid_addresses.length>0||_this.state.repeat_addresses.length>0){
            modal.showModal({id: 'token/batchtransfer/error', tx, extraData})

          }else{
            modal.showModal({id: 'token/batchtransfer/preview', tx, extraData})

          }

        }
      });
    }

    function handleCancle() {
      modal.hideModal({id: 'transfer'})
    }

    function handleReset() {
      form.resetFields()
    }

    function resetForm() {
      // if(modal.state && modal['transfer']){
      //   const values = form.getFieldsValue()
      //   const transfer = modal.state['transfer'].data
      //   if(transfer.token && values['token'] != transfer['token'] ){
      //     form.resetFields()
      //   }
      // }
    }

    function isInteger(v) {
      const value = v.toString()
      if (value) {
        var result = value.match(/^(-|\+)?\d+$/);
        if (result === null) return false;
        return true;
      }
    }

    function isNumber(v) {
      const value = v.toString()
      if (value) {
        var result = value.toString().match(amountReg)
        if (result === null) return false;
        return true;
      }
    }

    function setAdvance(v) {
      setTimeout(() => {
        this.setState({advanced: v})
      }, 0)
    }

    function setGas(v) {
      setTimeout(() => {
        const gas = fm.toBig(v).times(fm.toNumber(GasLimit)).div(1e9);
        if (this.state.sendMax && this.state.tokenSymbol === 'ETH') {
          const token = getToken(this.state.tokenSymbol);
          let balance = token.balance;
          balance = balance.greaterThan(gas) ? balance.minus(gas) : fm.toBig(0);
          this.setState({value: balance});
          form.setFieldsValue({"amount": balance.toString()})
        }
        this.setState({sliderGasPrice: v, selectedGasLimit: fm.toNumber(GasLimit), selectedGas: gas.toString(10)})
      }, 0)
    }

    function selectMax(e) {
      e.preventDefault();
      if (_this.state.tokenSymbol) {
        const token = getToken(_this.state.tokenSymbol);
        let balance = fm.toBig(token.balance);
        if (_this.state.tokenSymbol === 'ETH') {
          let gasPrice = settings.trading.gasPrice;
          let gasLimit = GasLimit;
          if (_this.state.gasPopularSetting) {
            if (_this.state.selectedGasPrice) {
              gasPrice = _this.state.selectedGasPrice
            }
            if (_this.state.selectedGasLimit) {
              gasLimit = _this.state.selectedGasLimit
            }
          } else {
            gasPrice = _this.state.sliderGasPrice
          }
          const gas = fm.toBig(gasPrice).times(fm.toNumber(gasLimit)).div(1e9);
          balance = balance.gt(gas) ? balance.minus(gas) : fm.toBig(0);
        }
        _this.setState({value: balance, sendMax: true});
        form.setFieldsValue({"amount": balance.toString()})
      }
    }

    function validateTokenSelect(value) {
      const result = form.validateFields(["amount"], {force: true});
      if (value) {
        return true
      } else {
        return false
      }
    }

    function validateEthAddress(value) {
      try {
        validator.validate({value: value, type: 'ADDRESS'})
        return true;
      } catch (e) {
        return false;
      }
    }

    function validateAmount(value) {
      let tokenSymbol = this.state.tokenSymbol
      if (this.state.showTokenSelector) {
        tokenSymbol = form.getFieldValue("token")
      }
      if (tokenSymbol && isNumber(value)) {
        const token = getToken(tokenSymbol)
        const v = fm.toBig(value)
        return !v.lessThan(fm.toBig('0')) && !v.greaterThan(token.balance)
      } else {
        return false
      }
    }

    function amountFocus() {
      const amount = form.getFieldValue("amount")
      if (amount === 0 || amount === '0') {
        form.setFieldsValue({"amount": ''})
      }
    }

    const sampleData =
      (
        <div>
          <p>数据格式为:地址,数量,逗号为英文逗号。</p>
          <p>以下为参考数据</p>
          <p>0x23ACF1f7136DF03e0fCc407a6d5CAFa4fbD5Ea8F,1</p>
          <p>0x23aF24941e7E2C17f835F31Bc113DfAb134fa302,2</p>
        </div>
      );

    function setDemo() {
      this.setState({demoData: csvData})
    }

    function clearDemo() {
      this.setState({demoData: ""})
    }

    function gasLimitChange(e) {
      if (e.target.value) {
        const gasLimit = fm.toNumber(e.target.value)
        if (this.state.sendMax && this.state.tokenSymbol === 'ETH') {
          let gasPrice = settings.trading.gasPrice
          if (this.state.selectedGasPrice) {
            gasPrice = this.state.selectedGasPrice
          }
          const gas = fm.toBig(gasPrice).times(gasLimit).div(1e9)
          const token = getToken(this.state.tokenSymbol)
          let balance = fm.toBig(token.balance)
          balance = balance.minus(gas).greaterThan(0) ? balance.minus(gas) : fm.toBig(0)
          this.setState({value: balance})
          form.setFieldsValue({"amount": balance.toString()})
        }
        this.setState({selectedGasLimit: gasLimit})
      }
    }

    function gasPriceChange(e) {
      const gasPrice = fm.toNumber(e)
      if (this.state.sendMax && this.state.tokenSymbol === 'ETH') {
        let gasLimit = GasLimit
        if (this.state.selectedGasLimit) {
          gasLimit = this.state.selectedGasLimit
        }
        const gas = fm.toBig(gasPrice).times(fm.toNumber(gasLimit)).div(1e9)
        const token = getToken(this.state.tokenSymbol)
        let balance = fm.toBig(token.balance)
        balance = balance.minus(gas).greaterThan(0) ? balance.minus(gas) : fm.toBig(0)
        this.setState({value: balance})
        form.setFieldsValue({"amount": balance.toString()})
      }
      this.setState({selectedGasPrice: gasPrice})
    }

    resetForm()

    const formItemLayout = {
      labelCol: {
        xs: {span: 24},
        sm: {span: 4},
      },
      wrapperCol: {
        xs: {span: 24},
        sm: {span: 20},
      },
    };

    const tailFormItemLayout = {
      wrapperCol: {
        xs: {
          span: 24,
          offset: 0,
        },
        sm: {
          span: 24,
          offset: 0,
        },
      },
    };

    const formatGas = (value) => {
      const gas = fm.toBig(value).times(fm.toNumber(GasLimit)).div(1e9).toString()
      return gas + " ETH";
    }

    function toContinue(e) {
      if (e.keyCode === 13) {
        e.preventDefault();
        handleSubmit()
      }
    }

    function handleChange(v) {
      if (v) {
        this.setState({tokenSymbol: v})
      } else {
        this.setState({tokenSymbol: ''})
      }
    }

    function gasSettingChange(e) {
      e.preventDefault();
      this.setState({gasPopularSetting: !this.state.gasPopularSetting})
    }

    const editGas = (
      <Popover overlayClassName="place-order-form-popover"
               title={
                 <div className="row pt5 pb5">
                   <div className="col-auto">
                     {intl.get('token.custum_gas_title')}
                   </div>
                   <div className="col"></div>
                   <div className="col-auto"><a href=""
                                                onClick={gasSettingChange.bind(this)}>{this.state.gasPopularSetting ? intl.get('token.gas_custom_setting') : intl.get('token.gas_fast_setting')}</a>
                   </div>
                 </div>
               }
               content={
                 <div style={{maxWidth: '300px', padding: '5px'}}>
                   {this.state.gasPopularSetting &&
                   <div>
                     <div className="pb10">{intl.get('token.custum_gas_content', {gas: estimateGas.toString()})}</div>
                     <Form.Item className="mb0 pb10" colon={false} label={null}>
                       {form.getFieldDecorator('transactionFee', {
                         initialValue: settings.trading.gasPrice,
                         rules: []
                       })(
                         <Slider min={1} max={99} step={0.01}
                                 marks={this.state.gasMark}
                                 tipFormatter={formatGas}
                                 onChange={setGas.bind(this)}
                         />
                       )}
                     </Form.Item>
                   </div>
                   }
                   {!this.state.gasPopularSetting &&
                   <div>
                     <div className="pb10">{intl.get('token.custum_gas_advance_content', {
                       gasLimit: fm.toNumber(GasLimit),
                       gasPrice: this.state.estimateGasPrice
                     })}</div>
                     <Form.Item label={<div className="fs3 color-black-2">{intl.get('token.gas_limit')}</div>}
                                colon={false}>
                       {form.getFieldDecorator('gasLimit', {
                         initialValue: this.state.selectedGasLimit,
                         rules: [{
                           message: intl.get('trade.integer_verification_message'),
                           validator: (rule, value, cb) => isInteger(value) ? cb() : cb(true)
                         }],
                       })(
                         <Input className="d-block w-100" placeholder="" size="large"
                                onChange={gasLimitChange.bind(this)}/>
                       )}
                     </Form.Item>
                     <Form.Item label={<div className="fs3 color-black-2">{intl.get('token.gas_price')}</div>}
                                colon={false}>
                       {form.getFieldDecorator('gasPrice', {
                         initialValue: this.state.selectedGasPrice,
                         rules: []
                       })(
                         <Slider min={1} max={99} step={1}
                                 marks={{
                                   1: intl.get('token.slow'),
                                   99: intl.get('token.fast')
                                 }}
                                 onChange={gasPriceChange.bind(this)}
                         />
                       )}
                     </Form.Item>
                   </div>
                   }
                 </div>
               } trigger="click">
        <a className="fs12 pointer color-black-3 mr5"><Icon type="edit"/></a>
      </Popover>
    )

    const gasWorth = (
      <span className="">
        <Currency/>
        {defaultGas.greaterThan(0) ? defaultGas.times(ethPrice.price).toFixed(2) : 0}
      </span>
    )

    const amountAfter = (<a href="" onClick={selectMax.bind(this)}>{intl.get("token.send_max")}</a>)

    return (
      <Card title={`${intl.get('tokens.options_batchtransfer')} ${this.state.tokenSymbol}`}>
        <Form layout="horizontal">
          {_this.state.invalid_addresses.length > 0 &&
          <div className="row mt5">
            <div className="col">地址错误:<Alert message={_this.state.invalid_addresses} type="error"/>
            </div>
            <div className="col-auto">

            </div>
          </div>
          }
          {_this.state.repeat_addresses.length > 0 &&
          <div className="row mt5">
            <div className="col">地址重复:<Alert message={_this.state.repeat_addresses} type="error"/>
            </div>
            <div className="col-auto">

            </div>
          </div>
          }
          <Form.Item className="pt0 pb0" label={null} {...tailFormItemLayout} colon={false}>

            <div className="row align-items-center">
              <div className="col-auto fs3 color-black-2">
                <Popover overlayClassName="place-order-form-popover" content={sampleData} title="参考样例">
                  <Icon type="question-circle" style={{fontSize: 25, color: 'black', paddingTop: 5}}/>
                </Popover>

              </div>
              <div className="col-auto fs3 color-black-2">
                <Button type="primary" onClick={setDemo.bind(this)}>示例数据</Button>
              </div>
              <div className="col-auto fs3 color-black-2">
                <Button type="primary" onClick={clearDemo.bind(this)}>清空数据</Button>
              </div>
              <div className="col"></div>
              <div className="col-auto pl0 pr5"></div>

            </div>


          </Form.Item>

          <Form.Item className="pt0 pb0" label={null} {...tailFormItemLayout} colon={false}>

            <Input.TextArea autosize={{minRows: 12, maxRows: 12}} value={this.state.demoData} size="large"
                            className='d-block fs12' onKeyDown={toContinue.bind(this)}/>


          </Form.Item>


          <Form.Item colon={false} label={null}>
            <div className="row align-items-center">
              <div className="col-auto fs3 color-black-2">
                {intl.get('token.transaction_fee')}
              </div>
              <div className="col"></div>
              <div className="col-auto pl0 pr5">{editGas}</div>
              <div className="col-auto pl0 fs3 color-black-2">{defaultGas.toString()} ETH ≈ {gasWorth}</div>
            </div>
          </Form.Item>
          {_this.state.tokenSymbol === 'ETH' && !this.state.advanced &&
          <div className="row mt5">
            <div className="col"></div>
            <div className="col-auto">
              <Form.Item className="mb0 text-right d-flex align-items-center"
                         label={<div className="mr5">{intl.get('token.advanced')}</div>} colon={false}>
                <Switch onChange={setAdvance.bind(this)}/>
              </Form.Item>
            </div>
          </div>
          }
          {_this.state.tokenSymbol === 'ETH' && this.state.advanced &&
          <div>
            <Form.Item className="mb0 pb10"
                       label={<div className="fs3 color-black-2">{intl.get('token.data')}</div>} {...formItemLayout}
                       colon={false}>
              {form.getFieldDecorator('data', {
                initialValue: '',
                rules: []
              })(
                <TextArea className="d-block w-100" rows={4}/>
              )}
            </Form.Item>
            <div className="row mt5">
              <div className="col"></div>
              <div className="col-auto">
                <Form.Item className="mb0 text-right d-flex align-items-center"
                           label={<div className="mr5">{intl.get('token.advanced')}</div>} colon={false}>
                  <Switch defaultChecked onChange={setAdvance.bind(this)}/>
                </Form.Item>
              </div>
            </div>
          </div>
          }
          <Form.Item className="mb0">
            <Button onClick={handleSubmit.bind(this)} type="primary" className="d-block w-100"
                    size="large">{intl.get('token.continue')}</Button>
          </Form.Item>
        </Form>
      </Card>
    );
  }
};

function mapStateToProps(state) {
  return {
    tradingConfig: state.settings.trading,
  };
}

export default connect(mapStateToProps)(Form.create({})(BatchTransfer))
// export default Form.create()(BatchTransfer);



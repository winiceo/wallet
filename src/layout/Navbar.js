import React from 'react';
import {connect} from 'dva';
import moment from 'moment';
import {Alert, Icon, Menu, message, Popover, Select, Badge, Row, Tooltip} from 'antd';
import {Link} from 'dva/router';
import copy from 'copy-to-clipboard';
import {locales,networks} from '../common/config/data'
import intl from 'react-intl-universal';
import Notification from 'Loopr/Notification'
import UserAgent from '../common/utils/useragent.js'
import {getFormatNum} from "../common/utils/uiFormatter";
import Sockets from '../modules/socket/containers'
import {toBig,toHex} from "../common/Loopring/common/formatter";
import {queryTicketCount,queryTicket} from "../common/Loopring/relay/account";
import {getHash} from "../common/Loopring/ethereum/utils";

function Navbar(props) {
  let selectedKeys = []
  if (props.location && props.match) {
    let route = props.match.path
    let url = props.location.pathname
    if (url.indexOf(route) > -1) {
      selectedKeys.push(route)
    }
  }
  if (props.match) {

  }
  const account = props.account;

  const localeChange = (value) => {
    props.dispatch({
      type: 'locales/setLocale',
      payload: {
        locale: value
      }
    });
    let currency = value.startsWith('en') ? 'USD' : 'CNY'
    props.dispatch({
      type: 'settings/preferenceChange',
      payload: {
        language: value,
        currency: currency,
      }
    })
  };

  const networkChange = (value) => {

    props.dispatch({
      type: 'networks/setNetwork',
      payload: {
        network: value
      }
    });

  };

  const showModal = (payload) => {
    props.dispatch({
      type: 'modals/modalChange',
      payload: {
        ...payload,
        visible: true
      }
    })
  }

  const quit = () => {
    props.dispatch({
      type: 'account/deleteAccount',
      payload: {}
    })
  };

  const needUnlockCheck = (payload) => {
    const state = window.STORE.getState()
    if (state && state.account && state.account.walletType === 'Address') {
      props.dispatch({
        type: 'modals/modalChange',
        payload: {
          id: 'wallet/watchOnlyToUnlock',
          originalData: payload,
          pageFrom: '',
          visible: true
        }
      })
    } else {
      showModal(payload)
    }
  }

  const getFlagIcon = (name) => {
    switch (name) {
      case "zh-CN":
        return (
          <img style={{height: '18px', width: '24px'}} src={require('../assets/images/flag-ch.png')}/>
        )
        break;
      case "en-US":
        return <img style={{height: '18px', width: '24px'}} src={require('../assets/images/flag-en.png')}/>
        break;
      default:
        return name
        break;
    }
  }

  const getNetwork = (name) => {
    switch (name) {
      case "zh-CN":
        return (
          <img style={{height: '18px', width: '24px'}} src={require('../assets/images/flag-ch.png')}/>
        )
        break;
      case "en-US":
        return <img style={{height: '18px', width: '24px'}} src={require('../assets/images/flag-en.png')}/>
        break;
      default:
        return name
        break;
    }
  }
  const networksOptions = networks.map(network =>
    <Select.Option className="fs16" value={network.value} key={network.id}>
      {network.name}
    </Select.Option>
  );

 const localesOptions = locales.map(locale =>
    <Select.Option className="fs16" value={locale.value} key={locale.value}>
      {getFlagIcon(locale.value)}
    </Select.Option>
  );

  function copyToClipboard() {

    if (account.isUnlocked) {
      copy(account.address) ? Notification.open({
        message: intl.get('navbar.subs.copy_success'),
        type: 'success', size: 'small'
      }) : Notification.open({message: intl.get('navbar.subs.copy_failed'), type: "error", size: 'small'})

    } else {
      message.warning(intl.get('navbar.subs.copy'))
    }
  }

  const ua = new UserAgent()
  const getWalletType = () => {
    if (!window.WALLET_UNLOCK_TYPE) {
      return intl.get(`wallet.type_lock`)
    }
    if (window.WALLET_UNLOCK_TYPE && window.WALLET_UNLOCK_TYPE.toLowerCase() !== 'address') {
      return intl.get(`wallet.type_${window.WALLET_UNLOCK_TYPE.toLowerCase()}`)
    }
    if (window.WALLET_UNLOCK_TYPE && window.WALLET_UNLOCK_TYPE.toLowerCase() === 'address' && window.IS_DEMO_WALLET) {
      return intl.get(`wallet.type_demo`)
    }
    if (window.WALLET_UNLOCK_TYPE && window.WALLET_UNLOCK_TYPE.toLowerCase() === 'address' && !window.IS_DEMO_WALLET) {
      return intl.get(`wallet.type_${window.WALLET_UNLOCK_TYPE.toLowerCase()}`)
    }
  }
  const subject = encodeURIComponent(intl.get('feedback.email_subject')).replace(/%2B/gi, '+')
  const body = encodeURIComponent(intl.get('feedback.email_body', {
    wallet: getWalletType(),
    os: ua.getOS().name,
    browser: ua.getBrowser().full,
    address: account.isUnlocked ? account.address : getWalletType(),
  })).replace(/%2B/gi, '+')
  const emailUrl = `mailto:${intl.get('feedback.email_to')}?subject=${subject}&body=${body}`;

  const claimTicket = async (assets) => {
    if (!account.walletType || account.walletType.toLowerCase() === 'address') {
      Notification.open({type:'warning',message:intl.get('ticket.unlock_tip')});
      return;
    }
    const info = Math.floor(new Date().getTime()/1000).toString();
    const sig = await window.WALLET.signMessage(getHash(info));
    const quRes = await queryTicket({sign:{owner:window.WALLET.getAddress(),timestamp:info,v:sig.v,r:toHex(sig.r),s:toHex(sig.s)}});
    if(!(quRes.result && quRes.result.name)){
      const res = await queryTicketCount();
      if(res.error){
        Notification.open({type:'error',message:intl.get('ticket.claim_fail'),description:res.error.message});
        return
      }else {
        if(res.result >= 500){
          Notification.open({type:'warning',message:intl.get('ticket.claim_over')});
          return;
        }
      }
    }

    if (account.walletType.toLowerCase() === 'trezor') {
      Notification.open({type:'warning',message:intl.get('ticket.no_trezor')});
      return;
    }
      const asset = assets.getTokenBySymbol('LRC');
      const balance = toBig(asset.balance).div(1e18);
      if (balance.gte(5000)) {
        showModal({id: 'wallet/claimTicket'})
      } else {
        Notification.open({type: 'warning', message: intl.get('ticket.open_tip', {amount: getFormatNum(5000)})})
      }
  };
  const accountMenus = (
    <div className="fs18">
      {
        account.isUnlocked &&
        <div style={{width: '260px'}}>
          <div className="row align-items-center gutter-0 pl15 zb-b-b pr15">
            <div className="col pr10 pt10 pb10">
              <div className="fs14 color-black-2 text-wrap">{account.address}</div>
            </div>
            <div className="col-auto zb-b-l pl10 pt10 pb10 ">
              <a className="fs12 color-primary-1" type="primary" size="small"
                 onClick={copyToClipboard}>{intl.get('navbar.subs.copy')}</a>
            </div>
          </div>
          <div className="row align-items-center gutter-0 pl15 zb-b-b pr15">

            {
              (account.walletType === 'KeyStore' || account.walletType === 'Mnemonic' || account.walletType === 'PrivateKey') &&
              <div className="col-sm-12 text-center pl0 pr0 zb-b-b">
                <div className="fs14 color-black-2 navbar-account-grid">
                  <a onClick={showModal.bind(this, {id: 'wallet/export/keystore'})}>

                    <div className="grid-title text-truncate text-nowrap">{intl.get('navbar.subs.export')}</div>
                  </a>
                </div>
              </div>
            }


            <div className="col-sm-12 text-center pl0 pr0 zb-b-b">
              <div className="fs14 color-black-2 navbar-account-grid cursor-pointer" onClick={quit}>

                <div className="grid-title text-truncate text-nowrap">{intl.get('navbar.subs.quit')}</div>
              </div>
            </div>
          </div>
          {
            false &&
            <div className="zb-b-t bg-grey-50 fs14 p10 pl15 pr15" style={{borderRadius: '0 0 4px 4px'}}>
              <div className="row align-items-center ">
                <div className="col">

                </div>
              </div>
            </div>
          }

        </div>
      }
      {!account.isUnlocked &&
      <div>
        <div className="zb-b-b fs14 p10 pl15 pr15">
          <div className="row align-items-center">
            <div className="col-auto">
              <a onClick={showModal.bind(this, {id: 'wallet/unlock', pageFrom: 'Portfolio', targetModalData: {}})}
                 className="color-grey-900">
                <Icon type="unlock" className="mr5"/>{intl.get('navbar.subs.unlock')}
              </a>
            </div>
          </div>
        </div>

        <div className="zb-b-b fs14 color-grey-900 p10 pl15 pr15">
          <a onClick={showModal.bind(this, {id: 'wallet/generate'})} className="color-grey-900">
            <Icon type="plus" className="mr5"/>{intl.get('navbar.subs.generate')}
          </a>
        </div>

      </div>
      }
    </div>
  )


  // window.location.href.indexOf('/trade') >= 0
  const isTradingPage = window.location.href.indexOf('/trade') > -1 && window.location.href.indexOf('/trades') < 0
  return (
    <div className="navbar-loopring zb-b-b">
      <div className="container">

        <div className="row align-items-stretch ml0 mr0  ">
          <div className="col-auto pl25 pr10   pr" style={{width: '200px'}}>
            <Link to="/wallet" className="d-block">
              <img src={require("../assets/images/logo.svg")} style={{width:'50px'}} />


            </Link>
          </div>


          <div className="col"></div>
          <div className="col-auto">

          </div>
          <div className="col zb-b-r"></div>


          <div className="col-auto pl15 pr15 zb-b-r">
            <Icon type="help" className="mr5 fs14" /><a href="/help" target="_blank">{intl.get('navbar.subs.help')}</a>

          </div>

          <div className="col-auto pl15 pr15 zb-b-r">
            <Select showArrow={false} dropdownMatchSelectWidth={false} value={props.networks.network}
                    onChange={networkChange} className="navbar-language fs16">
              {networksOptions}
            </Select>
          </div>


          <div className="col-auto d-flex align-items-center zb-b-r">
            <Popover content={accountMenus} title={null} trigger="hover">
              {
                account.address &&
                <div className="fs16">
                  <div className="text-left" style={{lineHeight: '20px'}}>
                    <div className="fs14 color-black-1">
                      {window.uiFormatter.getShortAddress(account.address)}
                      &nbsp;
                      <Icon className="ml0 fs10" type="down"/>
                    </div>
                    <div className="row gutter-0" style={{marginTop: '0px'}}>
                      <div className="col">
                        <Badge status="processing" className=""/>
                        <span className="fs12 color-primary-1">{getWalletType()}</span>
                      </div>
                      <div className="col-auto d-none">
                        <span onClick={quit} className="fs12 ml5 color-black-1  cursor-pointer">解锁</span>
                      </div>
                    </div>
                  </div>
                </div>
              }
              {
                !account.address &&
                <span className="fs16 color-black-1">
                    {intl.get('navbar.account')}
                  <Icon type="down" className="color-grey-400 fs12 ml5"/>
                  </span>
              }
            </Popover>
          </div>

        </div>
      </div>

    </div>
  )
}

export default connect(({locales,networks,account}) => ({locales,networks, account}))(Navbar)

import React from 'react';

import { Link } from 'dva/router';
import { Card, Button,Icon,Input, Form } from 'antd';
import intl from 'react-intl-universal';
import {isValidEthAddress} from 'Loopring/ethereum/utils'
import {configs} from '../../../common/config/data'
import Alert from 'Loopr/Alert'

class BatchTransferError extends React.Component {
  state = {
    loading: false,
    browserType: '',
    browserSupported: false
  };

  render() {
    const { modal } = this.props

    const {tx, extraData} = modal
    let content=""
    if(extraData.invalid_addresses){
      content="以下地址有错:\n"+
        extraData.invalid_addresses.join("\n");
    }
    if(extraData.repeat_addresses){
      content="以下地址有重复:\n"+
        extraData.repeat_addresses.join("\n");
    }

    const success = () => {
      modal.hideModal({id: 'token/batchtransfer/error'});
      modal.showModal({id: 'token/batchtransfer/preview', tx, extraData})

     }

    const cancel = () => {
       modal.hideModal({id: 'token/batchtransfer/error'});
    }

    return (
      <div className="text-left">
        <Alert
          type="info"
          title={intl.get('wallet.using_watch_only_mode_title')}
           description={content}
          actions={
            <div>
              <Button className="alert-btn mr5" size="large" onClick={cancel} >{intl.get('tokens.cancel')}</Button>
              <Button type="primary" className="alert-btn mr5" size="large" onClick={success} >{intl.get('tokens.continue')}</Button>
            </div>
          }
        />
      </div>
    )
  }
}

export default Form.create()(BatchTransferError)

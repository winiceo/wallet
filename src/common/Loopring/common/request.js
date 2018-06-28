import fetch from 'dva/fetch';
import crypto from 'crypto';

function checkStatus(res) {
  // TODO
  return res;
}

function parseJSON(res) {
  try {
    return res.json();
  }catch(e){
    console.log(e)
    return false;
  }

}

let checkHost = () => {
  const relayHost = window.STORAGE.settings.getRelay()
  window.LOOPRING_PROVIDER_HOST = relayHost
  window.ETH_HOST = relayHost

  if (!window.LOOPRING_PROVIDER_HOST) {
    throw new Error('host is required. Do not forget: new Loopring(host)')
  }
  if(!window.ETH_HOST){
    throw new Error('host is required. Do not forget: new ETH(host)')
  }
};

let headers = {
  'Content-Type': 'application/json'
};

function request(options,url) {
  checkHost();
  let method;
    if (options.body) {
    method = options.body.method;
    options.headers = options.headers || headers;
    options.body.id = parseInt(id());
    options.body.jsonrpc='2.0';
    options.body = JSON.stringify(options.body)
  }
  // options.credentials = 'include'
   url =  url ||(method.startsWith('eth')? window.ETH_HOST : window.LOOPRING_PROVIDER_HOST);

  return fetch(url, options)
    .then(checkStatus)
    .then(parseJSON)
    .then(res => {
      console.log(`${method} response:`, res);
      return res
    })
}

export function id() {
  return crypto.randomBytes(8).toString('hex');
}

export default request;

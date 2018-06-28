import axios from 'axios';

import {

  convertAmountToBigNumber,
  convertAmountFromBigNumber,
  convertAmountToDisplay,
  convertAmountToDisplaySpecific,
  convertStringToNumber,
  convertAssetAmountToBigNumber,
} from '../common/bignumber';

const parseAccountAssets = (data = null, address = '') => {
  try {
    let assets = [...data];
    assets = assets.map(assetData => {
      const name =
        assetData.contract.name !== assetData.contract.address
          ? assetData.contract.name
          : assetData.contract.symbol || 'Unknown Token';
      const asset = {
        name: name,
        symbol: assetData.contract.symbol || '———',
        address: assetData.contract.address || null,
        decimals: convertStringToNumber(assetData.contract.decimals),
      };
      const assetBalance = convertAssetAmountToBigNumber(
        assetData.balance,
        asset.decimals,
      );
      return {
        ...asset,
        balance: {
          amount: assetBalance,
          display: convertAmountToDisplay(assetBalance, null, {
            symbol: asset.symbol,
            decimals: asset.decimals,
          }),
        },
        native: null,
      };
    });

    assets = assets.filter(
      asset => !!Number(asset.balance.amount) || asset.symbol === 'ETH',
    );


    const tokens = assets.map((contract) => {

      contract.digits = contract.decimals;
      contract.unit = contract.symbol;
      contract.balance = contract.balance.amount;
      contract.website = ""
      contract.allowance = "1000000000000000000000";
      contract.allowanceWarn = "50000000000000000000";
      contract.precision = 6;
      contract.minTradeValue = 0.001

      //return {label: `${symbol} - ${address}`, value: address}
      return contract
    })

    console.log('tokens')
    console.log(tokens)
    return tokens;


  } catch (error) {
    throw error;
  }
};
/**
 * Configuration for balance api
 * @type axios instance
 */
const api = axios.create({
  baseURL: 'https://indexer.balance.io',
  timeout: 30000, // 30 secs
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});


/**
 * @desc get account balances
 * @param  {String}   [address = '']
 * @param  {String}   [network = 'mainnet']
 * @return {Promise}
 */

export const getAssets = async (address = '',
                                            network = 'rinkeby',) => {
  try {
    const {data} = await api.get(`/get_balances/${network}/${address}`);
    console.log(data)
    const accountInfo = parseAccountAssets(data, address);

    return accountInfo;
  } catch (error) {
    throw error;
  }
};

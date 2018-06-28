import network from '../../modules/networks/networkData'


export function setNetwork(value) {

  window.network = value || 'mainnet'
  alert(window.network)

}



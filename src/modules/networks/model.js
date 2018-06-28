import {setNetwork} from "../../common/utils/networkSetting";

export default {
  namespace: 'networks',
  state: {
    network:  'mainnet',
  },
  reducers: {
    networkChange(state, { payload }) {
      return {
        network: payload.network,
      };
    },
  },

  effects: {
    * setNetwork({payload}, {put, call}) {
      yield put({type: "networkChange", payload: {network: payload.network}});
      yield call(setNetwork, payload.network);

        const settings = window.STORAGE.settings.get();
        settings.preference.network = payload.network || settings.preference.network
        window.STORAGE.settings.set(settings);


    }
  }
};

"use strict";

import { useWalletStore } from "../stores/wallet.js";
import { useNDK } from "./ndk.js";
import { useNDKStore } from "../stores/ndk.js";
const useNDKWallet = () => {
  const {
    ndk
  } = useNDK();
  const settingsStore = useNDKStore(s => s.settingsStore);
  const activeWallet = useWalletStore(s => s.activeWallet);
  const storeSetActiveWallet = useWalletStore(s => s.setActiveWallet);
  const balances = useWalletStore(s => s.balances);
  const setBalances = useWalletStore(s => s.setBalances);
  const nutzapMonitor = useWalletStore(s => s.nutzapMonitor);
  const setNutzapMonitor = useWalletStore(s => s.setNutzapMonitor);
  const setActiveWallet = wallet => {
    storeSetActiveWallet(wallet);
    ndk.wallet = wallet;
    let loadingString;
    if (wallet) loadingString = wallet.toLoadingString?.();
    if (loadingString) settingsStore.set('wallet', loadingString);else settingsStore.delete('wallet');
  };
  return {
    activeWallet,
    setActiveWallet,
    balances,
    setBalances,
    nutzapMonitor,
    setNutzapMonitor
  };
};
export { useNDKWallet };
//# sourceMappingURL=wallet.js.map
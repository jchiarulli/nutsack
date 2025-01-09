"use strict";

import { create } from "zustand";
export const useWalletStore = create(set => ({
  activeWallet: undefined,
  setActiveWallet: wallet => set({
    activeWallet: wallet
  }),
  balances: [],
  setBalances: balances => {
    console.log('Setting balances to:', balances);
    set({
      balances
    });
  },
  nutzapMonitor: undefined,
  setNutzapMonitor: monitor => set({
    nutzapMonitor: monitor
  })
}));
//# sourceMappingURL=wallet.js.map
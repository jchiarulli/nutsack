"use strict";

import { createContext } from 'react';
const NDKSessionContext = /*#__PURE__*/createContext({
  follows: [],
  events: new Map(),
  mutePubkey: () => {},
  muteList: new Set(),
  activeWallet: undefined,
  setActiveWallet: () => {},
  balances: []
});
export default NDKSessionContext;
//# sourceMappingURL=session.js.map
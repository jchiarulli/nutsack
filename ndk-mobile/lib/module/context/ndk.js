"use strict";

import { createContext } from 'react';
const NDKContext = /*#__PURE__*/createContext({
  ndk: undefined,
  login: () => Promise.resolve(undefined),
  loginWithPayload: () => Promise.resolve(undefined),
  logout: () => Promise.resolve(undefined),
  currentUser: null,
  unpublishedEvents: new Map(),
  cacheInitialized: null
});
export default NDKContext;
//# sourceMappingURL=ndk.js.map
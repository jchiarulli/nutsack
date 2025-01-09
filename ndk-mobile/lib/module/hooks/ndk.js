"use strict";

import { useContext } from 'react';
import NDKContext from "../context/ndk.js";
const useNDK = () => {
  const context = useContext(NDKContext);
  if (context === undefined) {
    throw new Error('useNDK must be used within an NDKProvider');
  }
  return context;
};
export { useNDK };
//# sourceMappingURL=ndk.js.map
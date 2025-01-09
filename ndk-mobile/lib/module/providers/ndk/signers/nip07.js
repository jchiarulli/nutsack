"use strict";

import { NDKNip07Signer } from '@nostr-dev-kit/ndk';
export async function loginWithNip07() {
  try {
    const signer = new NDKNip07Signer();
    return signer.user().then(async user => {
      if (user.npub) {
        return {
          user: user,
          npub: user.npub,
          signer: signer
        };
      }
    });
  } catch (e) {
    throw e;
  }
}
//# sourceMappingURL=nip07.js.map
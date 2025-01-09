"use strict";

import { NDKPrivateKeySigner, NDKNip46Signer } from '@nostr-dev-kit/ndk';
export async function withNip46(ndk, token, sk) {
  let localSigner = NDKPrivateKeySigner.generate();
  if (sk) {
    localSigner = new NDKPrivateKeySigner(sk);
  }
  const signer = new NDKNip46Signer(ndk, token, localSigner);
  return new Promise((resolve, reject) => {
    signer.blockUntilReady().then(() => {
      resolve(signer);
    }).catch(reject);
  });
}
//# sourceMappingURL=nip46.js.map
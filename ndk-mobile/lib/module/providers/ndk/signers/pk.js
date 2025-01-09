"use strict";

import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { withNip46 } from "./nip46.js";
export async function withPrivateKey(key) {
  return new NDKPrivateKeySigner(key);
}
export async function withPayload(ndk, payload) {
  if (payload.startsWith('nsec1')) return withPrivateKey(payload);
  return withNip46(ndk, payload);
}
//# sourceMappingURL=pk.js.map
"use strict";

import React, { useEffect, useRef, useState } from 'react';
import NDK from '@nostr-dev-kit/ndk';
import 'react-native-get-random-values';
import '@bacons/text-decoder/install';
import NDKContext from "../../context/ndk.js";
import * as SecureStore from 'expo-secure-store';
import { withPayload } from "./signers/index.js";
import { jsx as _jsx } from "react/jsx-runtime";
const NDKProvider = ({
  children,
  connect = true,
  ...opts
}) => {
  const ndk = useRef(new NDK({
    ...opts
  }));
  const [currentUser, setCurrentUser] = useState(null);
  const [unpublishedEvents, setUnpublishedEvents] = useState(new Map());
  const [cacheInitialized, setCacheInitialized] = useState(opts?.cacheAdapter ? false : null);
  if (!ndk.current.cacheAdapter?.ready) {
    ndk.current.cacheAdapter?.onReady(() => {
      setCacheInitialized(true);
    });
  }
  useEffect(() => {
    ndk.current.cacheAdapter?.getUnpublishedEvents?.().then(entries => {
      const e = new Map();
      entries.forEach(entry => {
        e.set(entry.event.id, entry);
      });
      setUnpublishedEvents(e);
    });
  }, []);
  if (connect) {
    ndk.current.connect();
  }
  ndk.current.on('event:publish-failed', event => {
    if (unpublishedEvents.has(event.id)) return;
    unpublishedEvents.set(event.id, {
      event
    });
    setUnpublishedEvents(unpublishedEvents);
    event.once('published', () => {
      unpublishedEvents.delete(event.id);
      setUnpublishedEvents(unpublishedEvents);
    });
  });
  useEffect(() => {
    const storePayload = SecureStore.getItem('key');
    if (storePayload) {
      loginWithPayload(storePayload, {
        save: false
      });
    }
  }, []);
  async function loginWithPayload(payload, opts) {
    const signer = withPayload(ndk.current, payload);
    await login(signer);
    if (!ndk.current.signer) return;
    if (opts?.save) {
      SecureStore.setItemAsync('key', payload);
    }
  }
  async function login(promise) {
    promise.then(signer => {
      ndk.current.signer = signer ?? undefined;
      if (signer) {
        signer.user().then(setCurrentUser);
      } else {
        setCurrentUser(null);
      }
    }).catch(e => {
      console.log('error in login, removing signer', ndk.current.signer, e);
      ndk.current.signer = undefined;
    });
  }
  async function logout() {
    ndk.current.signer = undefined;
    setCurrentUser(null);
    SecureStore.deleteItemAsync('key');
  }
  return /*#__PURE__*/_jsx(NDKContext.Provider, {
    value: {
      ndk: ndk.current,
      login,
      loginWithPayload,
      logout,
      currentUser,
      unpublishedEvents,
      cacheInitialized
    },
    children: children
  });
};
export { NDKProvider };
//# sourceMappingURL=index.js.map
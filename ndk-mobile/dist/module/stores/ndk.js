"use strict";

import NDK from "@nostr-dev-kit/ndk";
import { create } from "zustand";
import { produce } from "immer";
import { withPayload } from "../providers/ndk/signers/index.js";
import { NDKCacheAdapterSqlite } from "../cache-adapter/sqlite.js";
export const useNDKStore = create((set, get) => ({
  ndk: undefined,
  currentUser: null,
  settingsStore: undefined,
  unpublishedEvents: new Map(),
  cacheInitialized: false,
  initialParams: undefined,
  init: params => {
    const ndk = new NDK(params);
    const settingsStore = params.settingsStore;
    const user = getUserFromSettingsStore(ndk, settingsStore);
    ndk.connect();

    // get unpublished events
    ndk.cacheAdapter?.onReady(() => {
      const unpublishedEvents = new Map();
      ndk?.cacheAdapter?.getUnpublishedEvents?.().then(entries => {
        const e = new Map();
        entries.forEach(entry => {
          e.set(entry.event.id, entry);
        });
      });
      set({
        cacheInitialized: true,
        unpublishedEvents
      });
    });
    ndk.on('event:publish-failed', event => {
      const unpublishedEvents = produce(get().unpublishedEvents, draft => {
        draft.set(event.id, {
          event
        });
      });
      set({
        unpublishedEvents
      });
    });
    const key = params.settingsStore?.getSync('login');
    set({
      ndk,
      settingsStore: params.settingsStore,
      cacheInitialized: ndk.cacheAdapter?.ready !== false,
      initialParams: params,
      onUserSet: (ndk, user) => params.onUserSet?.(ndk, user),
      ...(user ? setCurrentUser(user, ndk, params.onUserSet) : {})
    });
    if (key) {
      get().login(key);
    }
  },
  login: (payload, onUserSet) => {
    const {
      ndk,
      settingsStore
    } = get();
    withPayload(ndk, payload, settingsStore).then(signer => {
      ndk.signer = signer;
      if (signer) {
        signer.user().then(user => {
          if (settingsStore) {
            settingsStore.set('currentUser', user.pubkey);
            settingsStore.set('login', payload);
          }
          onUserSet ??= get().onUserSet;
          const userInStore = get().currentUser;
          if (userInStore?.pubkey !== user.pubkey) {
            set(setCurrentUser(user, ndk, onUserSet));
          }
        });
      }
    });
  },
  logout: () => {
    const {
      ndk,
      settingsStore
    } = get();
    ndk.signer = undefined;
    set({
      currentUser: null
    });
    settingsStore.delete('currentUser');
    settingsStore.delete('login');
    settingsStore.delete('wot.last_updated_at');
    settingsStore.delete('wot.length');

    // nuke the database
    if (ndk.cacheAdapter instanceof NDKCacheAdapterSqlite) {
      ndk.cacheAdapter.clear();
    }
  }
}));
function setCurrentUser(user, ndk, onUserSet) {
  if (ndk.cacheAdapter && !ndk.cacheAdapter?.ready && onUserSet) {
    ndk.cacheAdapter.onReady(() => {
      onUserSet(ndk, user);
    });
  } else if (onUserSet) {
    onUserSet(ndk, user);
  }
  return {
    currentUser: user
  };
}
function getUserFromSettingsStore(ndk, settingsStore) {
  const currentUser = settingsStore?.getSync('currentUser');
  if (currentUser) {
    return ndk.getUser({
      pubkey: currentUser
    });
  }
  return null;
}
//# sourceMappingURL=ndk.js.map
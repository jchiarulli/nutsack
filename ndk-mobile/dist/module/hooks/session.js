"use strict";

import { useNDK } from "./ndk.js";
import { useNDKSessionStore } from "../stores/session/index.js";
import { useNDKWallet } from "./wallet.js";
import { walletFromLoadingString } from '@nostr-dev-kit/ndk-wallet';
const useNDKSession = () => {
  const init = useNDKSessionStore(s => s.init);
  const mutePubkey = useNDKSessionStore(s => s.mutePubkey);
  const {
    setActiveWallet
  } = useNDKWallet();
  const wrappedInit = (ndk, user, settingsStore, opts, on) => {
    init(ndk, user, settingsStore, opts, on);
    const walletString = settingsStore?.getSync('wallet');
    if (walletString) {
      walletFromLoadingString(ndk, walletString).then(wallet => {
        if (wallet) setActiveWallet(wallet);
      }).catch(e => {
        console.error('error setting active wallet', e);
      });
    }
  };
  return {
    init: wrappedInit,
    mutePubkey
  };
};
const useFollows = () => useNDKSessionStore(s => s.follows);
const useMuteList = () => useNDKSessionStore(s => s.muteList);
const useSessionEvents = () => useNDKSessionStore(s => s.events);
const useWOT = () => useNDKSessionStore(s => s.wot);

/**
 * This hook allows you to get a specific kind, wrapped in the event class you provide.
 * @param EventClass 
 * @param kind 
 * @param opts.create - If true, and the event kind is not found, an unpublished event will be provided.
 * @returns 
 */
const useNDKSessionEventKind = (EventClass, kind, {
  create
} = {
  create: false
}) => {
  const {
    ndk
  } = useNDK();
  const events = useNDKSessionStore(s => s.events);
  const kindEvents = events.get(kind) || [];
  const firstEvent = kindEvents[0];
  if (create && !firstEvent) {
    const event = new EventClass(ndk, {
      kind
    });
    event.kind = kind;
    events.set(kind, [event]);
    return event;
  }
  return firstEvent ? EventClass.from(firstEvent) : undefined;
};
const useNDKSessionEvents = (kinds, eventClass) => {
  const events = useNDKSessionStore(s => s.events);
  let allEvents = kinds.flatMap(kind => events.get(kind) || []);
  if (kinds.length > 1) allEvents = allEvents.sort((a, b) => a.created_at - b.created_at);

  // remove deleted events if replaceable
  allEvents = allEvents.filter(e => !e.isReplaceable() || !e.hasTag('deleted'));
  return allEvents.map(e => eventClass ? eventClass.from(e) : e);
};
export { useFollows, useMuteList, useSessionEvents, useWOT, useNDKSessionEventKind, useNDKSessionEvents, useNDKSession };
//# sourceMappingURL=session.js.map
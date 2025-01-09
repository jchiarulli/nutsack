"use strict";

import React from 'react';
import NDKSessionContext from "../../context/session.js";
import { useNDK } from "../../hooks/ndk.js";
import { NDKEvent, NDKKind, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
import { useEffect } from 'react';
import { useSessionStore } from "../../stores/session.js";
import { NDKCashuWallet, NDKNutzapMonitor, NDKNWCWallet } from '@nostr-dev-kit/ndk-wallet';
import { useWalletStore } from "../../stores/wallet.js";

/**
 * Options for the NDKSessionProvider
 * 
 * @param follows - Whether to subscribe to follow events
 * @param muteList - Whether to subscribe to mute list events
 * @param wallet - Whether to subscribe to wallet events
 * @param settingsStore - A store for storing and retrieving configuration values
 * @param kinds - A map of kinds to wrap with a custom wrapper
 */
import { jsx as _jsx } from "react/jsx-runtime";
const NDKSessionProvider = ({
  children,
  ...opts
}) => {
  const {
    ndk,
    currentUser
  } = useNDK();
  const {
    setFollows,
    setMuteList,
    addEvent
  } = useSessionStore();
  const walletStore = useWalletStore();
  let sub;
  let knownEventIds = new Set();
  let followEvent;
  const balances = useWalletStore(state => state.balances);
  const setBalances = useWalletStore(state => state.setBalances);
  const setNutzapMonitor = useWalletStore(state => state.setNutzapMonitor);
  const processFollowEvent = (event, relay) => {
    if (followEvent && followEvent.created_at > event.created_at) return;
    const pubkeys = new Set(event.tags.filter(tag => tag[0] === 'p' && !!tag[1]).map(tag => tag[1]));
    setFollows(Array.from(pubkeys));
    followEvent = event;
  };
  const processMuteListEvent = (event, relay) => {
    setMuteList(event);
  };
  const processCashuWalletEvent = event => {
    addEvent(NDKKind.CashuWallet, event);
  };
  const handleEvent = (event, relay) => {
    if (knownEventIds.has(event.id)) return;
    knownEventIds.add(event.id);
    const kind = event.kind;
    switch (kind) {
      case 3:
        return processFollowEvent(event, relay);
      case NDKKind.MuteList:
        return processMuteListEvent(event, relay);
      case NDKKind.CashuWallet:
        return processCashuWalletEvent(event);
      default:
        const entry = opts.kinds.get(kind);
        if (entry?.wrapper) {
          event = entry.wrapper.from(event);
        }
        addEvent(kind, event);
    }
  };

  /**
   * Set the active wallet
   * @param wallet - The wallet to set
   * @param save - Whether to store this setting locally
   */
  const setActiveWallet = (wallet, save = true) => {
    ndk.wallet = wallet;
    const updateBalance = () => {
      if (!wallet) return;
      console.log('Updating balance from balance_updated event');
      setBalances(wallet.balance());
    };
    if (wallet) {
      wallet.on("ready", () => {
        console.log('Updating balance from ready event');
        setBalances(wallet.balance());
      });
      wallet.on('balance_updated', () => {
        updateBalance();
      });
      if (wallet instanceof NDKCashuWallet) {
        wallet.start({
          cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY
        });
        const monitor = new NDKNutzapMonitor(ndk, currentUser);
        monitor.addWallet(wallet);
        monitor.on('seen', zap => {
          console.log('zap seen', zap.rawEvent());
        });
        monitor.on('redeem', zap => {
          console.log('zap redeemed', zap.rawEvent());
        });
        setNutzapMonitor(monitor);
        monitor.start();
      }
    }
    walletStore.setActiveWallet(wallet);
    if (wallet) updateBalance();else {
      setBalances([]);
    }
    if (save && opts.settingsStore) {
      persistWalletConfiguration(wallet, opts.settingsStore);
    }
  };
  useEffect(() => {
    if (!ndk || !currentUser) return;
    if (sub) {
      sub.stop();
    }
    let filters = [];
    filters.push({
      kinds: [],
      authors: [currentUser.pubkey]
    });
    if (opts.follows) filters[0].kinds.push(3);
    if (opts.muteList) filters[0].kinds.push(NDKKind.MuteList);
    if (opts.wallet) filters[0].kinds.push(NDKKind.CashuWallet);
    if (opts.kinds) filters[0].kinds.push(...opts.kinds.keys());
    if (opts.settingsStore && !ndk.wallet) {
      loadWallet(ndk, opts.settingsStore, wallet => setActiveWallet(wallet, false));
    }
    if (filters[0].kinds.length > 0) {
      sub = ndk.subscribe(filters, {
        closeOnEose: false
      }, undefined, false);
      sub.on('event', handleEvent);
      sub.start();
    }
  }, [ndk, opts.follows, opts.muteList, opts.settingsStore, currentUser]);
  return /*#__PURE__*/_jsx(NDKSessionContext.Provider, {
    value: {
      follows: useSessionStore(state => state.follows),
      events: useSessionStore(state => state.events),
      muteList: useSessionStore(state => state.muteList),
      mutePubkey: useSessionStore(state => state.mutePubkey),
      ...walletStore,
      balances,
      setActiveWallet
    },
    children: children
  });
};
function walletPayload(wallet) {
  if (wallet instanceof NDKNWCWallet) {
    return wallet.pairingCode;
  } else if (wallet instanceof NDKCashuWallet) {
    return wallet.event.rawEvent();
  }
}

/**
 * Persist the wallet configuration
 * @param wallet - The wallet to persist
 * @param settingsStore - The settings store to use
 */
function persistWalletConfiguration(wallet, settingsStore) {
  if (!wallet) {
    settingsStore.delete('wallet');
    return;
  }
  const payload = walletPayload(wallet);
  if (!payload) {
    alert('Failed to persist wallet configuration!');
    return;
  }
  const type = wallet.type;
  settingsStore.set('wallet', JSON.stringify({
    type,
    payload
  }));
}
async function loadWallet(ndk, settingsStore, setActiveWallet) {
  const walletConfig = await settingsStore.get('wallet');
  if (!walletConfig) return;
  const loadNWCWallet = pairingCode => {
    const wallet = new NDKNWCWallet(ndk);
    wallet.initWithPairingCode(pairingCode).then(() => {
      setActiveWallet(wallet);
    });
  };
  const loadNIP60Wallet = async payload => {
    try {
      // Load the cached event
      const event = new NDKEvent(ndk, payload);
      const wallet = await NDKCashuWallet.from(event);
      setActiveWallet(wallet);
      const relaySet = wallet.relaySet;

      // Load remotely
      const freshEvent = await ndk.fetchEvent(event.encode(), {
        cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY
      }, relaySet);
      if (!freshEvent) {
        console.log("Refreshing the event came back empty, has the wallet been deleted?");
        setActiveWallet(null);
        return null;
      }
      if (freshEvent.hasTag('deleted')) {
        alert('This wallet has been deleted');
        setActiveWallet(null);
        return null;
      } else if (freshEvent.created_at > event.created_at) {
        const wallet = await NDKCashuWallet.from(freshEvent);
        alert('This wallet has been updated');
        setActiveWallet(wallet);

        // update the cache
        persistWalletConfiguration(wallet, settingsStore);
        return wallet;
      }
      return wallet;
    } catch (e) {
      console.error('Error activating wallet', e);
      console.log(payload);
    }
  };
  try {
    const {
      type,
      payload
    } = JSON.parse(walletConfig);
    if (type === 'nwc') {
      loadNWCWallet(payload);
    } else if (type === 'nip-60') {
      loadNIP60Wallet(payload);
    } else {
      alert('Unknown wallet type: ' + type);
    }
  } catch (e) {
    alert('Failed to load wallet configuration');
    settingsStore.delete('wallet');
  }
}
export { NDKSessionProvider };
//# sourceMappingURL=index.js.map
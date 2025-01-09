"use strict";

import { NDKKind, NDKList } from '@nostr-dev-kit/ndk';
import { generateFilters } from "../utils.js";
import { NDKCacheAdapterSqlite } from "../../../cache-adapter/sqlite.js";
import { addWotEntries, shouldUpdateWot, wotEntries } from "./wot.js";
export const initSession = (ndk, user, settingsStore, opts, on = {}, set, get) => {
  const {
    addEvent
  } = get();
  let follows = [];
  const filters = generateFilters(user, opts);
  const sub = ndk.subscribe(filters, {
    groupable: false,
    closeOnEose: false
  }, undefined, false);
  let eosed = false;
  const handleEvent = event => {
    addEvent(event, () => {
      if (event.kind === NDKKind.Contacts) {
        follows = event.tags.filter(tag => tag[0] === 'p' && !!tag[1]).map(tag => tag[1]);
        console.log('Receiving a contact list event', event.id, follows.length);

        // if we have already eosed, get the pubkeys that are not in the wotEntries and add them to the wotEntries
        if (eosed && opts.wot) {
          const newEntries = follows.filter(pubkey => !wotEntries.has(pubkey));
          console.log('eosed, adding wot entries', follows.length, newEntries.length);
          addWotEntries(ndk, newEntries, settingsStore, set, () => {
            on.onWotReady?.();
          });
        }
        return {
          follows
        };
      } else if (event.kind === NDKKind.MuteList) {
        const muteList = new Set(event.tags.filter(tag => tag[0] === 'p' && !!tag[1]).map(tag => tag[1]));
        return {
          muteList,
          muteListEvent: NDKList.from(event)
        };
      }
    });
  };
  sub.on('event', handleEvent);
  sub.once('eose', () => {
    on?.onReady?.();
    eosed = true;
    if (opts.wot) {
      console.log('shouldUpdateWot', shouldUpdateWot(ndk, settingsStore));
      if (shouldUpdateWot(ndk, settingsStore)) {
        addWotEntries(ndk, follows, settingsStore, set, () => {
          on.onWotReady?.();
        });
      } else {
        console.log('not updating wot');

        // fetch wot from database
        const cacheAdapter = ndk.cacheAdapter;
        if (!(cacheAdapter instanceof NDKCacheAdapterSqlite)) {
          return;
        }
        cacheAdapter.fetchWot().then(wot => {
          set({
            wot
          });
          on.onWotReady?.();
        });
      }
    }
    eosed = true;
  });
  sub.start();
  set({
    ndk,
    follows: opts.follows ? [user.pubkey] : []
  });
};
//# sourceMappingURL=init.js.map
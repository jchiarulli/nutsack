"use strict";

import '@bacons/text-decoder/install';
import { createStore } from 'zustand/vanilla';
import { NDKRelaySet } from '@nostr-dev-kit/ndk';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNDK } from "./ndk.js";
import { useStore } from 'zustand';
import { useSessionStore } from "../stores/session.js";

/**
 * Extends NDKEvent with a 'from' method to wrap events with a kind-specific handler
 */

/**
 * Parameters for the useSubscribe hook
 * @interface UseSubscribeParams
 * @property {NDKFilter[] | null} filters - Nostr filters to subscribe to
 * @property {Object} [opts] - Subscription options
 * @property {NDKEventWithFrom<any>} [opts.klass] - Class to convert events to
 * @property {boolean} [opts.includeMuted] - Whether to include muted events
 * @property {boolean} [opts.includeDeleted] - Whether to include deleted events
 * @property {number | false} [opts.bufferMs] - Buffer time in ms, false to disable
 * @property {string[]} [relays] - Optional relay URLs to connect to
 */

/**
 * Store interface for managing subscription state
 * @interface SubscribeStore
 * @property {T[]} events - Array of received events
 * @property {Map<string, T>} eventMap - Map of events by ID
 * @property {boolean} eose - End of stored events flag
 * @property {boolean} isSubscribed - Subscription status
 */

/**
 * Creates a store to manage subscription state with optional event buffering
 * @param bufferMs - Buffer time in milliseconds, false to disable buffering
 */
const createSubscribeStore = (bufferMs = 16) => createStore((set, get) => {
  let buffer = [];
  let timeout = null;

  // Function to flush the buffered events to the store
  const flushBuffer = () => {
    set(state => {
      const {
        eventMap
      } = state;
      buffer.forEach(event => {
        const currentEvent = eventMap.get(event.tagId());
        if (currentEvent && currentEvent.created_at >= event.created_at) return;
        eventMap.set(event.tagId(), event);
      });
      const events = Array.from(eventMap.values());
      buffer = [];
      return {
        eventMap,
        events
      };
    });
    timeout = null;
  };
  return {
    events: [],
    eventMap: new Map(),
    eose: false,
    isSubscribed: false,
    subscriptionRef: undefined,
    addEvent: event => {
      const {
        eose
      } = get();
      if (!eose && bufferMs !== false) {
        buffer.push(event);
        if (!timeout) {
          timeout = setTimeout(flushBuffer, bufferMs);
        }
      } else {
        // Direct update logic when buffering is disabled or after EOSE
        set(state => {
          const {
            eventMap
          } = state;
          const currentEvent = eventMap.get(event.tagId());
          if (currentEvent && currentEvent.created_at >= event.created_at) return state;
          eventMap.set(event.tagId(), event);
          const events = Array.from(eventMap.values());
          return {
            eventMap,
            events
          };
        });
      }
    },
    removeEventId: id => {
      set(state => {
        state.eventMap.delete(id);
        const events = Array.from(state.eventMap.values());
        return {
          eventMap: state.eventMap,
          events
        };
      });
    },
    setEose: () => {
      if (timeout) {
        clearTimeout(timeout);
        flushBuffer(); // Ensure any remaining buffered events are flushed immediately
      }
      set({
        eose: true
      });
    },
    clearEvents: () => set({
      eventMap: new Map(),
      eose: false
    }),
    setSubscription: sub => set({
      subscriptionRef: sub,
      isSubscribed: !!sub
    })
  };
});

/**
 * React hook for subscribing to Nostr events
 * @param params - Subscription parameters
 * @returns {Object} Subscription state
 * @returns {T[]} events - Array of received events
 * @returns {boolean} eose - End of stored events flag
 * @returns {boolean} isSubscribed - Subscription status
 */
export const useSubscribe = ({
  filters,
  opts = undefined,
  relays = undefined
}) => {
  const {
    ndk
  } = useNDK();
  const muteList = useSessionStore(state => state.muteList);
  const store = useMemo(() => createSubscribeStore(opts?.bufferMs), [opts?.bufferMs]);
  const storeInstance = useStore(store);

  /**
   * Map of eventIds that have been received by this subscription.
   *
   * Key: event identifier (event.dTag or event.id)
   *
   * Value: timestamp of the event, used to choose the
   * most recent event on replaceable events
   */
  const eventIds = useRef(new Map());
  const relaySet = useMemo(() => {
    if (ndk && relays && relays.length > 0) {
      return NDKRelaySet.fromRelayUrls(relays, ndk);
    }
    return undefined;
  }, [ndk, relays]);
  const shouldAcceptEvent = event => {
    const id = event.tagId();
    const currentVal = eventIds.current.get(id);

    // if it's from a muted pubkey, we don't accept it
    if (opts?.includeMuted !== true && muteList.has(event.pubkey)) {
      console.log('rejecting from muted pubkey', event.pubkey);
      return false;
    }

    // We have not seen this ID yet
    if (!currentVal) return true;

    // The ID we have seen is older
    if (currentVal < event.created_at) return true;
    return false;
  };
  const handleEvent = useCallback(event => {
    const id = event.tagId();
    if (!shouldAcceptEvent(event)) return;
    if (opts?.includeDeleted !== true && event.isParamReplaceable() && event.hasTag('deleted')) {
      // We mark the event but we don't add the actual event, since
      // it has been deleted
      eventIds.current.set(id, event.created_at);
      return;
    }

    // If we need to convert the event, we do so
    if (opts?.klass) event = opts.klass.from(event);
    event.once("deleted", () => {
      storeInstance.removeEventId(id);
    });

    // If conversion failed, we bail
    if (!event) return;
    storeInstance.addEvent(event);
    eventIds.current.set(id, event.created_at);
  }, [opts?.klass]);
  const handleEose = () => {
    storeInstance.setEose();
  };
  const handleClosed = () => {
    storeInstance.setSubscription(undefined);
  };
  useEffect(() => {
    if (!filters || filters.length === 0 || !ndk) return;
    if (storeInstance.subscriptionRef) {
      storeInstance.subscriptionRef.stop();
      storeInstance.setSubscription(undefined);
    }
    const subscription = ndk.subscribe(filters, opts, relaySet, false);
    subscription.on('event', handleEvent);
    subscription.on('eose', handleEose);
    subscription.on('closed', handleClosed);
    storeInstance.setSubscription(subscription);
    subscription.start();
    return () => {
      if (storeInstance.subscriptionRef) {
        storeInstance.subscriptionRef.stop();
        storeInstance.setSubscription(undefined);
      }
      eventIds.current.clear();
      storeInstance.clearEvents();
    };
  }, [filters, opts, relaySet, ndk]);
  return {
    events: storeInstance.events,
    eose: storeInstance.eose,
    isSubscribed: storeInstance.isSubscribed,
    subscription: storeInstance.subscriptionRef
  };
};
//# sourceMappingURL=subscribe.js.map
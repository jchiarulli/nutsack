import '@bacons/text-decoder/install';
import { NDKEvent, NDKFilter, NDKSubscription, NDKSubscriptionOptions } from '@nostr-dev-kit/ndk';
/**
 * Extends NDKEvent with a 'from' method to wrap events with a kind-specific handler
 */
export type NDKEventWithFrom<T extends NDKEvent> = T & {
    from: (event: NDKEvent) => T;
};
/**
 * Parameters for the useSubscribe hook
 * @interface UseSubscribeParams
 * @property {NDKFilter[] | null} filters - Nostr filters to subscribe to
 * @property {Object} [opts] - Subscription options
 * @property {NDKEventWithFrom<any>} [opts.klass] - Class to convert events to
 * @property {boolean} [opts.includeMuted] - Whether to include muted events
 * @property {boolean} [opts.includeDeleted] - Whether to include deleted events
 * @property {boolean} [opts.wot] - Whether to filter with WoT.
 * @property {number | false} [opts.bufferMs] - Buffer time in ms, false to disable
 * @property {string[]} [relays] - Optional relay URLs to connect to
 */
interface UseSubscribeParams {
    filters: NDKFilter[] | null;
    opts?: NDKSubscriptionOptions & {
        /**
         * Whether to wrap the event with the kind-specific class when possible
         */
        wrap?: boolean;
        includeMuted?: boolean;
        includeDeleted?: boolean;
        wot?: boolean;
        bufferMs?: number | false;
    };
    relays?: readonly string[];
}
/**
 * React hook for subscribing to Nostr events
 * @param params - Subscription parameters
 * @returns {Object} Subscription state
 * @returns {T[]} events - Array of received events
 * @returns {boolean} eose - End of stored events flag
 * @returns {boolean} isSubscribed - Subscription status
 */
export declare const useSubscribe: <T extends NDKEvent>({ filters, opts, relays }: UseSubscribeParams) => {
    events: T[];
    eose: boolean;
    isSubscribed: boolean;
    subscription: NDKSubscription;
};
export {};
//# sourceMappingURL=subscribe.d.ts.map
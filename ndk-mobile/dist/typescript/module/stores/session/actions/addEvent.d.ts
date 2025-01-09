import { NDKEvent } from '@nostr-dev-kit/ndk';
/**
 * This function is called when a new event is received.
 *
 * It inspects the event to determine if the event should be added to the session.
 *   - Checks if the newest version if the event is replaceable.
 *
 * @param event
 * @param onAdded
 * @param set
 */
export declare const addEvent: (event: NDKEvent, onAdded: any, set: any) => void;
//# sourceMappingURL=addEvent.d.ts.map
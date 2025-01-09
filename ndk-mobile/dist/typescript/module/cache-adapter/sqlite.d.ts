import { NDKCacheAdapter, NDKEvent, NDKFilter, NDKSubscription, NDKUserProfile, Hexpubkey, NDKCacheEntry, NDKRelay, NDKEventId } from '@nostr-dev-kit/ndk';
import * as SQLite from 'expo-sqlite';
type EventRecord = {
    id: string;
    created_at: number;
    pubkey: string;
    event: string;
    kind: number;
    relay: string;
};
export declare class NDKCacheAdapterSqlite implements NDKCacheAdapter {
    readonly dbName: string;
    db: SQLite.SQLiteDatabase;
    locking: boolean;
    ready: boolean;
    private pendingCallbacks;
    private profileCache;
    constructor(dbName: string, maxProfiles?: number);
    private initialize;
    onReady(callback: () => any): any;
    /**
     * Runs the function only if the cache adapter is ready, if it's not ready,
     * it ignores the function.
     */
    ifReady(callback: () => any): any;
    query(subscription: NDKSubscription): Promise<void>;
    setEvent(event: NDKEvent, filters: NDKFilter[], relay?: NDKRelay): Promise<void>;
    deleteEventIds(eventIds: NDKEventId[]): Promise<void>;
    fetchProfileSync(pubkey: Hexpubkey): NDKCacheEntry<NDKUserProfile> | null;
    fetchProfile(pubkey: Hexpubkey): Promise<NDKCacheEntry<NDKUserProfile> | null>;
    saveProfile(pubkey: Hexpubkey, profile: NDKUserProfile): Promise<void>;
    addUnpublishedEvent(event: NDKEvent, relayUrls: WebSocket['url'][]): void;
    getUnpublishedEvents(): Promise<{
        event: NDKEvent;
        relays?: WebSocket['url'][];
        lastTryAt?: number;
    }[]>;
    private _getUnpublishedEvents;
    discardUnpublishedEvent(eventId: NDKEventId): void;
    saveWot(wot: Map<Hexpubkey, number>): Promise<void>;
    fetchWot(): Promise<Map<Hexpubkey, number>>;
    clear(): void;
}
export declare function foundEvents(subscription: NDKSubscription, events: EventRecord[], filter?: NDKFilter): void;
export declare function foundEvent(subscription: NDKSubscription, event: EventRecord, relayUrl: WebSocket['url'] | undefined, filter?: NDKFilter): void;
export {};
//# sourceMappingURL=sqlite.d.ts.map
import { NDKEvent, NDKKind, Hexpubkey } from '@nostr-dev-kit/ndk';
interface SessionState {
    follows: string[] | undefined;
    muteListEvent: NDKEvent | undefined;
    muteList: Set<Hexpubkey>;
    events: Map<NDKKind, NDKEvent[]>;
    setFollows: (follows: string[]) => void;
    setMuteList: (muteList: NDKEvent) => void;
    setEvents: (kind: NDKKind, events: NDKEvent[]) => void;
    mutePubkey: (pubkey: Hexpubkey) => void;
    addEvent: (kind: NDKKind, event: NDKEvent) => void;
}
export declare const useSessionStore: import("zustand").UseBoundStore<import("zustand").StoreApi<SessionState>>;
export {};
//# sourceMappingURL=session.d.ts.map
import NDK, { NDKEvent, NDKKind, NDKUser } from '@nostr-dev-kit/ndk';
import { NDKEventWithFrom } from './subscribe';
import { SessionInitOpts, SessionInitCallbacks } from '../stores/session/types';
import { SettingsStore } from '../types';
declare const useNDKSession: () => {
    init: (ndk: NDK, user: NDKUser, settingsStore: SettingsStore, opts: SessionInitOpts, on: SessionInitCallbacks) => void;
    mutePubkey: (pubkey: import("@nostr-dev-kit/ndk").Hexpubkey) => void;
};
declare const useFollows: () => string[];
declare const useMuteList: () => Set<string>;
declare const useSessionEvents: () => Map<NDKKind, NDKEvent[]>;
declare const useWOT: () => Map<string, number>;
/**
 * This hook allows you to get a specific kind, wrapped in the event class you provide.
 * @param EventClass
 * @param kind
 * @param opts.create - If true, and the event kind is not found, an unpublished event will be provided.
 * @returns
 */
declare const useNDKSessionEventKind: <T extends NDKEvent>(EventClass: NDKEventWithFrom<any>, kind: NDKKind, { create }?: {
    create: boolean;
}) => T | undefined;
declare const useNDKSessionEvents: <T extends NDKEvent>(kinds: NDKKind[], eventClass?: NDKEventWithFrom<any>) => T[];
export { useFollows, useMuteList, useSessionEvents, useWOT, useNDKSessionEventKind, useNDKSessionEvents, useNDKSession, };
//# sourceMappingURL=session.d.ts.map
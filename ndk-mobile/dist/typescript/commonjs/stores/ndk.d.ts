import NDK, { NDKConstructorParams, NDKEvent, NDKUser } from "@nostr-dev-kit/ndk";
import { SettingsStore } from "../types";
type OnUserSetCallback = (ndk: NDK, user: NDKUser) => void;
export type InitNDKParams = NDKConstructorParams & {
    settingsStore: SettingsStore;
    onUserSet?: OnUserSetCallback;
};
export interface UnpublishedEventEntry {
    event: NDKEvent;
    relays?: string[];
    lastTryAt?: number;
}
type State = {
    ndk: NDK;
    currentUser: NDKUser | null;
    settingsStore?: SettingsStore;
    unpublishedEvents: Map<string, UnpublishedEventEntry>;
    cacheInitialized: boolean;
    initialParams: InitNDKParams;
    onUserSet?: OnUserSetCallback;
};
type Actions = {
    init: (params: InitNDKParams) => void;
    login: (payload: string) => void;
    logout: () => void;
};
type EventHandler = {
    onUserSet?: OnUserSetCallback;
};
export declare const useNDKStore: import("zustand").UseBoundStore<import("zustand").StoreApi<State & Actions & EventHandler>>;
export {};
//# sourceMappingURL=ndk.d.ts.map
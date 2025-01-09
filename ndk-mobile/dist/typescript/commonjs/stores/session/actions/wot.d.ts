import NDK, { Hexpubkey } from "@nostr-dev-kit/ndk";
import { SettingsStore } from "../../../types";
import { SessionState } from "../types";
export declare const wotEntries: Map<string, {
    time: number;
    list: Set<Hexpubkey>;
}>;
export declare function shouldUpdateWot(ndk: NDK, settingsStore: SettingsStore): boolean;
export declare function updateWotState(settingsStore: SettingsStore, wot: Map<Hexpubkey, number>): void;
/**
 * Computes the WoT from a user's follows.
 */
export declare function addWotEntries(ndk: NDK, follows: Hexpubkey[], settingsStore: SettingsStore, set: (state: Partial<SessionState>) => void, cb: () => void): void;
export declare function persistWot(ndk: NDK, wot: Map<Hexpubkey, number>, settingsStore: SettingsStore): void;
//# sourceMappingURL=wot.d.ts.map
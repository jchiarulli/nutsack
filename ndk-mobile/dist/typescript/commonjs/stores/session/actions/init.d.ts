import NDK, { NDKUser } from '@nostr-dev-kit/ndk';
import { SessionInitCallbacks, SessionInitOpts, SessionState } from '../types';
import { SettingsStore } from '../../../types';
export declare const initSession: (ndk: NDK, user: NDKUser, settingsStore: SettingsStore, opts: SessionInitOpts, on: SessionInitCallbacks, set: (state: Partial<SessionState>) => void, get: () => SessionState) => void;
//# sourceMappingURL=init.d.ts.map
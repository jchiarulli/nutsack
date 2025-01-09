import NDK, { NDKSigner } from '@nostr-dev-kit/ndk';
import { SettingsStore } from '../../../types';
export declare function withPrivateKey(key: string): Promise<NDKSigner | null>;
export declare function withPayload(ndk: NDK, payload: string, settingsStore: SettingsStore): Promise<NDKSigner | null>;
//# sourceMappingURL=pk.d.ts.map
import NDK, { NDKUser, NDKSigner } from '@nostr-dev-kit/ndk';
import { UnpublishedEventEntry } from '../providers/ndk';
interface NDKContext {
    ndk: NDK | undefined;
    login: (promise: Promise<NDKSigner | null>) => Promise<void>;
    loginWithPayload: (payload: string, { save }: {
        save?: boolean;
    }) => Promise<void>;
    logout: () => Promise<void>;
    unpublishedEvents: Map<string, UnpublishedEventEntry>;
    currentUser: NDKUser | null;
    cacheInitialized: boolean | null;
}
declare const NDKContext: import("react").Context<NDKContext>;
export default NDKContext;
//# sourceMappingURL=ndk.d.ts.map
export declare const useNDK: () => {
    ndk: import("@nostr-dev-kit/ndk").default;
    init: (params: import("../stores/ndk").InitNDKParams) => void;
    login: (payload: string) => void;
    logout: () => void;
};
export declare const useNDKCurrentUser: () => import("@nostr-dev-kit/ndk").NDKUser;
export declare const useNDKCacheInitialized: () => boolean;
export declare const useNDKUnpublishedEvents: () => Map<string, import("../stores/ndk").UnpublishedEventEntry>;
//# sourceMappingURL=ndk.d.ts.map
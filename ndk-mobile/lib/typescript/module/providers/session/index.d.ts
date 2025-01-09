import React from 'react';
import { NDKEventWithFrom } from '../../hooks';
import { NDKKind } from '@nostr-dev-kit/ndk';
import { PropsWithChildren } from 'react';
type SettingsStore = {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<void>;
};
/**
 * Options for the NDKSessionProvider
 *
 * @param follows - Whether to subscribe to follow events
 * @param muteList - Whether to subscribe to mute list events
 * @param wallet - Whether to subscribe to wallet events
 * @param settingsStore - A store for storing and retrieving configuration values
 * @param kinds - A map of kinds to wrap with a custom wrapper
 */
interface NDKSessionProviderProps {
    follows?: boolean;
    muteList?: boolean;
    wallet?: boolean;
    settingsStore?: SettingsStore;
    kinds?: Map<NDKKind, {
        wrapper?: NDKEventWithFrom<any>;
    }>;
}
declare const NDKSessionProvider: ({ children, ...opts }: PropsWithChildren<NDKSessionProviderProps>) => React.JSX.Element;
export { NDKSessionProvider };
//# sourceMappingURL=index.d.ts.map
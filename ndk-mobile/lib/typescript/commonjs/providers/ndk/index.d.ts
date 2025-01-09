import React, { PropsWithChildren } from 'react';
import { NDKConstructorParams, NDKEvent } from '@nostr-dev-kit/ndk';
import 'react-native-get-random-values';
import '@bacons/text-decoder/install';
export interface UnpublishedEventEntry {
    event: NDKEvent;
    relays?: string[];
    lastTryAt?: number;
}
declare const NDKProvider: ({ children, connect, ...opts }: PropsWithChildren<NDKConstructorParams & {
    connect?: boolean;
}>) => React.JSX.Element;
export { NDKProvider };
//# sourceMappingURL=index.d.ts.map
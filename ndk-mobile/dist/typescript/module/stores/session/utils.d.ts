import { NDKUser, NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';
import { SessionInitOpts } from './types.js';
export declare const generateFilters: (user: NDKUser, opts: SessionInitOpts) => NDKFilter[];
/**
 * Checks whether the first event is newer than the second event.
 * @returns
 */
export declare const firstIsNewer: (first: NDKEvent, second: NDKEvent) => boolean;
//# sourceMappingURL=utils.d.ts.map
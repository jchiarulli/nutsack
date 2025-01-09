import NDKSessionContext from '../context/session';
import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import { NDKEventWithFrom } from './subscribe';
declare const useNDKSession: () => NDKSessionContext;
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
export { useNDKSession, useNDKSessionEventKind, useNDKSessionEvents };
//# sourceMappingURL=session.d.ts.map
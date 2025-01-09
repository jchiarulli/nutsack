"use strict";

import { NDKKind } from '@nostr-dev-kit/ndk';
export const generateFilters = (user, opts) => {
  let filters = [];
  filters.push({
    kinds: [],
    authors: [user.pubkey]
  });
  if (opts.follows) filters[0].kinds.push(3);
  if (opts.muteList) filters[0].kinds.push(NDKKind.MuteList);
  if (opts.kinds) filters[0].kinds.push(...opts.kinds.keys());
  if (opts.filters) filters.push(...opts.filters(user).map(f => ({
    ...f,
    authors: [user.pubkey]
  })));
  return filters;
};

/**
 * Checks whether the first event is newer than the second event.
 * @returns 
 */
export const firstIsNewer = (first, second) => {
  return first && second && first.created_at >= second.created_at;
};
//# sourceMappingURL=utils.js.map
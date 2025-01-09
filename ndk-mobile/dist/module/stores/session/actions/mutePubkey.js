"use strict";

import { NDKList, NDKKind } from '@nostr-dev-kit/ndk';
export const mutePubkey = (pubkey, set) => {
  set(state => {
    const muteList = new Set(state.muteList);
    let muteListEvent;
    console.log('muting user', pubkey);
    if (state.muteListEvent) {
      muteListEvent = NDKList.from(state.muteListEvent);
    } else {
      muteListEvent = new NDKList(state.ndk);
      muteListEvent.kind = NDKKind.MuteList;
    }
    muteList.add(pubkey);
    muteListEvent.tags.push(['p', pubkey]);
    muteListEvent.publishReplaceable().then(res => console.log('mute list', res, JSON.stringify(muteListEvent.rawEvent(), null, 4))).catch(console.error);
    return {
      muteList
    };
  });
};
//# sourceMappingURL=mutePubkey.js.map
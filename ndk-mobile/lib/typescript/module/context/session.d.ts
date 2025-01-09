import { Hexpubkey, NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import { NDKWallet, NDKWalletBalance } from '@nostr-dev-kit/ndk-wallet';
interface NDKSessionContext {
    follows?: Array<Hexpubkey>;
    events?: Map<NDKKind, Array<NDKEvent>>;
    mutePubkey: (pubkey: Hexpubkey) => void;
    muteList: Set<Hexpubkey>;
    activeWallet?: NDKWallet;
    setActiveWallet: (wallet: NDKWallet) => void;
    balances: NDKWalletBalance[];
}
declare const NDKSessionContext: import("react").Context<NDKSessionContext>;
export default NDKSessionContext;
//# sourceMappingURL=session.d.ts.map
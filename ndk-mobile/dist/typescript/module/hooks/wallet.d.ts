import { NDKWallet } from '@nostr-dev-kit/ndk-wallet';
declare const useNDKWallet: () => {
    activeWallet: NDKWallet;
    setActiveWallet: (wallet: NDKWallet) => void;
    balances: import("@nostr-dev-kit/ndk-wallet").NDKWalletBalance[];
    setBalances: (balances: import("@nostr-dev-kit/ndk-wallet").NDKWalletBalance[]) => void;
    nutzapMonitor: import("@nostr-dev-kit/ndk-wallet").NDKNutzapMonitor;
    setNutzapMonitor: (monitor: import("@nostr-dev-kit/ndk-wallet").NDKNutzapMonitor) => void;
};
export { useNDKWallet, };
//# sourceMappingURL=wallet.d.ts.map
import { NDKNutzapMonitor, NDKWallet, NDKWalletBalance } from "@nostr-dev-kit/ndk-wallet";
interface WalletState {
    activeWallet: NDKWallet | undefined;
    setActiveWallet: (wallet: NDKWallet) => void;
    balances: NDKWalletBalance[];
    setBalances: (balances: NDKWalletBalance[]) => void;
    nutzapMonitor: NDKNutzapMonitor | undefined;
    setNutzapMonitor: (monitor: NDKNutzapMonitor) => void;
}
export declare const useWalletStore: import("zustand").UseBoundStore<import("zustand").StoreApi<WalletState>>;
export {};
//# sourceMappingURL=wallet.d.ts.map
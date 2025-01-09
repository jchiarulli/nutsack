import { type NostrEvent, Hexpubkey, NDKUser, ENCRYPTION_SCHEMES, type NDKSigner, NDKRelay } from "@nostr-dev-kit/ndk";
type Nip04QueueItem = {
    type: "encrypt" | "decrypt";
    counterpartyHexpubkey: string;
    value: string;
    resolve: (value: string) => void;
    reject: (reason?: Error) => void;
};
type Nip55RelayMap = {
    [key: string]: {
        read: boolean;
        write: boolean;
    };
};
/**
 * NDKNip55Signer implements the NDKSigner interface for signing Nostr events
 * with a NIP-55 compatible android mobile client.
 */
export declare class NDKNip55Signer implements NDKSigner {
    private _userPromise;
    nip04Queue: Nip04QueueItem[];
    private nip04Processing;
    private debug;
    private waitTimeout;
    /**
     * @param waitTimeout - The timeout in milliseconds to wait for the NIP-55 to become available
     */
    constructor(waitTimeout?: number);
    blockUntilReady(): Promise<NDKUser>;
    /**
     * Getter for the user property.
     * @returns The NDKUser instance.
     */
    user(): Promise<NDKUser>;
    /**
     * Signs the given Nostr event.
     * @param event - The Nostr event to be signed.
     * @returns The signature of the signed event.
     * @throws Error if the NIP-07 is not available on the window object.
     */
    sign(event: NostrEvent): Promise<string>;
    relays(ndk?: any): Promise<NDKRelay[]>;
    encrypt(recipient: NDKUser, value: string, type?: ENCRYPTION_SCHEMES): Promise<string>;
    decrypt(sender: NDKUser, value: string, type?: ENCRYPTION_SCHEMES): Promise<string>;
    nip44Encrypt(recipient: NDKUser, value: string): Promise<string>;
    get nip44(): Nip44;
    nip44Decrypt(sender: NDKUser, value: string): Promise<string>;
    nip04Encrypt(recipient: NDKUser, value: string): Promise<string>;
    nip04Decrypt(sender: NDKUser, value: string): Promise<string>;
    private queueNip04;
    private processNip04Queue;
    private waitForExtension;
    private getPublicKey;
}
type Nip44 = {
    encrypt: (recipient: Hexpubkey, value: string) => Promise<string>;
    decrypt: (sender: Hexpubkey, value: string) => Promise<string>;
};
declare global {
    interface Window {
        nostr?: {
            getPublicKey(): Promise<string>;
            signEvent(event: NostrEvent): Promise<{
                sig: string;
            }>;
            getRelays?: () => Promise<Nip55RelayMap>;
            nip04?: {
                encrypt(recipientHexPubKey: string, value: string): Promise<string>;
                decrypt(senderHexPubKey: string, value: string): Promise<string>;
            };
            nip44?: Nip44;
        };
    }
}
export {};
//# sourceMappingURL=nip55.d.ts.map
import debug from "debug";

import {
    type NostrEvent,
    Hexpubkey,
    NDKUser,
    DEFAULT_ENCRYPTION_SCHEME,
    ENCRYPTION_SCHEMES,
    type NDKSigner,
    NDKRelay,
} from "@nostr-dev-kit/ndk";
import * as IntentLauncher from "expo-intent-launcher";

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
export class NDKNip55Signer implements NDKSigner {
    private _userPromise: Promise<NDKUser> | undefined;
    public nip04Queue: Nip04QueueItem[] = [];
    private nip04Processing = false;
    private debug: debug.Debugger;
    private waitTimeout: number;

    /**
     * @param waitTimeout - The timeout in milliseconds to wait for the NIP-55 to become available
     */
    public constructor(waitTimeout: number = 1000) {
        this.debug = debug("ndk:nip55");
        this.waitTimeout = waitTimeout;
    }

    public async blockUntilReady(): Promise<NDKUser> {
        // TODO
        // Set the type to be a Hexpubkey or npub
        let npub = await this.getPublicKey();

        // TODO
        // Also add check to to see if an external signer is installed
        if (!npub) {
            // TODO
            // Handle gracefully instead of crashing
            // If unable to obtain pubkey, error out
            throw new Error("Unable to obtain pubkey from external signer");
        }

        // TODO
        // Convert npub to hexpubkey if necessary
        // return new NDKUser({ pubkey: pubkey });
        return new NDKUser({ npub: npub });
    }

    // TODO
    // Test this method
    /**
     * Getter for the user property.
     * @returns The NDKUser instance.
     */
    public async user(): Promise<NDKUser> {
        if (!this._userPromise) {
            this._userPromise = this.blockUntilReady();
        }

        return this._userPromise;
    }

    // TODO
    // Implement these methods
    /**
     * Signs the given Nostr event.
     * @param event - The Nostr event to be signed.
     * @returns The signature of the signed event.
     * @throws Error if the NIP-07 is not available on the window object.
     */
    public async sign(event: NostrEvent): Promise<string> {
        await this.waitForExtension();

        const signedEvent = await window.nostr!.signEvent(event);
        return signedEvent.sig;
    }

    // TODO import NDK type, ndk?: NDK
    public async relays(ndk?: any): Promise<NDKRelay[]> {
        await this.waitForExtension();

        const relays = (await window.nostr!.getRelays?.()) || {};

        const activeRelays = [];
        for (const url of Object.keys(relays)) {
            // Currently only respects relays that are both readable and writable.
            if (relays[url].read && relays[url].write) {
                activeRelays.push(url);
            }
        }
        return activeRelays.map((url) => new NDKRelay(url, ndk?.relayAuthDefaultPolicy, ndk));
    }

    public async encrypt(
        recipient: NDKUser,
        value: string,
        type: ENCRYPTION_SCHEMES = DEFAULT_ENCRYPTION_SCHEME
    ): Promise<string> {
        if (type === "nip44") {
            return this.nip44Encrypt(recipient, value);
        } else {
            return this.nip04Encrypt(recipient, value);
        }
    }

    public async decrypt(
        sender: NDKUser,
        value: string,
        type: ENCRYPTION_SCHEMES = DEFAULT_ENCRYPTION_SCHEME
    ): Promise<string> {
        if (type === "nip44") {
            return this.nip44Decrypt(sender, value);
        } else {
            return this.nip04Decrypt(sender, value);
        }
    }

    public async nip44Encrypt(recipient: NDKUser, value: string): Promise<string> {
        await this.waitForExtension();
        return await this.nip44.encrypt(recipient.pubkey, value);
    }

    get nip44(): Nip44 {
        if (!window.nostr?.nip44) {
            throw new Error("NIP-44 not supported by your browser extension");
        }

        return window.nostr.nip44;
    }

    public async nip44Decrypt(sender: NDKUser, value: string): Promise<string> {
        await this.waitForExtension();
        return await this.nip44.decrypt(sender.pubkey, value);
    }

    public async nip04Encrypt(recipient: NDKUser, value: string): Promise<string> {
        await this.waitForExtension();

        const recipientHexPubKey = recipient.pubkey;
        return this.queueNip04("encrypt", recipientHexPubKey, value);
    }

    public async nip04Decrypt(sender: NDKUser, value: string): Promise<string> {
        await this.waitForExtension();

        const senderHexPubKey = sender.pubkey;
        return this.queueNip04("decrypt", senderHexPubKey, value);
    }

    private async queueNip04(
        type: "encrypt" | "decrypt",
        counterpartyHexpubkey: string,
        value: string
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            this.nip04Queue.push({
                type,
                counterpartyHexpubkey,
                value,
                resolve,
                reject,
            });

            if (!this.nip04Processing) {
                this.processNip04Queue();
            }
        });
    }

    private async processNip04Queue(item?: Nip04QueueItem, retries = 0): Promise<void> {
        if (!item && this.nip04Queue.length === 0) {
            this.nip04Processing = false;
            return;
        }

        this.nip04Processing = true;
        const { type, counterpartyHexpubkey, value, resolve, reject } =
            item || this.nip04Queue.shift()!;

        try {
            let result;

            if (type === "encrypt") {
                result = await window.nostr!.nip04!.encrypt(counterpartyHexpubkey, value);
            } else {
                result = await window.nostr!.nip04!.decrypt(counterpartyHexpubkey, value);
            }

            resolve(result);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            // retry a few times if the call is already executing
            if (error.message && error.message.includes("call already executing")) {
                if (retries < 5) {
                    this.debug("Retrying encryption queue item", {
                        type,
                        counterpartyHexpubkey,
                        value,
                        retries,
                    });
                    setTimeout(() => {
                        this.processNip04Queue(item, retries + 1);
                    }, 50 * retries);

                    return;
                }
            }
            reject(error);
        }

        this.processNip04Queue();
    }

    private waitForExtension(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (window.nostr) {
                resolve();
                return;
            }

            let timerId: NodeJS.Timeout | number;

            // Create an interval to repeatedly check for window.nostr
            const intervalId = setInterval(() => {
                if (window.nostr) {
                    clearTimeout(timerId as number);
                    clearInterval(intervalId);
                    resolve();
                }
            }, 100);

            // Set a timer to reject the promise if window.nostr is not available within the timeout
            timerId = setTimeout(() => {
                clearInterval(intervalId);
                reject(new Error("NIP-07 extension not available"));
            }, this.waitTimeout);
        });
    }

    // TODO
    // Add timeout like in the waitForExtension
    // Update string type to be hexpubkey
    private async getPublicKey(): Promise<string> {
        try {
            const permissions = [
                { permission: "sign_event", id: 22242 },
                { permission: "nip04_encrypt" },
                { permission: "nip04_decrypt" },
                { permission: "nip44_encrypt" },
                { permission: "nip44_decrypt" },
                { permission: "decrypt_zap_event" },
            ];

            const result = await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
                category: "android.intent.category.BROWSABLE",
                data: "nostrsigner:",
                extra: {
                    package: "com.greenart7c3.nostrsigner", // TODO Detect and specify a general app package
                    permissions: JSON.stringify(permissions),
                    type: "get_public_key",
                },
            });

            // TODO
            // Handle Canceled, Error, and maybe FirstUser results from expo-intent-launcher
            // If the result was successful, handle the response
            if (result.resultCode === -1) {
                const resultExtraObj = result.extra;
                console.log("Signer result:", resultExtraObj);
                // TODO
                // Fix this by defining a type
                // @ts-ignore
                return resultExtraObj.result;
            } else {
                // If the result code indicates the user rejected the request
                console.log("Sign request rejected");
                return "";
            }
        } catch (error) {
            // If there is an error launching the intent, handle the failure
            console.error("Error getting the public key:", error);
            return "";
        }
    }
}

type Nip44 = {
    encrypt: (recipient: Hexpubkey, value: string) => Promise<string>;
    decrypt: (sender: Hexpubkey, value: string) => Promise<string>;
};

declare global {
    interface Window {
        nostr?: {
            getPublicKey(): Promise<string>;
            signEvent(event: NostrEvent): Promise<{ sig: string }>;
            getRelays?: () => Promise<Nip55RelayMap>;
            nip04?: {
                encrypt(recipientHexPubKey: string, value: string): Promise<string>;
                decrypt(senderHexPubKey: string, value: string): Promise<string>;
            };
            nip44?: Nip44;
        };
    }
}

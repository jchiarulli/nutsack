"use strict";

import debug from "debug";
import { NDKUser, DEFAULT_ENCRYPTION_SCHEME, NDKRelay } from "@nostr-dev-kit/ndk";
import * as IntentLauncher from "expo-intent-launcher";
/**
 * NDKNip55Signer implements the NDKSigner interface for signing Nostr events
 * with a NIP-55 compatible android mobile client.
 */
export class NDKNip55Signer {
  nip04Queue = [];
  nip04Processing = false;
  /**
   * @param waitTimeout - The timeout in milliseconds to wait for the NIP-55 to become available
   */
  constructor(waitTimeout = 1000) {
    this.debug = debug("ndk:nip55");
    this.waitTimeout = waitTimeout;
  }
  async blockUntilReady() {
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
    return new NDKUser({
      npub: npub
    });
  }

  // TODO
  // Test this method
  /**
   * Getter for the user property.
   * @returns The NDKUser instance.
   */
  async user() {
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
  async sign(event) {
    await this.waitForExtension();
    const signedEvent = await window.nostr.signEvent(event);
    return signedEvent.sig;
  }

  // TODO import NDK type, ndk?: NDK
  async relays(ndk) {
    await this.waitForExtension();
    const relays = (await window.nostr.getRelays?.()) || {};
    const activeRelays = [];
    for (const url of Object.keys(relays)) {
      // Currently only respects relays that are both readable and writable.
      if (relays[url].read && relays[url].write) {
        activeRelays.push(url);
      }
    }
    return activeRelays.map(url => new NDKRelay(url, ndk?.relayAuthDefaultPolicy, ndk));
  }
  async encrypt(recipient, value, type = DEFAULT_ENCRYPTION_SCHEME) {
    if (type === "nip44") {
      return this.nip44Encrypt(recipient, value);
    } else {
      return this.nip04Encrypt(recipient, value);
    }
  }
  async decrypt(sender, value, type = DEFAULT_ENCRYPTION_SCHEME) {
    if (type === "nip44") {
      return this.nip44Decrypt(sender, value);
    } else {
      return this.nip04Decrypt(sender, value);
    }
  }
  async nip44Encrypt(recipient, value) {
    await this.waitForExtension();
    return await this.nip44.encrypt(recipient.pubkey, value);
  }
  get nip44() {
    if (!window.nostr?.nip44) {
      throw new Error("NIP-44 not supported by your browser extension");
    }
    return window.nostr.nip44;
  }
  async nip44Decrypt(sender, value) {
    await this.waitForExtension();
    return await this.nip44.decrypt(sender.pubkey, value);
  }
  async nip04Encrypt(recipient, value) {
    await this.waitForExtension();
    const recipientHexPubKey = recipient.pubkey;
    return this.queueNip04("encrypt", recipientHexPubKey, value);
  }
  async nip04Decrypt(sender, value) {
    await this.waitForExtension();
    const senderHexPubKey = sender.pubkey;
    return this.queueNip04("decrypt", senderHexPubKey, value);
  }
  async queueNip04(type, counterpartyHexpubkey, value) {
    return new Promise((resolve, reject) => {
      this.nip04Queue.push({
        type,
        counterpartyHexpubkey,
        value,
        resolve,
        reject
      });
      if (!this.nip04Processing) {
        this.processNip04Queue();
      }
    });
  }
  async processNip04Queue(item, retries = 0) {
    if (!item && this.nip04Queue.length === 0) {
      this.nip04Processing = false;
      return;
    }
    this.nip04Processing = true;
    const {
      type,
      counterpartyHexpubkey,
      value,
      resolve,
      reject
    } = item || this.nip04Queue.shift();
    try {
      let result;
      if (type === "encrypt") {
        result = await window.nostr.nip04.encrypt(counterpartyHexpubkey, value);
      } else {
        result = await window.nostr.nip04.decrypt(counterpartyHexpubkey, value);
      }
      resolve(result);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error) {
      // retry a few times if the call is already executing
      if (error.message && error.message.includes("call already executing")) {
        if (retries < 5) {
          this.debug("Retrying encryption queue item", {
            type,
            counterpartyHexpubkey,
            value,
            retries
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
  waitForExtension() {
    return new Promise((resolve, reject) => {
      if (window.nostr) {
        resolve();
        return;
      }
      let timerId;

      // Create an interval to repeatedly check for window.nostr
      const intervalId = setInterval(() => {
        if (window.nostr) {
          clearTimeout(timerId);
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
  async getPublicKey() {
    try {
      const permissions = [{
        permission: "sign_event",
        id: 22242
      }, {
        permission: "nip04_encrypt"
      }, {
        permission: "nip04_decrypt"
      }, {
        permission: "nip44_encrypt"
      }, {
        permission: "nip44_decrypt"
      }, {
        permission: "decrypt_zap_event"
      }];
      const result = await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        category: "android.intent.category.BROWSABLE",
        data: "nostrsigner:",
        extra: {
          package: "com.greenart7c3.nostrsigner",
          // TODO Detect and specify a general app package
          permissions: JSON.stringify(permissions),
          type: "get_public_key"
        }
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
//# sourceMappingURL=nip55.js.map
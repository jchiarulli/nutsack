import NDK, { NDKEvent, NostrEvent, NDKRelaySet, NDKRelay, NDKKind, Hexpubkey, NDKFilter, NDKEventId, CashuPaymentInfo, NDKUser, NDKPrivateKeySigner, NDKPool, LnPaymentInfo, NDKPaymentConfirmationLN, NDKPaymentConfirmationCashu, NDKWalletInterface, NDKZapDetails, NDKZapSplit, NDKPaymentConfirmation, NDKTag, NDKSubscriptionOptions, NDKNutzap, NDKCashuMintList } from '@nostr-dev-kit/ndk';
import { EventEmitter } from 'tseep';
import { Proof, SendResponse, CashuWallet } from '@cashu/cashu-ts';
import { WebLNProvider } from '@webbtc/webln-types';

declare function proofsTotalBalance(proofs: Proof[]): number;
declare class NDKCashuToken extends NDKEvent {
    private _proofs;
    private original;
    constructor(ndk?: NDK, event?: NostrEvent | NDKEvent);
    static from(event: NDKEvent): Promise<NDKCashuToken | undefined>;
    get proofs(): Proof[];
    set proofs(proofs: Proof[]);
    /**
     * Strips out anything we don't necessarily have to store.
     */
    private cleanProof;
    toNostrEvent(pubkey?: string): Promise<NostrEvent>;
    get walletId(): string | undefined;
    set wallet(wallet: NDKCashuWallet);
    set mint(mint: string);
    get mint(): string | undefined;
    get amount(): number;
    publish(relaySet?: NDKRelaySet, timeoutMs?: number, requiredRelayCount?: number): Promise<Set<NDKRelay>>;
}

declare class NDKCashuQuote extends NDKEvent {
    quoteId: string | undefined;
    mint: string | undefined;
    amount: number | undefined;
    unit: string | undefined;
    private _wallet;
    static kind: NDKKind;
    constructor(ndk?: NDK, event?: NostrEvent | NDKEvent);
    static from(event: NDKEvent): Promise<NDKCashuQuote | undefined>;
    set wallet(wallet: NDKCashuWallet);
    set invoice(invoice: string);
    save(): Promise<void>;
}

declare class NDKCashuDeposit extends EventEmitter<{
    success: (token: NDKCashuToken) => void;
    error: (error: string) => void;
}> {
    mint: string;
    amount: number;
    quoteId: string | undefined;
    private wallet;
    private _wallet?;
    checkTimeout: NodeJS.Timeout | undefined;
    checkIntervalLength: number;
    finalized: boolean;
    unit?: string;
    private quoteEvent?;
    constructor(wallet: NDKCashuWallet, amount: number, mint?: string, unit?: string);
    static fromQuoteEvent(wallet: NDKCashuWallet, quote: NDKCashuQuote): NDKCashuDeposit;
    /**
     * Creates a quote ID and start monitoring for payment.
     *
     * Once a payment is received, the deposit will emit a "success" event.
     *
     * @param pollTime - time in milliseconds between checks
     * @returns
     */
    start(pollTime?: number): Promise<string>;
    /**
     * This generates a 7374 event containing the quote ID
     * with an optional expiration set to the bolt11 expiry (if there is one)
     */
    private createQuoteEvent;
    private runCheck;
    private delayCheck;
    /**
     * Check if the deposit has been finalized.
     * @param timeout A timeout in milliseconds to wait before giving up.
     */
    check(timeout?: number): Promise<void>;
    finalize(): Promise<void>;
    private destroyQuoteEvent;
}

type MintUrl = string;
type MintUsage = {
    /**
     * All the events that are associated with this mint.
     */
    events: NDKEvent[];
    pubkeys: Set<Hexpubkey>;
};
type NDKCashuMintRecommendation = Record<MintUrl, MintUsage>;
/**
 * Provides a list of mint recommendations.
 * @param ndk
 * @param filter optional extra filter to apply to the REQ
 */
declare function getCashuMintRecommendations(ndk: NDK, filter?: NDKFilter): Promise<NDKCashuMintRecommendation>;

type UpdateStateResult = {
    /**
     * Tokens that were created as the result of a state change
     */
    created?: NDKCashuToken;
    /**
     * Tokens that were reserved as the result of a state change
     */
    reserved?: NDKCashuToken;
    /**
     * Tokens that were deleted as the result of a state change
     */
    deleted?: NDKEventId[];
};
type WalletChange = {
    reserve?: Proof[];
    destroy?: Proof[];
    store?: Proof[];
    mint: MintUrl;
};
type WalletStateChange = {
    deletedTokenIds: Set<string>;
    deletedProofs: Set<string>;
    reserveProofs: Proof[];
    saveProofs: Proof[];
};
declare class WalletState {
    private wallet;
    tokens: NDKCashuToken[];
    usedTokenIds: Set<string>;
    knownTokens: Set<string>;
    constructor(wallet: NDKCashuWallet, tokens?: NDKCashuToken[], usedTokenIds?: Set<string>, knownTokens?: Set<string>);
    /**
     * Returns the tokens that are available for spending
     */
    get availableTokens(): NDKCashuToken[];
    /**
     * Returns a map of the proof C values to the token where it was found
     */
    getAllMintProofTokens(mint?: MintUrl): Map<string, NDKCashuToken>;
    /**
     * Returns all proofs for a given mint
     */
    proofsForMint(mint: MintUrl): Proof[];
    /**
     * Adds a token to the list of used tokens
     * to make sure it's proofs are no longer available
     */
    addUsedTokens(token: NDKCashuToken[]): void;
    /**
     * Updates the internal state to add a token,
     * there is no change published anywhere when calling this function.
     */
    addToken(token: NDKCashuToken): boolean;
    /**
     * Removes a token that has been deleted
     */
    removeTokenId(id: NDKEventId): false | undefined;
    /**
     * Calculates the new state of the wallet based on a given change.
     *
     * This method processes the proofs to be stored, identifies proofs to be deleted,
     * and determines which tokens are affected by the change. It updates the wallet
     * state by:
     * - Collecting all proofs that are part of the new state.
     * - Identifying all proofs that are affected by the change.
     * - Removing proofs that are to be kept from the affected proofs.
     * - Identifying proofs that should be deleted.
     * - Processing affected tokens to determine which proofs need to be saved.
     *
     * @param change The change to be applied to the wallet state.
     * @returns The new state of the wallet, including proofs to be saved, deleted, or reserved.
     */
    calculateNewState(change: WalletChange): Promise<WalletStateChange>;
    /**
     * Updates the wallet state based on a send result
     * @param sendResult
     */
    update(change: WalletChange): Promise<UpdateStateResult>;
}

type NutPayment = CashuPaymentInfo & {
    amount: number;
    unit: string;
};

type NDKNWCMethod = "pay_invoice" | "multi_pay_invoice" | "pay_keysend" | "multi_pay_keysend" | "make_invoice" | "lookup_invoice" | "list_transactions" | "get_balance" | "get_info";
interface NDKNWCRequestBase {
    method: NDKNWCMethod;
    params: Record<string, any>;
}
interface NDKNWCResponseBase<T = any> {
    result_type: NDKNWCMethod;
    error?: {
        code: NDKNWCErrorCode;
        message: string;
    };
    result: T | null;
}
type NDKNWCErrorCode = "RATE_LIMITED" | "NOT_IMPLEMENTED" | "INSUFFICIENT_BALANCE" | "QUOTA_EXCEEDED" | "RESTRICTED" | "UNAUTHORIZED" | "INTERNAL" | "OTHER" | "PAYMENT_FAILED" | "NOT_FOUND";
interface NDKNWCTransaction {
    type: "incoming" | "outgoing";
    invoice?: string;
    description?: string;
    description_hash?: string;
    preimage?: string;
    payment_hash: string;
    amount: number;
    fees_paid?: number;
    created_at: number;
    expires_at?: number;
    settled_at?: number;
    metadata?: Record<string, any>;
}
interface NDKNWCPayInvoiceParams {
    invoice: string;
    amount?: number;
}
interface NDKNWCMakeInvoiceParams {
    amount: number;
    description?: string;
    description_hash?: string;
    expiry?: number;
}
interface NDKNWCLookupInvoiceParams {
    payment_hash?: string;
    invoice?: string;
}
interface NDKNWCListTransactionsParams {
    from?: number;
    until?: number;
    limit?: number;
    offset?: number;
    unpaid?: boolean;
    type?: "incoming" | "outgoing";
}
interface NDKNWCPayInvoiceResult {
    preimage: string;
    fees_paid?: number;
}
interface NDKNWCGetBalanceResult {
    balance: number;
}
interface NDKNWCGetInfoResult {
    alias: string;
    color: string;
    pubkey: string;
    network: "mainnet" | "testnet" | "signet" | "regtest";
    block_height: number;
    block_hash: string;
    methods: NDKNWCMethod[];
    notifications?: string[];
}
type NDKNWCRequestMap = {
    pay_invoice: NDKNWCPayInvoiceParams;
    make_invoice: NDKNWCMakeInvoiceParams;
    lookup_invoice: NDKNWCLookupInvoiceParams;
    list_transactions: NDKNWCListTransactionsParams;
    get_balance: Record<string, never>;
    get_info: Record<string, never>;
};
type NDKNWCResponseMap = {
    pay_invoice: NDKNWCPayInvoiceResult;
    make_invoice: NDKNWCTransaction;
    lookup_invoice: NDKNWCTransaction;
    list_transactions: {
        transactions: NDKNWCTransaction[];
    };
    get_balance: NDKNWCGetBalanceResult;
    get_info: NDKNWCGetInfoResult;
};

declare class NDKNWCWallet extends EventEmitter<NDKWalletEvents> implements NDKWallet {
    readonly type = "nwc";
    readonly status = NDKWalletStatus.INITIAL;
    readonly walletId = "nwc";
    pairingCode?: string;
    ndk: NDK;
    walletService?: NDKUser;
    relaySet?: NDKRelaySet;
    private _status?;
    signer?: NDKPrivateKeySigner;
    private _balance?;
    private cachedInfo?;
    pool?: NDKPool;
    constructor(ndk: NDK);
    init(pubkey: string, relayUrls: string[], secret: string): Promise<void>;
    /**
     * Initialize the wallet via a nostr+walletconnect URI
     */
    initWithPairingCode(uri: string): Promise<void>;
    toLoadingString(): string;
    lnPay(payment: LnPaymentInfo): Promise<NDKPaymentConfirmationLN | undefined>;
    cashuPay(payment: NutPayment): Promise<NDKPaymentConfirmationCashu | undefined>;
    /**
     * Fetch the balance of this wallet
     */
    updateBalance(): Promise<void>;
    /**
     * Get the balance of this wallet
     */
    balance(): NDKWalletBalance[] | undefined;
    req: <M extends keyof NDKNWCRequestMap>(method: M, params: NDKNWCRequestMap[M]) => Promise<NDKNWCResponseBase<NDKNWCResponseMap[M]>>;
    getInfo(refetch?: boolean): Promise<NDKNWCGetInfoResult>;
}

type NDKWalletTypes = 'nwc' | 'nip-60' | 'webln';
declare enum NDKWalletStatus {
    INITIAL = "initial",
    /**
     * The wallet tokens are being loaded.
     * Queried balance will come from the wallet event cache
     */
    LOADING = "loading",
    /**
     * Token have completed loading.
     * Balance will come from the computed balance from known tokens
     */
    READY = "ready",
    FAILED = "failed"
}
type NDKWalletBalance = {
    amount: number;
    unit: string;
};
type NDKWalletEvents = {
    ready: () => void;
    balance_updated: (balance?: NDKWalletBalance) => void;
    insufficient_balance: (info: {
        amount: number;
        pr: string;
    }) => void;
};
interface NDKWallet extends NDKWalletInterface, EventEmitter<{
    /**
     * Emitted when the wallet is ready to be used.
     */
    ready: () => void;
    /**
     * Emitted when a balance is known to have been updated.
     */
    balance_updated: (balance?: NDKWalletBalance) => void;
}> {
    get status(): NDKWalletStatus;
    get type(): NDKWalletTypes;
    /**
     * An ID of this wallet
     */
    get walletId(): string;
    /**
     * Pay a LN invoice
     * @param payment - The LN payment info
     */
    lnPay?(payment: NDKZapDetails<LnPaymentInfo>): Promise<NDKPaymentConfirmationLN | undefined>;
    /**
     * Pay a Cashu invoice
     * @param payment - The Cashu payment info
     */
    cashuPay?(payment: NDKZapDetails<CashuPaymentInfo>): Promise<NDKPaymentConfirmationCashu | undefined>;
    /**
     * A callback that is called when a payment is complete
     */
    onPaymentComplete?(results: Map<NDKZapSplit, NDKPaymentConfirmation | Error | undefined>): void;
    /**
     * Force-fetch the balance of this wallet
     */
    updateBalance?(): Promise<void>;
    /**
     * Get the balance of this wallet
     */
    balance(): NDKWalletBalance[] | undefined;
    /**
     * Serializes the wallet configuration in a way that can be restored later.
     */
    toLoadingString?(): string;
}
declare function walletFromLoadingString(ndk: NDK, str: string): Promise<NDKNWCWallet | NDKCashuWallet | undefined>;

/**
 * This class tracks the active deposits and emits a "change" event when there is a change.
 */
declare class NDKCashuDepositMonitor extends EventEmitter<{
    "change": () => void;
}> {
    deposits: Map<string, NDKCashuDeposit>;
    constructor();
    addDeposit(deposit: NDKCashuDeposit): boolean;
    removeDeposit(quoteId: string): void;
}

type LNPaymentResult = {
    walletChange: WalletChange;
    preimage: string;
    fee?: number;
};

type PaymentWithOptionalZapInfo<T extends LnPaymentInfo | CashuPaymentInfo> = T & {
    target?: NDKEvent | NDKUser;
    comment?: string;
    tags?: NDKTag[];
    amount?: number;
    unit?: string;
    recipientPubkey?: string;
    paymentDescription?: string;
};

type WalletWarning = {
    msg: string;
    event?: NDKEvent;
    relays?: NDKRelay[];
};

/**
 * This class tracks state of a NIP-60 wallet
 */
declare class NDKCashuWallet extends EventEmitter<NDKWalletEvents & {
    warning: (warning: WalletWarning) => void;
}> implements NDKWallet {
    readonly type = "nip-60";
    /**
     * Active tokens in this wallet
     */
    tokens: NDKCashuToken[];
    /**
     * Token ids that have been used
     */
    usedTokenIds: Set<string>;
    /**
     * Known tokens in this wallet
     */
    knownTokens: Set<NDKEventId>;
    private skipPrivateKey;
    p2pk: string | undefined;
    private sub?;
    ndk: NDK;
    status: NDKWalletStatus;
    static kind: NDKKind;
    static kinds: NDKKind[];
    privateTags: NDKTag[];
    publicTags: NDKTag[];
    _event?: NDKEvent;
    walletId: string;
    depositMonitor: NDKCashuDepositMonitor;
    /**
     * Warnings that have been raised
     */
    warnings: WalletWarning[];
    private paymentHandler;
    state: WalletState;
    constructor(ndk: NDK, event?: NDKEvent);
    /**
     * Creates a new NIP-60 wallet
     * @param ndk
     * @param mints
     * @param relayUrls
     * @returns
     */
    static create(ndk: NDK, mints?: string[], relayUrls?: string[]): NDKCashuWallet;
    set event(e: NDKEvent | undefined);
    get event(): NDKEvent | undefined;
    tagId(): string | undefined;
    /**
     * Returns the tokens that are available for spending
     */
    get availableTokens(): NDKCashuToken[];
    /**
     * Adds a token to the list of used tokens
     * to make sure it's proofs are no longer available
     */
    addUsedTokens(token: NDKCashuToken[]): void;
    checkProofs: () => Promise<void>;
    consolidateTokens: () => Promise<void>;
    toLoadingString(): string;
    mintNuts(amounts: number[], unit: string): Promise<SendResponse | undefined>;
    static from(event: NDKEvent): Promise<NDKCashuWallet | undefined>;
    /**
     * Starts monitoring the wallet
     */
    start(opts?: NDKSubscriptionOptions & {
        pubkey?: Hexpubkey;
    }): void;
    stop(): void;
    get allTags(): NDKTag[];
    private setPrivateTag;
    private getPrivateTags;
    private getPrivateTag;
    private setPublicTag;
    private getPublicTags;
    set relays(urls: WebSocket["url"][]);
    get relays(): WebSocket["url"][];
    set mints(urls: string[]);
    get mints(): string[];
    set name(value: string);
    get name(): string | undefined;
    get unit(): string;
    set unit(unit: string);
    /**
     * Returns the p2pk of this wallet or generates a new one if we don't have one
     */
    getP2pk(): Promise<string | undefined>;
    get privkeyUint8Array(): Uint8Array | undefined;
    /**
     * Returns the private key of this wallet
     */
    get privkey(): string | undefined;
    set privkey(privkey: string | undefined | false);
    /**
     * Whether this wallet has been deleted
     */
    get isDeleted(): boolean;
    publish(): Promise<Set<NDKRelay>>;
    get relaySet(): NDKRelaySet | undefined;
    /**
     * Prepares a deposit
     * @param amount
     * @param mint
     * @param unit
     *
     * @example
     * const wallet = new NDKCashuWallet(...);
     * const deposit = wallet.deposit(1000, "https://mint.example.com", "sats");
     * deposit.on("success", (token) => {
     *   console.log("deposit successful", token);
     * });
     * deposit.on("error", (error) => {
     *   console.log("deposit failed", error);
     * });
     *
     * // start monitoring the deposit
     * deposit.start();
     */
    deposit(amount: number, mint?: string, unit?: string): NDKCashuDeposit;
    /**
     * Receives a token and adds it to the wallet
     * @param token
     * @returns the token event that was created
     */
    receiveToken(token: string, description?: string): Promise<NDKCashuToken | undefined>;
    /**
     * Pay a LN invoice with this wallet
     */
    lnPay(payment: PaymentWithOptionalZapInfo<LnPaymentInfo>, createTxEvent?: boolean): Promise<LNPaymentResult | undefined>;
    /**
     * Swaps tokens to a specific amount, optionally locking to a p2pk.
     *
     * This function has side effects:
     * - It swaps tokens at the mint
     * - It updates the wallet state (deletes affected tokens, might create new ones)
     * - It creates a wallet transaction event
     *
     * This function returns the proofs that need to be sent to the recipient.
     * @param amount
     */
    cashuPay(payment: NDKZapDetails<CashuPaymentInfo>): Promise<NDKPaymentConfirmationCashu | undefined>;
    /**
     * Returns a map of the proof C values to the token where it was found
     * @param mint
     * @returns
     */
    private getAllMintProofTokens;
    private wallets;
    cashuWallet(mint: string): Promise<CashuWallet>;
    hasProof(secret: string): boolean;
    /**
     * Returns all proofs for a given mint
     * @param mint
     * @returns
     */
    proofsForMint(mint: MintUrl): Proof[];
    redeemNutzap(nutzap: NDKNutzap, { onRedeemed, onTxEventCreated }: {
        onRedeemed?: (res: Proof[]) => void;
        onTxEventCreated?: (event: NDKEvent) => void;
    }): Promise<void>;
    /**
     * Updates the internal state to add a token,
     * there is no change published anywhere when calling this function.
     */
    addToken(token: NDKCashuToken): boolean;
    warn(msg: string, event?: NDKEvent, relays?: NDKRelay[]): void;
    /**
     * Removes a token that has been deleted
     */
    removeTokenId(id: NDKEventId): false | undefined;
    /**
     * Deletes this wallet
     */
    delete(reason?: string, publish?: boolean): Promise<NDKEvent>;
    /**
     * Gets all tokens, grouped by mint
     */
    get mintTokens(): Record<MintUrl, NDKCashuToken[]>;
    balance(): NDKWalletBalance[] | undefined;
    /**
     * Writes the wallet balance to relays
     */
    syncBalance(): Promise<void>;
    mintBalance(mint: MintUrl): number;
    get mintBalances(): Record<MintUrl, number>;
    getMintsWithBalance(amount: number): string[];
}

/**
 * This class monitors a user's nutzap inbox relays
 * for new nutzaps and processes them.
 */
declare class NDKNutzapMonitor extends EventEmitter<{
    /**
     * Emitted when a new nutzap is successfully redeemed
     */
    redeem: (event: NDKNutzap, amount: number) => void;
    /**
     * Emitted when a nutzap has been seen
     */
    seen: (event: NDKNutzap) => void;
    /**
     * Emitted when a nutzap has failed to be redeemed
     */
    failed: (event: NDKNutzap, error: string) => void;
}> {
    private ndk;
    private user;
    relaySet?: NDKRelaySet;
    private sub?;
    private eosed;
    private redeemQueue;
    private knownTokens;
    /**
     * Known wallets. This is necessary to be able to find the private key
     * that is needed to redeem the nutzap.
     */
    private walletByP2pk;
    private allWallets;
    addWallet(wallet: NDKCashuWallet): void;
    /**
     * Create a new nutzap monitor.
     * @param ndk - The NDK instance.
     * @param user - The user to monitor.
     * @param relaySet - An optional relay set to monitor zaps on, if one is not provided, the monitor will use the relay set from the mint list, which is the correct default behavior of NIP-61 zaps.
     */
    constructor(ndk: NDK, user: NDKUser, relaySet?: NDKRelaySet);
    /**
     * Start the monitor.
     */
    start(mintList?: NDKCashuMintList): Promise<boolean>;
    stop(): void;
    private eoseHandler;
    private eventHandler;
    private pushToRedeemQueue;
    private redeem;
    private findWalletForNutzap;
}

type DIRECTIONS = 'in' | 'out';
/**
 * This class represents a balance change in the wallet, whether money being added or removed.
 */
declare class NDKWalletChange extends NDKEvent {
    static MARKERS: {
        REDEEMED: string;
        CREATED: string;
        DESTROYED: string;
        RESERVED: string;
    };
    static kind: NDKKind;
    static kinds: NDKKind[];
    constructor(ndk?: NDK, event?: NostrEvent | NDKEvent);
    static from(event: NDKEvent): Promise<NDKWalletChange | undefined>;
    set direction(direction: DIRECTIONS | undefined);
    get direction(): DIRECTIONS | undefined;
    set amount(amount: number);
    get amount(): number | undefined;
    set fee(fee: number);
    get fee(): number | undefined;
    set unit(unit: string | undefined);
    get unit(): string | undefined;
    set description(description: string | undefined);
    get description(): string | undefined;
    set mint(mint: string | undefined);
    get mint(): string | undefined;
    /**
     * Tags tokens that were created in this history event
     */
    set destroyedTokens(events: NDKCashuToken[]);
    set destroyedTokenIds(ids: NDKEventId[]);
    /**
     * Tags tokens that were created in this history event
     */
    set createdTokens(events: NDKCashuToken[]);
    set reservedTokens(events: NDKCashuToken[]);
    addRedeemedNutzap(event: NDKEvent): void;
    toNostrEvent(pubkey?: string): Promise<NostrEvent>;
    /**
     * Whether this entry includes a redemption of a Nutzap
     */
    get hasNutzapRedemption(): boolean;
    private shouldEncryptTag;
}

declare class NDKWebLNWallet extends EventEmitter<NDKWalletEvents> implements NDKWallet {
    readonly type = "webln";
    readonly walletId = "webln";
    status: NDKWalletStatus;
    provider?: WebLNProvider;
    private _balance?;
    constructor();
    pay(payment: LnPaymentInfo): Promise<NDKPaymentConfirmationLN | undefined>;
    lnPay(payment: LnPaymentInfo): Promise<NDKPaymentConfirmationLN | undefined>;
    cashuPay(payment: NDKZapDetails<NutPayment>): Promise<NDKPaymentConfirmationCashu>;
    updateBalance?(): Promise<void>;
    balance(): NDKWalletBalance[] | undefined;
}

declare function getBolt11ExpiresAt(bolt11: string): number | undefined;
declare function getBolt11Amount(bolt11: string): number | undefined;
declare function getBolt11Description(bolt11: string): string | undefined;

export { type DIRECTIONS, type MintUrl, type MintUsage, NDKCashuDeposit, type NDKCashuMintRecommendation, NDKCashuToken, NDKCashuWallet, type NDKNWCErrorCode, type NDKNWCGetBalanceResult, type NDKNWCGetInfoResult, type NDKNWCListTransactionsParams, type NDKNWCLookupInvoiceParams, type NDKNWCMakeInvoiceParams, type NDKNWCMethod, type NDKNWCPayInvoiceParams, type NDKNWCPayInvoiceResult, type NDKNWCRequestBase, type NDKNWCRequestMap, type NDKNWCResponseBase, type NDKNWCResponseMap, type NDKNWCTransaction, NDKNWCWallet, NDKNutzapMonitor, type NDKWallet, type NDKWalletBalance, NDKWalletChange, type NDKWalletEvents, NDKWalletStatus, type NDKWalletTypes, NDKWebLNWallet, type WalletWarning, getBolt11Amount, getBolt11Description, getBolt11ExpiresAt, getCashuMintRecommendations, proofsTotalBalance, walletFromLoadingString };

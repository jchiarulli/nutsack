import debug$1 from 'debug';
import { EventEmitter } from 'tseep';
import { LRUCache } from 'typescript-lru-cache';

declare enum NDKKind {
    Metadata = 0,
    Text = 1,
    RecommendRelay = 2,
    Contacts = 3,
    EncryptedDirectMessage = 4,
    EventDeletion = 5,
    Repost = 6,
    Reaction = 7,
    BadgeAward = 8,
    GroupChat = 9,
    GroupNote = 11,
    GroupReply = 12,
    Image = 20,
    GenericRespose = 22,
    GenericRepost = 16,
    ChannelCreation = 40,
    ChannelMetadata = 41,
    ChannelMessage = 42,
    ChannelHideMessage = 43,
    ChannelMuteUser = 44,
    GenericReply = 1111,
    Media = 1063,
    Report = 1984,
    Label = 1985,
    DVMReqTextExtraction = 5000,
    DVMReqTextSummarization = 5001,
    DVMReqTextTranslation = 5002,
    DVMReqTextGeneration = 5050,
    DVMReqImageGeneration = 5100,
    DVMReqTextToSpeech = 5250,
    DVMReqDiscoveryNostrContent = 5300,
    DVMReqDiscoveryNostrPeople = 5301,
    DVMReqTimestamping = 5900,
    DVMEventSchedule = 5905,
    DVMJobFeedback = 7000,
    Subscribe = 7001,
    Unsubscribe = 7002,
    SubscriptionReceipt = 7003,
    CashuReserve = 7373,
    CashuQuote = 7374,
    CashuToken = 7375,
    WalletChange = 7376,
    GroupAdminAddUser = 9000,
    GroupAdminRemoveUser = 9001,
    GroupAdminEditMetadata = 9002,
    GroupAdminEditStatus = 9006,
    GroupAdminCreateGroup = 9007,
    GroupAdminRequestJoin = 9021,
    MuteList = 10000,
    PinList = 10001,
    RelayList = 10002,
    BookmarkList = 10003,
    CommunityList = 10004,
    PublicChatList = 10005,
    BlockRelayList = 10006,
    SearchRelayList = 10007,
    SimpleGroupList = 10009,
    InterestList = 10015,
    CashuMintList = 10019,
    EmojiList = 10030,
    DirectMessageReceiveRelayList = 10050,
    BlossomList = 10063,
    NostrWaletConnectInfo = 13194,
    TierList = 17000,
    FollowSet = 30000,
    CategorizedPeopleList = 30000,// Deprecated but left for backwards compatibility
    CategorizedBookmarkList = 30001,// Deprecated but left for backwards compatibility
    RelaySet = 30002,
    CategorizedRelayList = 30002,// Deprecated but left for backwards compatibility
    BookmarkSet = 30003,
    /**
     * @deprecated Use ArticleCurationSet instead
     */
    CurationSet = 30004,// Deprecated but left for backwards compatibility
    ArticleCurationSet = 30004,
    VideoCurationSet = 30005,
    ImageCurationSet = 30006,
    InterestSet = 30015,
    InterestsList = 30015,// Deprecated but left for backwards compatibility
    EmojiSet = 30030,
    ModularArticle = 30040,
    ModularArticleItem = 30041,
    Wiki = 30818,
    Draft = 31234,
    SubscriptionTier = 37001,
    EcashMintRecommendation = 38000,
    HighlightSet = 39802,
    CategorizedHighlightList = 39802,// Deprecated but left for backwards compatibility
    Nutzap = 9321,
    ZapRequest = 9734,
    Zap = 9735,
    Highlight = 9802,
    ClientAuth = 22242,
    NostrWalletConnectReq = 23194,
    NostrWalletConnectRes = 23195,
    NostrConnect = 24133,
    BlossomUpload = 24242,
    HttpAuth = 27235,
    ProfileBadge = 30008,
    BadgeDefinition = 30009,
    MarketStall = 30017,
    MarketProduct = 30018,
    Article = 30023,
    AppSpecificData = 30078,
    Classified = 30402,
    HorizontalVideo = 34235,
    VerticalVideo = 34236,
    CashuWallet = 37375,
    GroupMetadata = 39000,// NIP-29
    GroupAdmins = 39001,// NIP-29
    GroupMembers = 39002,// NIP-29
    AppRecommendation = 31989,
    AppHandler = 31990
}
declare const NDKListKinds: NDKKind[];

/**
 * NDKUserProfile represents a user's kind 0 profile metadata
 */
interface NDKUserProfile {
    [key: string]: string | number | undefined;
    created_at?: number;
    name?: string;
    displayName?: string;
    image?: string;
    banner?: string;
    bio?: string;
    nip05?: string;
    lud06?: string;
    lud16?: string;
    about?: string;
    zapService?: string;
    website?: string;
    profileEvent?: string;
}
declare function profileFromEvent(event: NDKEvent): NDKUserProfile;
declare function serializeProfile(profile: NDKUserProfile): string;

type NDKZapConfirmationLN = {
    preimage: string;
};
type NDKPaymentConfirmationLN = {
    preimage: string;
};
type LNPaymentRequest = string;
type LnPaymentInfo = {
    pr: LNPaymentRequest;
};
type NDKLUD18ServicePayerData = Partial<{
    name: {
        mandatory: boolean;
    };
    pubkey: {
        mandatory: boolean;
    };
    identifier: {
        mandatory: boolean;
    };
    email: {
        mandatory: boolean;
    };
    auth: {
        mandatory: boolean;
        k1: string;
    };
}> & Record<string, unknown>;
type NDKLnUrlData = {
    tag: string;
    callback: string;
    minSendable: number;
    maxSendable: number;
    metadata: string;
    payerData?: NDKLUD18ServicePayerData;
    commentAllowed?: number;
    /**
     * Pubkey of the zapper that should publish zap receipts for this user
     */
    nostrPubkey?: Hexpubkey;
    allowsNostr?: boolean;
};
declare function getNip57ZapSpecFromLud({ lud06, lud16 }: {
    lud06?: string;
    lud16?: string;
}, ndk: NDK): Promise<NDKLnUrlData | undefined>;

type Hexpubkey = string;
type Npub = string;
type ProfilePointer = {
    pubkey: string;
    relays?: string[];
    nip46?: string[];
};
type EventPointer = {
    id: string;
    relays?: string[];
    author?: string;
    kind?: number;
};
interface NDKUserParams {
    npub?: Npub;
    hexpubkey?: Hexpubkey;
    pubkey?: Hexpubkey;
    nip05?: string;
    relayUrls?: string[];
    nip46Urls?: string[];
}
/**
 * Represents a pubkey.
 */
declare class NDKUser {
    ndk: NDK | undefined;
    profile?: NDKUserProfile;
    private _npub?;
    private _pubkey?;
    readonly relayUrls: string[];
    readonly nip46Urls: string[];
    constructor(opts: NDKUserParams);
    get npub(): string;
    get nprofile(): string;
    set npub(npub: Npub);
    /**
     * Get the user's hexpubkey
     * @returns {Hexpubkey} The user's hexpubkey
     *
     * @deprecated Use `pubkey` instead
     */
    get hexpubkey(): Hexpubkey;
    /**
     * Set the user's hexpubkey
     * @param pubkey {Hexpubkey} The user's hexpubkey
     * @deprecated Use `pubkey` instead
     */
    set hexpubkey(pubkey: Hexpubkey);
    /**
     * Get the user's pubkey
     * @returns {string} The user's pubkey
     */
    get pubkey(): string;
    /**
     * Set the user's pubkey
     * @param pubkey {string} The user's pubkey
     */
    set pubkey(pubkey: string);
    /**
     * Gets NIP-57 and NIP-61 information that this user has signaled
     *
     * @param getAll {boolean} Whether to get all zap info or just the first one
     */
    getZapInfo(getAll?: boolean, methods?: NDKZapMethod[]): Promise<NDKZapMethodInfo[]>;
    /**
     * Determines whether this user
     * has signaled support for NIP-60 zaps
     **/
    /**
     * Retrieves the zapper this pubkey has designated as an issuer of zap receipts
     */
    getZapConfiguration(ndk?: NDK): Promise<NDKLnUrlData | undefined>;
    /**
     * Fetches the zapper's pubkey for the zapped user
     * @returns The zapper's pubkey if one can be found
     */
    getZapperPubkey(): Promise<Hexpubkey | undefined>;
    /**
     * Instantiate an NDKUser from a NIP-05 string
     * @param nip05Id {string} The user's NIP-05
     * @param ndk {NDK} An NDK instance
     * @param skipCache {boolean} Whether to skip the cache or not
     * @returns {NDKUser | undefined} An NDKUser if one is found for the given NIP-05, undefined otherwise.
     */
    static fromNip05(nip05Id: string, ndk: NDK, skipCache?: boolean): Promise<NDKUser | undefined>;
    /**
     * Fetch a user's profile
     * @param opts {NDKSubscriptionOptions} A set of NDKSubscriptionOptions
     * @param storeProfileEvent {boolean} Whether to store the profile event or not
     * @returns User Profile
     */
    fetchProfile(opts?: NDKSubscriptionOptions, storeProfileEvent?: boolean): Promise<NDKUserProfile | null>;
    /**
     * Returns a set of users that this user follows.
     *
     * @deprecated Use followSet instead
     */
    follows: (opts?: NDKSubscriptionOptions | undefined, outbox?: boolean | undefined, kind?: number | undefined) => Promise<Set<NDKUser>>;
    /**
     * Returns a set of pubkeys that this user follows.
     *
     * @param opts - NDKSubscriptionOptions
     * @param outbox - boolean
     * @param kind - number
     */
    followSet(opts?: NDKSubscriptionOptions, outbox?: boolean, kind?: number): Promise<Set<Hexpubkey>>;
    /** @deprecated Use referenceTags instead. */
    /**
     * Get the tag that can be used to reference this user in an event
     * @returns {NDKTag} an NDKTag
     */
    tagReference(): NDKTag;
    /**
     * Get the tags that can be used to reference this user in an event
     * @returns {NDKTag[]} an array of NDKTag
     */
    referenceTags(marker?: string): NDKTag[];
    /**
     * Publishes the current profile.
     */
    publish(): Promise<void>;
    /**
     * Add a follow to this user's contact list
     *
     * @param newFollow {NDKUser} The user to follow
     * @param currentFollowList {Set<NDKUser>} The current follow list
     * @param kind {NDKKind} The kind to use for this contact list (defaults to `3`)
     * @returns {Promise<boolean>} True if the follow was added, false if the follow already exists
     */
    follow(newFollow: NDKUser, currentFollowList?: Set<NDKUser>, kind?: NDKKind): Promise<boolean>;
    /**
     * Remove a follow from this user's contact list
     *
     * @param user {NDKUser} The user to unfollow
     * @param currentFollowList {Set<NDKUser>} The current follow list
     * @param kind {NDKKind} The kind to use for this contact list (defaults to `3`)
     * @returns The relays were the follow list was published or false if the user wasn't found
     */
    unfollow(user: NDKUser, currentFollowList?: Set<NDKUser>, kind?: NDKKind): Promise<Set<NDKRelay> | boolean>;
    /**
     * Validate a user's NIP-05 identifier (usually fetched from their kind:0 profile data)
     *
     * @param nip05Id The NIP-05 string to validate
     * @returns {Promise<boolean | null>} True if the NIP-05 is found and matches this user's pubkey,
     * False if the NIP-05 is found but doesn't match this user's pubkey,
     * null if the NIP-05 isn't found on the domain or we're unable to verify (because of network issues, etc.)
     */
    validateNip05(nip05Id: string): Promise<boolean | null>;
}

type NDKFilterFingerprint = string;
/**
 * Creates a fingerprint for this filter
 *
 * This a deterministic association of the filters
 * used in a filters. When the combination of filters makes it
 * possible to group them, the fingerprint is used to group them.
 *
 * The different filters in the array are differentiated so that
 * filters can only be grouped with other filters that have the same signature
 *
 * The calculated group ID uses a + prefix to avoid grouping subscriptions
 * that intend to close immediately after EOSE and those that are probably
 * going to be kept open.
 *
 * @returns The fingerprint, or undefined if the filters are not groupable.
 */
declare function filterFingerprint(filters: NDKFilter[], closeOnEose: boolean): NDKFilterFingerprint | undefined;
/**
 * Go through all the passed filters, which should be
 * relatively similar, and merge them.
 */
declare function mergeFilters(filters: NDKFilter[]): NDKFilter[];

type NDKSubscriptionId = string;
/**
 * This class monitors active subscriptions.
 */
declare class NDKSubscriptionManager {
    subscriptions: Map<NDKSubscriptionId, NDKSubscription>;
    seenEvents: Map<string, NDKRelay[]>;
    private debug;
    constructor(debug: debug$1.Debugger);
    add(sub: NDKSubscription): void;
    seenEvent(eventId: NDKEventId, relay: NDKRelay): void;
    /**
     * Whenever an event comes in, this function is called.
     * This function matches the received event against all the
     * known (i.e. active) NDKSubscriptions, and if it matches,
     * it sends the event to the subscription.
     *
     * This is the single place in the codebase that matches
     * incoming events with parties interested in the event.
     *
     * This is also what allows for reactivity in NDK apps, such that
     * whenever an active subscription receives an event that some
     * other active subscription would want to receive, both receive it.
     *
     * TODO This also allows for subscriptions that overlap in meaning
     * to be collapsed into one.
     *
     * I.e. if a subscription with filter: kinds: [1], authors: [alice]
     * is created and EOSEs, and then a subsequent subscription with
     * kinds: [1], authors: [alice] is created, once the second subscription
     * EOSEs we can safely close it, increment its refCount and close it,
     * and when the first subscription receives a new event from Alice this
     * code will make the second subscription receive the event even though
     * it has no active subscription on a relay.
     * @param event Raw event received from a relay
     * @param relay Relay that sent the event
     * @param optimisticPublish Whether the event is coming from an optimistic publish
     */
    filterMatchingTime: number;
    filterMatchingCount: number;
    dispatchEvent(event: NostrEvent, relay?: NDKRelay, optimisticPublish?: boolean): void;
}

type Item = {
    subscription: NDKSubscription;
    filters: NDKFilter[];
};
declare enum NDKRelaySubscriptionStatus {
    INITIAL = 0,
    /**
     * The subscription is pending execution.
     */
    PENDING = 1,
    /**
     * The subscription is waiting for the relay to be ready.
     */
    WAITING = 2,
    /**
     * The subscription is currently running.
     */
    RUNNING = 3,
    CLOSED = 4
}
/**
 * Groups together a number of NDKSubscriptions (as created by the user),
 * filters (as computed internally), executed, or to be executed, within
 * a single specific relay.
 */
declare class NDKRelaySubscription {
    fingerprint: NDKFilterFingerprint;
    items: Map<NDKSubscriptionInternalId, Item>;
    topSubManager: NDKSubscriptionManager;
    debug: debug.Debugger;
    /**
     * Tracks the status of this REQ.
     */
    status: NDKRelaySubscriptionStatus;
    onClose?: (sub: NDKRelaySubscription) => void;
    private relay;
    /**
     * Whether this subscription has reached EOSE.
     */
    private eosed;
    /**
     * Timeout at which this subscription will
     * start executing.
     */
    private executionTimer?;
    /**
     * Track the time at which this subscription will fire.
     */
    private fireTime?;
    /**
     * The delay type that the current fireTime was calculated with.
     */
    private delayType?;
    /**
     * The filters that have been executed.
     */
    executeFilters?: NDKFilter[];
    readonly id: string;
    /**
     *
     * @param fingerprint The fingerprint of this subscription.
     */
    constructor(relay: NDKRelay, fingerprint: NDKFilterFingerprint | null, topSubManager: NDKSubscriptionManager);
    private _subId?;
    get subId(): string;
    private subIdParts;
    private addSubIdPart;
    addItem(subscription: NDKSubscription, filters: NDKFilter[]): void;
    /**
     * A subscription has been closed, remove it from the list of items.
     * @param subscription
     */
    removeItem(subscription: NDKSubscription): void;
    private close;
    cleanup(): void;
    private evaluateExecutionPlan;
    private schedule;
    private executeOnRelayReady;
    private finalizeSubId;
    private reExecuteAfterAuth;
    private execute;
    onstart(): void;
    onevent(event: NostrEvent): void;
    oneose(subId: string): void;
    onclose(reason?: string): void;
    onclosed(reason?: string): void;
    /**
     * Grabs the filters from all the subscriptions
     * and merges them into a single filter.
     */
    private compileFilters;
}

declare class NDKRelayConnectivity {
    private ndkRelay;
    private ws?;
    private _status;
    private timeoutMs?;
    private connectedAt?;
    private _connectionStats;
    private debug;
    netDebug?: NDKNetDebug;
    private connectTimeout;
    private reconnectTimeout;
    private ndk?;
    openSubs: Map<string, NDKRelaySubscription>;
    private openCountRequests;
    private openEventPublishes;
    private serial;
    baseEoseTimeout: number;
    constructor(ndkRelay: NDKRelay, ndk?: NDK);
    /**
     * Connects to the NDK relay and handles the connection lifecycle.
     *
     * This method attempts to establish a WebSocket connection to the NDK relay specified in the `ndkRelay` object.
     * If the connection is successful, it updates the connection statistics, sets the connection status to `CONNECTED`,
     * and emits `connect` and `ready` events on the `ndkRelay` object.
     *
     * If the connection attempt fails, it handles the error by either initiating a reconnection attempt or emitting a
     * `delayed-connect` event on the `ndkRelay` object, depending on the `reconnect` parameter.
     *
     * @param timeoutMs - The timeout in milliseconds for the connection attempt. If not provided, the default timeout from the `ndkRelay` object is used.
     * @param reconnect - Indicates whether a reconnection should be attempted if the connection fails. Defaults to `true`.
     * @returns A Promise that resolves when the connection is established, or rejects if the connection fails.
     */
    connect(timeoutMs?: number, reconnect?: boolean): Promise<void>;
    /**
     * Disconnects the WebSocket connection to the NDK relay.
     * This method sets the connection status to `NDKRelayStatus.DISCONNECTING`,
     * attempts to close the WebSocket connection, and sets the status to
     * `NDKRelayStatus.DISCONNECTED` if the disconnect operation fails.
     */
    disconnect(): void;
    /**
     * Handles the error that occurred when attempting to connect to the NDK relay.
     * If `reconnect` is `true`, this method will initiate a reconnection attempt.
     * Otherwise, it will emit a `delayed-connect` event on the `ndkRelay` object,
     * indicating that a reconnection should be attempted after a delay.
     *
     * @param reconnect - Indicates whether a reconnection should be attempted.
     */
    onConnectionError(reconnect: boolean): void;
    /**
     * Handles the connection event when the WebSocket connection is established.
     * This method is called when the WebSocket connection is successfully opened.
     * It clears any existing connection and reconnection timeouts, updates the connection statistics,
     * sets the connection status to `CONNECTED`, and emits `connect` and `ready` events on the `ndkRelay` object.
     */
    private onConnect;
    /**
     * Handles the disconnection event when the WebSocket connection is closed.
     * This method is called when the WebSocket connection is successfully closed.
     * It updates the connection statistics, sets the connection status to `DISCONNECTED`,
     * initiates a reconnection attempt if we didn't disconnect ourselves,
     * and emits a `disconnect` event on the `ndkRelay` object.
     */
    private onDisconnect;
    /**
     * Handles incoming messages from the NDK relay WebSocket connection.
     * This method is called whenever a message is received from the relay.
     * It parses the message data and dispatches the appropriate handling logic based on the message type.
     *
     * @param event - The MessageEvent containing the received message data.
     */
    private onMessage;
    /**
     * Handles an authentication request from the NDK relay.
     *
     * If an authentication policy is configured, it will be used to authenticate the connection.
     * Otherwise, the `auth` event will be emitted to allow the application to handle the authentication.
     *
     * @param challenge - The authentication challenge provided by the NDK relay.
     */
    private onAuthRequested;
    /**
     * Handles errors that occur on the WebSocket connection to the relay.
     * @param error - The error or event that occurred.
     */
    private onError;
    /**
     * Gets the current status of the NDK relay connection.
     * @returns {NDKRelayStatus} The current status of the NDK relay connection.
     */
    get status(): NDKRelayStatus;
    /**
     * Checks if the NDK relay connection is currently available.
     * @returns {boolean} `true` if the relay connection is in the `CONNECTED` status, `false` otherwise.
     */
    isAvailable(): boolean;
    /**
     * Checks if the NDK relay connection is flapping, which means the connection is rapidly
     * disconnecting and reconnecting. This is determined by analyzing the durations of the
     * last three connection attempts. If the standard deviation of the durations is less
     * than 1000 milliseconds, the connection is considered to be flapping.
     *
     * @returns {boolean} `true` if the connection is flapping, `false` otherwise.
     */
    private isFlapping;
    /**
     * Handles a notice received from the NDK relay.
     * If the notice indicates the relay is complaining (e.g. "too many" or "maximum"),
     * the method disconnects from the relay and attempts to reconnect after a 2-second delay.
     * A debug message is logged with the relay URL and the notice text.
     * The "notice" event is emitted on the ndkRelay instance with the notice text.
     *
     * @param notice - The notice text received from the NDK relay.
     */
    private onNotice;
    /**
     * Attempts to reconnect to the NDK relay after a connection is lost.
     * This function is called recursively to handle multiple reconnection attempts.
     * It checks if the relay is flapping and emits a "flapping" event if so.
     * It then calculates a delay before the next reconnection attempt based on the number of previous attempts.
     * The function sets a timeout to execute the next reconnection attempt after the calculated delay.
     * If the maximum number of reconnection attempts is reached, a debug message is logged.
     *
     * @param attempt - The current attempt number (default is 0).
     */
    private handleReconnection;
    /**
     * Sends a message to the NDK relay if the connection is in the CONNECTED state and the WebSocket is open.
     * If the connection is not in the CONNECTED state or the WebSocket is not open, logs a debug message and throws an error.
     *
     * @param message - The message to send to the NDK relay.
     * @throws {Error} If attempting to send on a closed relay connection.
     */
    send(message: string): Promise<void>;
    /**
     * Authenticates the NDK event by sending it to the NDK relay and returning a promise that resolves with the result.
     *
     * @param event - The NDK event to authenticate.
     * @returns A promise that resolves with the authentication result.
     */
    private auth;
    /**
     * Publishes an NDK event to the relay and returns a promise that resolves with the result.
     *
     * @param event - The NDK event to publish.
     * @returns A promise that resolves with the result of the event publication.
     * @throws {Error} If attempting to publish on a closed relay connection.
     */
    publish(event: NostrEvent): Promise<string>;
    /**
     * Counts the number of events that match the provided filters.
     *
     * @param filters - The filters to apply to the count request.
     * @param params - An optional object containing a custom id for the count request.
     * @returns A promise that resolves with the number of matching events.
     * @throws {Error} If attempting to send the count request on a closed relay connection.
     */
    count(filters: NDKFilter[], params: {
        id?: string | null;
    }): Promise<number>;
    close(subId: string, reason?: string): void;
    /**
     * Subscribes to the NDK relay with the provided filters and parameters.
     *
     * @param filters - The filters to apply to the subscription.
     * @param params - The subscription parameters, including an optional custom id.
     * @returns A new NDKRelaySubscription instance.
     */
    req(relaySub: NDKRelaySubscription): void;
    /**
     * Utility functions to update the connection stats.
     */
    private updateConnectionStats;
    /** Returns the connection stats. */
    get connectionStats(): NDKRelayConnectionStats;
    /** Returns the relay URL */
    get url(): WebSocket["url"];
    get connected(): boolean;
}

type NDKRelayScore = number;

/**
 * The subscription manager of an NDKRelay is in charge of orchestrating the subscriptions
 * that are created and closed in a given relay.
 *
 * The manager is responsible for:
 * * restarting subscriptions when they are unexpectedly closed
 * * scheduling subscriptions that are received before the relay is connected
 * * grouping similar subscriptions to be compiled into individual REQs
 */
declare class NDKRelaySubscriptionManager {
    private relay;
    private subscriptions;
    private generalSubManager;
    /**
     * @param relay - The relay instance.
     * @param generalSubManager - The subscription manager instance.
     */
    constructor(relay: NDKRelay, generalSubManager: NDKSubscriptionManager);
    /**
     * Adds a subscription to the manager.
     */
    addSubscription(sub: NDKSubscription, filters: NDKFilter[]): void;
    createSubscription(sub: NDKSubscription, filters: NDKFilter[], fingerprint?: NDKFilterFingerprint): NDKRelaySubscription;
    private onRelaySubscriptionClose;
}

type ENCRYPTION_SCHEMES = "nip04" | "nip44";
declare const DEFAULT_ENCRYPTION_SCHEME: ENCRYPTION_SCHEMES;
/**
 * Interface for NDK signers.
 */
interface NDKSigner {
    /**
     * Blocks until the signer is ready and returns the associated NDKUser.
     * @returns A promise that resolves to the NDKUser instance.
     */
    blockUntilReady(): Promise<NDKUser>;
    /**
     * Getter for the user property.
     * @returns A promise that resolves to the NDKUser instance.
     */
    user(): Promise<NDKUser>;
    /**
     * Signs the given Nostr event.
     * @param event - The Nostr event to be signed.
     * @returns A promise that resolves to the signature of the signed event.
     */
    sign(event: NostrEvent): Promise<string>;
    /**
     * Getter for the preferred relays.
     * @returns A promise containing a simple map of preferred relays and their read/write policies.
     */
    relays?(ndk?: NDK): Promise<NDKRelay[]>;
    /**
     * Encrypts the given Nostr event for the given recipient.
     * @param value - The value to be encrypted.
     * @param recipient - The recipient of the encrypted value.
     * @param type - The encryption scheme to use. Defaults to "nip04".
     */
    encrypt(recipient: NDKUser, value: string, type?: ENCRYPTION_SCHEMES): Promise<string>;
    /**
     * Decrypts the given value.
     * @param value
     * @param sender
     * @param type - The encryption scheme to use. Defaults to "nip04".
     */
    decrypt(sender: NDKUser, value: string, type?: ENCRYPTION_SCHEMES): Promise<string>;
    /**
     * @deprecated use nip44Encrypt instead
     */
    nip04Encrypt(recipient: NDKUser, value: string): Promise<string>;
    /**
     * @deprecated use nip44Decrypt instead
     */
    nip04Decrypt(sender: NDKUser, value: string): Promise<string>;
    /**
     * @deprecated use nip44Encrypt instead
     */
    nip44Encrypt(recipient: NDKUser, value: string): Promise<string>;
    /**
     * @deprecated use nip44Decrypt instead
     */
    nip44Decrypt(sender: NDKUser, value: string): Promise<string>;
}

/**
 * NDKAuthPolicies are functions that are called when a relay requests authentication
 * so that you can define a behavior for your application.
 *
 * @param relay The relay that requested authentication.
 * @param challenge The challenge that the relay sent.
 */
type NDKAuthPolicy = (relay: NDKRelay, challenge: string) => Promise<boolean | void | NDKEvent>;
/**
 * This policy will disconnect from relays that request authentication.
 */
declare function disconnect(pool: NDKPool, debug?: debug.Debugger): (relay: NDKRelay) => Promise<void>;
type ISignIn = {
    ndk?: NDK;
    signer?: NDKSigner;
    debug?: debug.Debugger;
};
/**
 * Uses the signer to sign an event and then authenticate with the relay.
 * If no signer is provided the NDK signer will be used.
 * If none is not available it will wait for one to be ready.
 */
declare function signIn({ ndk, signer, debug }?: ISignIn): (relay: NDKRelay, challenge: string) => Promise<NDKEvent>;
declare const NDKRelayAuthPolicies: {
    disconnect: typeof disconnect;
    signIn: typeof signIn;
};

/** @deprecated Use `WebSocket['url']` instead. */
type NDKRelayUrl = WebSocket["url"];
declare enum NDKRelayStatus {
    DISCONNECTING = 0,// 0
    DISCONNECTED = 1,// 1
    RECONNECTING = 2,// 2
    FLAPPING = 3,// 3
    CONNECTING = 4,// 4
    CONNECTED = 5,// 5
    AUTH_REQUESTED = 6,// 6
    AUTHENTICATING = 7,// 7
    AUTHENTICATED = 8
}
interface NDKRelayConnectionStats {
    /**
     * The number of times a connection has been attempted.
     */
    attempts: number;
    /**
     * The number of times a connection has been successfully established.
     */
    success: number;
    /**
     * The durations of the last 100 connections in milliseconds.
     */
    durations: number[];
    /**
     * The time the current connection was established in milliseconds.
     */
    connectedAt?: number;
    /**
     * Timestamp of the next reconnection attempt.
     */
    nextReconnectAt?: number;
    /**
     * Signature validation ratio for this relay.
     * @see NDKRelayOptions.validationRatio
     */
    validationRatio?: number;
}
/**
 * The NDKRelay class represents a connection to a relay.
 *
 * @emits NDKRelay#connect
 * @emits NDKRelay#ready
 * @emits NDKRelay#disconnect
 * @emits NDKRelay#notice
 * @emits NDKRelay#event
 * @emits NDKRelay#published when an event is published to the relay
 * @emits NDKRelay#publish:failed when an event fails to publish to the relay
 * @emits NDKRelay#eose when the relay has reached the end of stored events
 * @emits NDKRelay#auth when the relay requires authentication
 * @emits NDKRelay#authed when the relay has authenticated
 * @emits NDKRelay#delayed-connect when the relay will wait before reconnecting
 */
declare class NDKRelay extends EventEmitter<{
    connect: () => void;
    ready: () => void;
    /**
     * Emitted when the relay has reached the end of stored events.
     */
    disconnect: () => void;
    flapping: (stats: NDKRelayConnectionStats) => void;
    notice: (notice: string) => void;
    auth: (challenge: string) => void;
    authed: () => void;
    "auth:failed": (error: Error) => void;
    published: (event: NDKEvent) => void;
    "publish:failed": (event: NDKEvent, error: Error) => void;
    "delayed-connect": (delayInMs: number) => void;
}> {
    readonly url: WebSocket["url"];
    readonly scores: Map<NDKUser, NDKRelayScore>;
    connectivity: NDKRelayConnectivity;
    subs: NDKRelaySubscriptionManager;
    private publisher;
    authPolicy?: NDKAuthPolicy;
    /**
     * The lowest validation ratio this relay can reach.
     */
    lowestValidationRatio?: number;
    /**
     * Current validation ratio this relay is targeting.
     */
    targetValidationRatio?: number;
    validationRatioFn?: (relay: NDKRelay, validatedCount: number, nonValidatedCount: number) => number;
    /**
     * This tracks events that have been seen by this relay
     * with a valid signature.
     */
    private validatedEventCount;
    /**
     * This tracks events that have been seen by this relay
     * but have not been validated.
     */
    private nonValidatedEventCount;
    /**
     * Whether this relay is trusted.
     *
     * Trusted relay's events do not get their signature verified.
     */
    trusted: boolean;
    complaining: boolean;
    readonly debug: debug$1.Debugger;
    static defaultValidationRatioUpdateFn: (relay: NDKRelay, validatedCount: number, nonValidatedCount: number) => number;
    constructor(url: WebSocket["url"], authPolicy: NDKAuthPolicy | undefined, ndk: NDK);
    private updateValidationRatio;
    get status(): NDKRelayStatus;
    get connectionStats(): NDKRelayConnectionStats;
    /**
     * Connects to the relay.
     */
    connect(timeoutMs?: number, reconnect?: boolean): Promise<void>;
    /**
     * Disconnects from the relay.
     */
    disconnect(): void;
    /**
     * Queues or executes the subscription of a specific set of filters
     * within this relay.
     *
     * @param subscription NDKSubscription this filters belong to.
     * @param filters Filters to execute
     */
    subscribe(subscription: NDKSubscription, filters: NDKFilter[]): void;
    /**
     * Publishes an event to the relay with an optional timeout.
     *
     * If the relay is not connected, the event will be published when the relay connects,
     * unless the timeout is reached before the relay connects.
     *
     * @param event The event to publish
     * @param timeoutMs The timeout for the publish operation in milliseconds
     * @returns A promise that resolves when the event has been published or rejects if the operation times out
     */
    publish(event: NDKEvent, timeoutMs?: number): Promise<boolean>;
    referenceTags(): NDKTag[];
    addValidatedEvent(): void;
    addNonValidatedEvent(): void;
    /**
     * The current validation ratio this relay has achieved.
     */
    get validationRatio(): number;
    shouldValidateEvent(): boolean;
    get connected(): boolean;
    req: (relaySub: NDKRelaySubscription) => void;
    close: (subId: string) => void;
}

/**
 * Creates a NDKRelaySet for the specified event.
 * TODO: account for relays where tagged pubkeys or hashtags
 * tend to write to.
 * @param ndk {NDK}
 * @param event {Event}
 * @returns Promise<NDKRelaySet>
 */
declare function calculateRelaySetFromEvent(ndk: NDK, event: NDKEvent): Promise<NDKRelaySet>;

declare class NDKPublishError extends Error {
    errors: Map<NDKRelay, Error>;
    publishedToRelays: Set<NDKRelay>;
    /**
     * Intended relay set where the publishing was intended to happen.
     */
    intendedRelaySet?: NDKRelaySet;
    constructor(message: string, errors: Map<NDKRelay, Error>, publishedToRelays: Set<NDKRelay>, intendedRelaySet?: NDKRelaySet);
    get relayErrors(): string;
}
/**
 * A relay set is a group of relays. This grouping can be short-living, for a single
 * REQ or can be long-lasting, for example for the explicit relay list the user
 * has specified.
 *
 * Requests to relays should be sent through this interface.
 */
declare class NDKRelaySet {
    readonly relays: Set<NDKRelay>;
    private debug;
    private ndk;
    private pool;
    constructor(relays: Set<NDKRelay>, ndk: NDK, pool?: NDKPool);
    /**
     * Adds a relay to this set.
     */
    addRelay(relay: NDKRelay): void;
    get relayUrls(): WebSocket["url"][];
    /**
     * Creates a relay set from a list of relay URLs.
     *
     * If no connection to the relay is found in the pool it will temporarily
     * connect to it.
     *
     * @param relayUrls - list of relay URLs to include in this set
     * @param ndk
     * @param connect - whether to connect to the relay immediately if it was already in the pool but not connected
     * @returns NDKRelaySet
     */
    static fromRelayUrls(relayUrls: readonly string[], ndk: NDK, connect?: boolean, pool?: NDKPool): NDKRelaySet;
    /**
     * Publish an event to all relays in this set. Returns the number of relays that have received the event.
     * @param event
     * @param timeoutMs - timeout in milliseconds for each publish operation and connection operation
     * @returns A set where the event was successfully published to
     * @throws NDKPublishError if no relay was able to receive the event
     * @example
     * ```typescript
     * const event = new NDKEvent(ndk, {kinds: [NDKKind.Message], "#d": ["123"]});
     * try {
     *    const publishedToRelays = await relaySet.publish(event);
     *    console.log(`published to ${publishedToRelays.size} relays`)
     * } catch (error) {
     *   console.error("error publishing to relays", error);
     *
     *   if (error instanceof NDKPublishError) {
     *      for (const [relay, err] of error.errors) {
     *         console.error(`error publishing to relay ${relay.url}`, err);
     *       }
     *   }
     * }
     * ```
     */
    publish(event: NDKEvent, timeoutMs?: number, requiredRelayCount?: number): Promise<Set<NDKRelay>>;
    get size(): number;
}

type NDKSubscriptionInternalId = string;
type NDKSubscriptionDelayedType = "at-least" | "at-most";
type NDKFilter<K extends number = NDKKind> = {
    ids?: string[];
    kinds?: K[];
    authors?: string[];
    since?: number;
    until?: number;
    limit?: number;
    search?: string;
    [key: `#${string}`]: string[] | undefined;
};
declare enum NDKSubscriptionCacheUsage {
    ONLY_CACHE = "ONLY_CACHE",
    CACHE_FIRST = "CACHE_FIRST",
    PARALLEL = "PARALLEL",
    ONLY_RELAY = "ONLY_RELAY"
}
interface NDKSubscriptionOptions {
    /**
     * Whether to close the subscription when all relays have reached the end of the event stream.
     * @default false
     */
    closeOnEose?: boolean;
    cacheUsage?: NDKSubscriptionCacheUsage;
    /**
     * Groupable subscriptions are created with a slight time
     * delayed to allow similar filters to be grouped together.
     */
    groupable?: boolean;
    /**
     * The delay to use when grouping subscriptions, specified in milliseconds.
     * @default 100
     * @example
     * const sub1 = ndk.subscribe({ kinds: [1], authors: ["alice"] }, { groupableDelay: 100 });
     * const sub2 = ndk.subscribe({ kinds: [0], authors: ["alice"] }, { groupableDelay: 1000 });
     * // sub1 and sub2 will be grouped together and executed 100ms after sub1 was created
     */
    groupableDelay?: number;
    /**
     * Specifies how this delay should be interpreted.
     * "at-least" means "wait at least this long before sending the subscription"
     * "at-most" means "wait at most this long before sending the subscription"
     * @default "at-most"
     * @example
     * const sub1 = ndk.subscribe({ kinds: [1], authors: ["alice"] }, { groupableDelay: 100, groupableDelayType: "at-least" });
     * const sub2 = ndk.subscribe({ kinds: [0], authors: ["alice"] }, { groupableDelay: 1000, groupableDelayType: "at-most" });
     * // sub1 and sub2 will be grouped together and executed 1000ms after sub1 was created
     */
    groupableDelayType?: NDKSubscriptionDelayedType;
    /**
     * The subscription ID to use for the subscription.
     */
    subId?: string;
    /**
     * Pool to use
     */
    pool?: NDKPool;
    /**
     * Skip signature verification
     * @default false
     */
    skipVerification?: boolean;
    /**
     * Skip event validation. Event validation, checks whether received
     * kinds conform to what the expected schema of that kind should look like.rtwle
     * @default false
     */
    skipValidation?: boolean;
    /**
     * Skip emitting on events before they are received from a relay. (skip optimistic publish)
     * @default false
     */
    skipOptimisticPublishEvent?: boolean;
}
/**
 * Default subscription options.
 */
declare const defaultOpts: NDKSubscriptionOptions;
/**
 * Represents a subscription to an NDK event stream.
 *
 * @emits event
 * Emitted when an event is received by the subscription.
 * * ({NDKEvent} event - The event received by the subscription,
 * * {NDKRelay} relay - The relay that received the event,
 * * {NDKSubscription} subscription - The subscription that received the event.)
 *
 * @emits event:dup
 * Emitted when a duplicate event is received by the subscription.
 * * {NDKEvent} event - The duplicate event received by the subscription.
 * * {NDKRelay} relay - The relay that received the event.
 * * {number} timeSinceFirstSeen - The time elapsed since the first time the event was seen.
 * * {NDKSubscription} subscription - The subscription that received the event.
 *
 * @emits cacheEose - Emitted when the cache adapter has reached the end of the events it had.
 *
 * @emits eose - Emitted when all relays have reached the end of the event stream.
 * * {NDKSubscription} subscription - The subscription that received EOSE.
 *
 * @emits close - Emitted when the subscription is closed.
 * * {NDKSubscription} subscription - The subscription that was closed.
 *
 * @example
 * const sub = ndk.subscribe({ kinds: [1] }); // Get all kind:1s
 * sub.on("event", (event) => console.log(event.content); // Show the content
 * sub.on("eose", () => console.log("All relays have reached the end of the event stream"));
 * sub.on("close", () => console.log("Subscription closed"));
 * setTimeout(() => sub.stop(), 10000); // Stop the subscription after 10 seconds
 *
 * @description
 * Subscriptions are created using {@link NDK.subscribe}.
 *
 * # Event validation
 * By defaults, subscriptions will validate events to comply with the minimal requirement
 * of each known NIP.
 * This can be disabled by setting the `skipValidation` option to `true`.
 *
 * @example
 * const sub = ndk.subscribe({ kinds: [1] }, { skipValidation: false });
 * sub.on("event", (event) => console.log(event.content); // Only valid events will be received
 */
declare class NDKSubscription extends EventEmitter<{
    cacheEose: () => void;
    eose: (sub: NDKSubscription) => void;
    close: (sub: NDKSubscription) => void;
    "event:dup": (eventId: NDKEventId, relay: NDKRelay | undefined, timeSinceFirstSeen: number, sub: NDKSubscription) => void;
    event: (event: NDKEvent, relay: NDKRelay | undefined, sub: NDKSubscription) => void;
    /**
     * Emitted when a relay unilaterally closes the subscription.
     * @param relay
     * @param reason
     * @returns
     */
    closed: (relay: NDKRelay, reason: string) => void;
}> {
    readonly subId?: string;
    readonly filters: NDKFilter[];
    readonly opts: NDKSubscriptionOptions;
    readonly pool: NDKPool;
    readonly skipVerification: boolean;
    readonly skipValidation: boolean;
    /**
     * Tracks the filters as they are executed on each relay
     */
    relayFilters?: Map<WebSocket["url"], NDKFilter[]>;
    relaySet?: NDKRelaySet;
    ndk: NDK;
    debug: debug.Debugger;
    /**
     * Events that have been seen by the subscription, with the time they were first seen.
     */
    eventFirstSeen: Map<string, number>;
    /**
     * Relays that have sent an EOSE.
     */
    eosesSeen: Set<NDKRelay>;
    /**
     * The time the last event was received by the subscription.
     * This is used to calculate when EOSE should be emitted.
     */
    private lastEventReceivedAt;
    internalId: NDKSubscriptionInternalId;
    /**
     * Whether the subscription should close when all relays have reached the end of the event stream.
     */
    closeOnEose: boolean;
    /**
     * Pool monitor callback
     */
    private poolMonitor;
    skipOptimisticPublishEvent: boolean;
    constructor(ndk: NDK, filters: NDKFilter | NDKFilter[], opts?: NDKSubscriptionOptions, relaySet?: NDKRelaySet, subId?: string);
    /**
     * Returns the relays that have not yet sent an EOSE.
     */
    relaysMissingEose(): WebSocket["url"][];
    /**
     * Provides access to the first filter of the subscription for
     * backwards compatibility.
     */
    get filter(): NDKFilter;
    get groupableDelay(): number | undefined;
    get groupableDelayType(): NDKSubscriptionDelayedType;
    isGroupable(): boolean;
    private shouldQueryCache;
    private shouldQueryRelays;
    private shouldWaitForCache;
    /**
     * Start the subscription. This is the main method that should be called
     * after creating a subscription.
     */
    start(): Promise<void>;
    /**
     * We want to monitor for new relays that are coming online, in case
     * they should be part of this subscription.
     */
    private startPoolMonitor;
    onStopped?: () => void;
    stop(): void;
    /**
     * @returns Whether the subscription has an authors filter.
     */
    hasAuthorsFilter(): boolean;
    private startWithCache;
    /**
     * Send REQ to relays
     */
    private startWithRelays;
    /**
     * Called when an event is received from a relay or the cache
     * @param event
     * @param relay
     * @param fromCache Whether the event was received from the cache
     * @param optimisticPublish Whether this event is coming from an optimistic publish
     */
    eventReceived(event: NDKEvent | NostrEvent, relay: NDKRelay | undefined, fromCache?: boolean, optimisticPublish?: boolean): void;
    closedReceived(relay: NDKRelay, reason: string): void;
    private eoseTimeout;
    private eosed;
    eoseReceived(relay: NDKRelay): void;
}

type ContentTag = {
    tags: NDKTag[];
    content: string;
};

type NDKEventSerialized = string;
/**
 * Serializes an event object into a string representation.
 *
 * @param this - The event object to serialize.
 * @returns A string representation of the serialized event.
 */
declare function serialize(this: NDKEvent | NostrEvent, includeSig?: boolean, includeId?: boolean): NDKEventSerialized;
/**
 * Deserialize a nostr event from a string
 * @param serializedEvent string
 * @returns NostrEvent
 */
declare function deserialize(serializedEvent: NDKEventSerialized): NostrEvent;

/**
 * NIP-73 entity types
 */
type NIP73EntityType = "url" | "hashtag" | "geohash" | "isbn" | "podcast:guid" | "podcast:item:guid" | "podcast:publisher:guid" | "isan" | "doi";

type NDKEventId = string;
type NDKTag = string[];
type NostrEvent = {
    created_at: number;
    content: string;
    tags: NDKTag[];
    kind?: NDKKind | number;
    pubkey: string;
    id?: string;
    sig?: string;
};
/**
 * NDKEvent is the basic building block of NDK; most things
 * you do with NDK will revolve around writing or consuming NDKEvents.
 */
declare class NDKEvent extends EventEmitter {
    ndk?: NDK;
    created_at?: number;
    content: string;
    tags: NDKTag[];
    kind?: NDKKind | number;
    id: string;
    sig?: string;
    pubkey: string;
    signatureVerified?: boolean;
    private _author;
    /**
     * The relay that this event was first received from.
     */
    relay: NDKRelay | undefined;
    /**
     * The relays that this event was received from and/or successfully published to.
     */
    get onRelays(): NDKRelay[];
    /**
     * The status of the publish operation.
     */
    publishStatus?: "pending" | "success" | "error";
    publishError?: Error;
    constructor(ndk?: NDK, event?: NostrEvent | NDKEvent);
    /**
     * Deserialize an NDKEvent from a serialized payload.
     * @param ndk
     * @param event
     * @returns
     */
    static deserialize(ndk: NDK | undefined, event: NDKEventSerialized): NDKEvent;
    /**
     * Returns the event as is.
     */
    rawEvent(): NostrEvent;
    set author(user: NDKUser);
    /**
     * Returns an NDKUser for the author of the event.
     */
    get author(): NDKUser;
    /**
     * NIP-73 tagging of external entities
     * @param entity to be tagged
     * @param type of the entity
     * @param markerUrl to be used as the marker URL
     *
     * @example
     * ```typescript
     * event.tagExternal("https://example.com/article/123#nostr", "url");
     * event.tags => [["i", "https://example.com/123"], ["k", "https://example.com"]]
     * ```
     *
     * @example tag a podcast:item:guid
     * ```typescript
     * event.tagExternal("e32b4890-b9ea-4aef-a0bf-54b787833dc5", "podcast:item:guid");
     * event.tags => [["i", "podcast:item:guid:e32b4890-b9ea-4aef-a0bf-54b787833dc5"], ["k", "podcast:item:guid"]]
     * ```
     *
     * @see https://github.com/nostr-protocol/nips/blob/master/73.md
     */
    tagExternal(entity: string, type: NIP73EntityType, markerUrl?: string): void;
    /**
     * Tag a user with an optional marker.
     * @param target What is to be tagged. Can be an NDKUser, NDKEvent, or an NDKTag.
     * @param marker The marker to use in the tag.
     * @param skipAuthorTag Whether to explicitly skip adding the author tag of the event.
     * @param forceTag Force a specific tag to be used instead of the default "e" or "a" tag.
     * @example
     * ```typescript
     * reply.tag(opEvent, "reply");
     * // reply.tags => [["e", <id>, <relay>, "reply"]]
     * ```
     */
    tag(target: NDKTag | NDKUser | NDKEvent, marker?: string, skipAuthorTag?: boolean, forceTag?: string): void;
    /**
     * Return a NostrEvent object, trying to fill in missing fields
     * when possible, adding tags when necessary.
     * @param pubkey {string} The pubkey of the user who the event belongs to.
     * @returns {Promise<NostrEvent>} A promise that resolves to a NostrEvent.
     */
    toNostrEvent(pubkey?: string): Promise<NostrEvent>;
    serialize: (includeSig?: boolean | undefined, includeId?: boolean | undefined) => string;
    getEventHash: () => string;
    validate: () => boolean;
    verifySignature: (persist: boolean) => boolean | undefined;
    /**
     * Is this event replaceable (whether parameterized or not)?
     *
     * This will return true for kind 0, 3, 10k-20k and 30k-40k
     */
    isReplaceable: () => boolean;
    isEphemeral: () => boolean;
    /**
     * Is this event parameterized replaceable?
     *
     * This will return true for kind 30k-40k
     */
    isParamReplaceable: () => boolean;
    /**
     * Encodes a bech32 id.
     *
     * @param relays {string[]} The relays to encode in the id
     * @returns {string} - Encoded naddr, note or nevent.
     */
    encode: (maxRelayCount?: number | undefined) => string;
    encrypt: (recipient?: NDKUser | undefined, signer?: NDKSigner | undefined, type?: ENCRYPTION_SCHEMES | undefined) => Promise<void>;
    decrypt: (sender?: NDKUser | undefined, signer?: NDKSigner | undefined, type?: ENCRYPTION_SCHEMES | undefined) => Promise<void>;
    /**
     * Get all tags with the given name
     * @param tagName {string} The name of the tag to search for
     * @returns {NDKTag[]} An array of the matching tags
     */
    getMatchingTags(tagName: string, marker?: string): NDKTag[];
    /**
     * Check if the event has a tag with the given name
     * @param tagName
     * @param marker
     * @returns
     */
    hasTag(tagName: string, marker?: string): boolean;
    /**
     * Get the first tag with the given name
     * @param tagName Tag name to search for
     * @returns The value of the first tag with the given name, or undefined if no such tag exists
     */
    tagValue(tagName: string): string | undefined;
    /**
     * Gets the NIP-31 "alt" tag of the event.
     */
    get alt(): string | undefined;
    /**
     * Sets the NIP-31 "alt" tag of the event. Use this to set an alt tag so
     * clients that don't handle a particular event kind can display something
     * useful for users.
     */
    set alt(alt: string | undefined);
    /**
     * Gets the NIP-33 "d" tag of the event.
     */
    get dTag(): string | undefined;
    /**
     * Sets the NIP-33 "d" tag of the event.
     */
    set dTag(value: string | undefined);
    /**
     * Remove all tags with the given name (e.g. "d", "a", "p")
     * @param tagName Tag name(s) to search for and remove
     * @returns {void}
     */
    removeTag(tagName: string | string[]): void;
    /**
     * Sign the event if a signer is present.
     *
     * It will generate tags.
     * Repleacable events will have their created_at field set to the current time.
     * @param signer {NDKSigner} The NDKSigner to use to sign the event
     * @returns {Promise<string>} A Promise that resolves to the signature of the signed event.
     */
    sign(signer?: NDKSigner): Promise<string>;
    /**
     *
     * @param relaySet
     * @param timeoutMs
     * @param requiredRelayCount
     * @returns
     */
    publishReplaceable(relaySet?: NDKRelaySet, timeoutMs?: number, requiredRelayCount?: number): Promise<Set<NDKRelay>>;
    /**
     * Attempt to sign and then publish an NDKEvent to a given relaySet.
     * If no relaySet is provided, the relaySet will be calculated by NDK.
     * @param relaySet {NDKRelaySet} The relaySet to publish the even to.
     * @param timeoutM {number} The timeout for the publish operation in milliseconds.
     * @param requiredRelayCount The number of relays that must receive the event for the publish to be considered successful.
     * @returns A promise that resolves to the relays the event was published to.
     */
    publish(relaySet?: NDKRelaySet, timeoutMs?: number, requiredRelayCount?: number): Promise<Set<NDKRelay>>;
    /**
     * Generates tags for users, notes, and other events tagged in content.
     * Will also generate random "d" tag for parameterized replaceable events where needed.
     * @returns {ContentTag} The tags and content of the event.
     */
    generateTags(): Promise<ContentTag>;
    get shouldAddClientTag(): boolean;
    muted(): string | null;
    /**
     * Returns the "d" tag of a parameterized replaceable event or throws an error if the event isn't
     * a parameterized replaceable event.
     * @returns {string} the "d" tag of the event.
     */
    replaceableDTag(): string;
    /**
     * Provides a deduplication key for the event.
     *
     * For kinds 0, 3, 10k-20k this will be the event <kind>:<pubkey>
     * For kinds 30k-40k this will be the event <kind>:<pubkey>:<d-tag>
     * For all other kinds this will be the event id
     */
    deduplicationKey(): string;
    /**
     * Returns the id of the event or, if it's a parameterized event, the generated id of the event using "d" tag, pubkey, and kind.
     * @returns {string} The id
     */
    tagId(): string;
    /**
     * Returns the "reference" value ("<kind>:<author-pubkey>:<d-tag>") for this replaceable event.
     * @returns {string} The id
     */
    tagAddress(): string;
    /**
     * Determines the type of tag that can be used to reference this event from another event.
     * @returns {string} The tag type
     * @example
     * event = new NDKEvent(ndk, { kind: 30000, pubkey: 'pubkey', tags: [ ["d", "d-code"] ] });
     * event.tagType(); // "a"
     */
    tagType(): "e" | "a";
    /**
     * Get the tag that can be used to reference this event from another event.
     *
     * Consider using referenceTags() instead (unless you have a good reason to use this)
     *
     * @example
     *     event = new NDKEvent(ndk, { kind: 30000, pubkey: 'pubkey', tags: [ ["d", "d-code"] ] });
     *     event.tagReference(); // ["a", "30000:pubkey:d-code"]
     *
     *     event = new NDKEvent(ndk, { kind: 1, pubkey: 'pubkey', id: "eventid" });
     *     event.tagReference(); // ["e", "eventid"]
     * @returns {NDKTag} The NDKTag object referencing this event
     */
    tagReference(marker?: string): NDKTag;
    /**
     * Get the tags that can be used to reference this event from another event
     * @param marker The marker to use in the tag
     * @param skipAuthorTag Whether to explicitly skip adding the author tag of the event
     * @param forceTag Force a specific tag to be used instead of the default "e" or "a" tag
     * @example
     *     event = new NDKEvent(ndk, { kind: 30000, pubkey: 'pubkey', tags: [ ["d", "d-code"] ] });
     *     event.referenceTags(); // [["a", "30000:pubkey:d-code"], ["e", "parent-id"]]
     *
     *     event = new NDKEvent(ndk, { kind: 1, pubkey: 'pubkey', id: "eventid" });
     *     event.referenceTags(); // [["e", "parent-id"]]
     * @returns {NDKTag} The NDKTag object referencing this event
     */
    referenceTags(marker?: string, skipAuthorTag?: boolean, forceTag?: string): NDKTag[];
    /**
     * Provides the filter that will return matching events for this event.
     *
     * @example
     *    event = new NDKEvent(ndk, { kind: 30000, pubkey: 'pubkey', tags: [ ["d", "d-code"] ] });
     *    event.filter(); // { "#a": ["30000:pubkey:d-code"] }
     * @example
     *    event = new NDKEvent(ndk, { kind: 1, pubkey: 'pubkey', id: "eventid" });
     *    event.filter(); // { "#e": ["eventid"] }
     *
     * @returns The filter that will return matching events for this event
     */
    filter(): NDKFilter;
    /**
     * Generates a deletion event of the current event
     *
     * @param reason The reason for the deletion
     * @param publish Whether to publish the deletion event automatically
     * @returns The deletion event
     */
    delete(reason?: string, publish?: boolean): Promise<NDKEvent>;
    /**
     * Fetch an event tagged with the given tag following relay hints if provided.
     * @param tag The tag to search for
     * @param marker The marker to use in the tag (e.g. "root")
     * @returns The fetched event or null if no event was found, undefined if no matching tag was found in the event
     * * @example
     * const replyEvent = await ndk.fetchEvent("nevent1qqs8x8vnycyha73grv380gmvlury4wtmx0nr9a5ds2dngqwgu87wn6gpzemhxue69uhhyetvv9ujuurjd9kkzmpwdejhgq3ql2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqz4cwjd")
     * const originalEvent = await replyEvent.fetchTaggedEvent("e", "reply");
     * console.log(replyEvent.encode() + " is a reply to event " + originalEvent?.encode());
     */
    fetchTaggedEvent: (tag: string, marker?: string | undefined) => Promise<NDKEvent | null | undefined>;
    /**
     * Fetch the root event of the current event.
     * @returns The fetched root event or null if no event was found
     * @example
     * const replyEvent = await ndk.fetchEvent("nevent1qqs8x8vnycyha73grv380gmvlury4wtmx0nr9a5ds2dngqwgu87wn6gpzemhxue69uhhyetvv9ujuurjd9kkzmpwdejhgq3ql2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqz4cwjd")
     * const rootEvent = await replyEvent.fetchRootEvent();
     * console.log(replyEvent.encode() + " is a reply in the thread " + rootEvent?.encode());
     */
    fetchRootEvent: (subOpts?: NDKSubscriptionOptions | undefined) => Promise<NDKEvent | null | undefined>;
    /**
     * Fetch the event the current event is replying to.
     * @returns The fetched reply event or null if no event was found
     */
    fetchReplyEvent: (subOpts?: NDKSubscriptionOptions | undefined) => Promise<NDKEvent | null | undefined>;
    /**
     * NIP-18 reposting event.
     *
     * @param publish Whether to publish the reposted event automatically @default true
     * @param signer The signer to use for signing the reposted event
     * @returns The reposted event
     *
     * @function
     */
    repost: (publish?: boolean | undefined, signer?: NDKSigner | undefined) => Promise<NDKEvent>;
    /**
     * React to an existing event
     *
     * @param content The content of the reaction
     */
    react(content: string, publish?: boolean): Promise<NDKEvent>;
    /**
     * Checks whether the event is valid per underlying NIPs.
     *
     * This method is meant to be overridden by subclasses that implement specific NIPs
     * to allow the enforcement of NIP-specific validation rules.
     *
     * Otherwise, it will only check for basic event properties.
     *
     */
    get isValid(): boolean;
    /**
     * Creates a reply event for the current event.
     *
     * This function will use NIP-22 when appropriate (i.e. replies to non-kind:1 events).
     * This function does not have side-effects; it will just return an event with the appropriate tags
     * to generate the reply event; the caller is responsible for publishing the event.
     */
    reply(): NDKEvent;
}

/**
 * Options on how to handle when a relay hint doesn't respond
 * with the requested event.
 *
 * When a tag includes a relay hint, and the relay hint doesn't come back
 * with the event, the fallback options are used to try to fetch the event
 * from somewhere else.
 */
type NDKFetchFallbackOptions = {
    /**
     * Relay set to use as a fallback when the hint relay doesn't respond.
     * If not provided, the normal NDK calculation is used (whether explicit relays or outbox calculation)
     * Default is `undefined`.
     */
    relaySet?: NDKRelaySet;
    /**
     * Type of fallback to use when the hint relay doesn't respond.
     * - "timeout" will wait for a timeout before falling back
     * - "eose" will wait for the EOSE before falling back
     * - "none" will not fall back
     * Default is "timeout".
     */
    type: "timeout" | "eose" | "none";
    /**
     * Timeout in milliseconds for the fallback relay.
     * Default is 1500ms.
     */
    timeout?: number;
};

type NDKCacheEntry<T> = T & {
    cachedAt?: number;
};
interface NDKCacheAdapter {
    /**
     * Whether this cache adapter is expected to be fast.
     * If this is true, the cache will be queried before the relays.
     * When this is false, the cache will be queried in addition to the relays.
     */
    locking: boolean;
    /**
     * Weather the cache is ready.
     */
    ready?: boolean;
    query(subscription: NDKSubscription): Promise<void>;
    setEvent(event: NDKEvent, filters: NDKFilter[], relay?: NDKRelay): Promise<void>;
    /**
     * Called when an event is deleted by the client.
     * Cache adapters should remove the event from their cache.
     * @param eventIds - The ids of the events that were deleted.
     */
    deleteEventIds?(eventIds: NDKEventId[]): Promise<void>;
    /**
     * Fetches a profile from the cache synchronously.
     * @param pubkey - The pubkey of the profile to fetch.
     * @returns The profile, or null if it is not in the cache.
     */
    fetchProfileSync?(pubkey: Hexpubkey): NDKCacheEntry<NDKUserProfile> | null;
    /**
     * Special purpose
     */
    fetchProfile?(pubkey: Hexpubkey): Promise<NDKCacheEntry<NDKUserProfile> | null>;
    saveProfile?(pubkey: Hexpubkey, profile: NDKUserProfile): void;
    /**
     * Fetches profiles that match the given filter.
     * @param filter
     * @returns NDKUserProfiles that match the filter.
     * @example
     * const searchFunc = (pubkey, profile) => profile.name.toLowerCase().includes("alice");
     * const allAliceProfiles = await cache.getProfiles(searchFunc);
     */
    getProfiles?: (filter: (pubkey: Hexpubkey, profile: NDKUserProfile) => boolean) => Promise<Map<Hexpubkey, NDKUserProfile> | undefined>;
    loadNip05?(nip05: string, maxAgeForMissing?: number): Promise<ProfilePointer | null | "missing">;
    saveNip05?(nip05: string, profile: ProfilePointer | null): void;
    /**
     * Fetches a user's LNURL data from the cache.
     * @param pubkey The pubkey of the user to fetch the LNURL data for.
     * @param maxAgeInSecs The maximum age of the data in seconds.
     * @param maxAgeForMissing The maximum age of the data in seconds if it is missing before it returns that it should be refetched.
     * @returns The LNURL data, null if it is not in the cache and under the maxAgeForMissing, or "missing" if it should be refetched.
     */
    loadUsersLNURLDoc?(pubkey: Hexpubkey, maxAgeInSecs?: number, maxAgeForMissing?: number): Promise<NDKLnUrlData | null | "missing">;
    saveUsersLNURLDoc?(pubkey: Hexpubkey, doc: NDKLnUrlData | null): void;
    /**
     * Updates information about the relay.
     */
    updateRelayStatus?(relayUrl: WebSocket["url"], info: NDKCacheRelayInfo): void;
    /**
     * Fetches information about the relay.
     */
    getRelayStatus?(relayUrl: WebSocket["url"]): NDKCacheRelayInfo | undefined;
    /**
     * Tracks a publishing event.
     * @param event
     * @param relayUrls List of relays that the event will be published to.
     */
    addUnpublishedEvent?(event: NDKEvent, relayUrls: WebSocket["url"][]): void;
    /**
     * Fetches all unpublished events.
     */
    getUnpublishedEvents?(): Promise<{
        event: NDKEvent;
        relays?: WebSocket["url"][];
        lastTryAt?: number;
    }[]>;
    /**
     * Removes an unpublished event.
     */
    discardUnpublishedEvent?(eventId: NDKEventId): void;
    /**
     * Called when the cache is ready.
     */
    onReady?(callback: () => void): void;
}
type NDKCacheRelayInfo = {
    lastConnectedAt?: number;
    dontConnectBefore?: number;
};

type OutboxItemType = "user" | "kind";
/**
 * Tracks outbox scoring of an item. An item can be any of:
 *
 *  -  A user
 *  -  A tag
 */
declare class OutboxItem {
    /**
     * Type of item
     */
    type: OutboxItemType;
    /**
     * The relay URLs that are of interest to this item
     */
    relayUrlScores: Map<WebSocket["url"], number>;
    readRelays: Set<WebSocket["url"]>;
    writeRelays: Set<WebSocket["url"]>;
    constructor(type: OutboxItemType);
}
/**
 * The responsibility of this class is to track relay:outbox-item associations
 * so that we can intelligently choose which relays to query for which items.
 *
 * A single instance of this class should be shared across all subscriptions within
 * an NDK instance.
 *
 * TODO: The state of this tracker needs to be added to cache adapters so that we
 * can rehydrate-it when a cache is present.
 */
declare class OutboxTracker extends EventEmitter {
    data: LRUCache<Hexpubkey, OutboxItem>;
    private ndk;
    private debug;
    constructor(ndk: NDK);
    /**
     * Adds a list of users to the tracker.
     * @param items
     * @param skipCache
     */
    trackUsers(items: NDKUser[] | Hexpubkey[], skipCache?: boolean): Promise<void[]>;
    /**
     *
     * @param key
     * @param score
     */
    track(item: NDKUser | Hexpubkey, type?: OutboxItemType, skipCache?: boolean): OutboxItem;
}

type PrepareUploadResult = {
    url: string;
    headers: {
        [key: string]: string;
    };
};
/**
 * Provides utility methods for interacting with NIP-96 upload services
 */
declare class Nip96 {
    private ndk;
    spec: Nip96Spec | undefined;
    private url;
    nip98Required: boolean;
    /**
     * @param domain domain of the NIP96 service
     */
    constructor(domain: string, ndk: NDK);
    prepareUpload(blob: Blob, httpVerb?: string): Promise<PrepareUploadResult>;
    /**
     * Provides an XMLHttpRequest-based upload method for browsers.
     * @example
     * const xhr = new XMLHttpRequest();
     * xhr.upload.addEventListener("progress", function(e) {
     *    const percentComplete = e.loaded / e.total;
     *    console.log(percentComplete);
     * });
     * const nip96 = ndk.getNip96("nostrcheck.me");
     * const blob = new Blob(["Hello, world!"], { type: "text/plain" });
     * const response = await nip96.xhrUpload(xhr, blob);
     * console.log(response);
     * @returns Promise that resolves to the upload response
     */
    xhrUpload(xhr: XMLHttpRequest, blob: Blob): Promise<Nip96UploadResponse>;
    /**
     * Fetch-based upload method. Note that this will use NDK's httpFetch
     * @param blob
     * @returns Promise that resolves to the upload response
     *
     * @example
     * const nip96 = ndk.getNip96("nostrcheck.me");
     * const blob = new Blob(["Hello, world!"], { type: "text/plain" });
     * const response = await nip96.upload(blob);
     * console.log(response);
     */
    upload(blob: Blob): Promise<Nip96UploadResponse>;
    private validateHttpFetch;
    fetchSpec(): Promise<void>;
    generateNip98Header(requestUrl: string, httpMethod: string, blob: Blob): Promise<string>;
    private calculateSha256;
}
type Nip96Spec = {
    api_url: string;
    download_url?: string;
    delegated_to_url?: string;
    supported_nips?: number[];
    tos_url?: string;
    content_types?: string[];
    plans: {
        [key: string]: {
            name: string;
            is_nip98_required: boolean;
            url?: string;
            max_byte_size?: number;
            file_expiration?: [number, number];
            media_transformations?: {
                image?: string[];
            };
        };
    };
};
type Nip96UploadResponse = {
    status: "success" | "error";
    message: string;
    processing_url?: string;
    nip94_event?: {
        tags: NDKTag[];
        content: string;
    };
};

type QueueItem<T> = {
    /**
     * Deterministic id of the item
     */
    id: string;
    /**
     * A function to process the item
     * @returns
     */
    func: () => Promise<T>;
};
declare class Queue<T> {
    private queue;
    private maxConcurrency;
    private processing;
    private promises;
    constructor(name: string, maxConcurrency: number);
    add(item: QueueItem<T>): Promise<T>;
    private process;
    clear(): void;
    clearProcessing(): void;
    clearAll(): void;
    length(): number;
}

type Proof = {
    /**
     * Keyset id, used to link proofs to a mint an its MintKeys.
     */
    id: string;
    /**
     * Amount denominated in Satoshis. Has to match the amount of the mints signing key.
     */
    amount: number;
    /**
     * The initial secret that was (randomly) chosen for the creation of this proof.
     */
    secret: string;
    /**
     * The unblinded signature for this secret, signed by the mints private key.
     */
    C: string;
};

/**
 * Represents a NIP-61 nutzap
 */
declare class NDKNutzap extends NDKEvent {
    private debug;
    private _proofs;
    static kind: NDKKind;
    static kinds: NDKKind[];
    constructor(ndk?: NDK, event?: NostrEvent | NDKEvent);
    static from(event: NDKEvent): NDKNutzap | undefined;
    set comment(comment: string | undefined);
    get comment(): string;
    set proofs(proofs: Proof[]);
    get proofs(): Proof[];
    /**
     * Gets the p2pk pubkey that is embedded in the first proof
     */
    get p2pk(): string | undefined;
    /**
     * Get the mint where this nutzap proofs exist
     */
    get mint(): string;
    set mint(value: string);
    get unit(): string;
    set unit(value: string | undefined);
    get amount(): number;
    sender: NDKUser;
    /**
     * Set the target of the nutzap
     * @param target The target of the nutzap (a user or an event)
     */
    set target(target: NDKEvent | NDKUser);
    set recipientPubkey(pubkey: Hexpubkey);
    get recipientPubkey(): Hexpubkey;
    get recipient(): NDKUser;
    /**
     * Validates that the nutzap conforms to NIP-61
     */
    get isValid(): boolean;
}

/**
 * Provides information that should be used to send a NIP-61 nutzap.
 * mints: URLs of the mints that can be used.
 * relays: URLs of the relays where nutzap must be published
 * p2pk: Optional pubkey to use for P2PK lock
 */
type CashuPaymentInfo = {
    /**
     * Mints that must be used for the payment
     */
    mints: string[];
    /**
     * Relays where nutzap must be published
     */
    relays: string[];
    /**
     * Optional pubkey to use for P2PK lock
     */
    p2pk?: string;
};
type NDKZapConfirmationCashu = NDKNutzap;
/**
 * This is what a wallet implementing Cashu payments should provide back
 * when a payment has been requested.
 */
type NDKPaymentConfirmationCashu = {
    /**
     * Proof of the payment
     */
    proofs: Proof[];
    /**
     * Mint
     */
    mint: string;
};

type NDKZapDetails<T> = T & {
    /**
     * Target of the zap
     */
    target: NDKEvent | NDKUser;
    /**
     * Comment for the zap
     */
    comment?: string;
    /**
     * Tags to add to the zap
     */
    tags?: NDKTag[];
    /**
     * Pubkey of the user to zap to
     */
    recipientPubkey: string;
    /**
     * Amount of the payment
     */
    amount: number;
    /**
     * Unit of the payment (e.g. msat)
     */
    unit: string;
    /**
     * Description of the payment for the sender's record
     */
    paymentDescription?: string;
};
type NDKZapConfirmation = NDKZapConfirmationLN | NDKZapConfirmationCashu;
type NDKPaymentConfirmation = NDKPaymentConfirmationLN | NDKNutzap;
type NDKZapSplit = {
    pubkey: string;
    amount: number;
};
type NDKZapMethod = "nip57" | "nip61";
type ZapMethodInfo = {
    nip57: NDKLnUrlData;
    nip61: CashuPaymentInfo;
};
type NDKZapMethodInfo = {
    type: NDKZapMethod;
    data: ZapMethodInfo[NDKZapMethod];
};
type LnPayCb = (payment: NDKZapDetails<LnPaymentInfo>) => Promise<NDKPaymentConfirmationLN | undefined>;
type CashuPayCb = (payment: NDKZapDetails<CashuPaymentInfo>) => Promise<NDKPaymentConfirmationCashu | undefined>;
type OnCompleteCb = (results: Map<NDKZapSplit, NDKPaymentConfirmation | Error | undefined>) => void;
interface NDKZapperOptions {
    /**
     * Comment to include in the zap event
     */
    comment?: string;
    /**
     * Extra tags to add to the zap event
     */
    tags?: NDKTag[];
    signer?: NDKSigner;
    lnPay?: LnPayCb;
    cashuPay?: CashuPayCb;
    onComplete?: OnCompleteCb;
    ndk?: NDK;
}
/**
 *
 */
declare class NDKZapper extends EventEmitter<{
    /**
     * Emitted when a zap split has been completed
     */
    "split:complete": (split: NDKZapSplit, info: NDKPaymentConfirmation | Error | undefined) => void;
    complete: (results: Map<NDKZapSplit, NDKPaymentConfirmation | Error | undefined>) => void;
}> {
    target: NDKEvent | NDKUser;
    ndk: NDK;
    comment?: string;
    amount: number;
    unit: string;
    tags?: NDKTag[];
    signer?: NDKSigner;
    zapMethod?: NDKZapMethod;
    lnPay?: LnPayCb;
    /**
     * Called when a cashu payment is to be made.
     * This function should swap/mint proofs for the required amount, in the required unit,
     * in any of the provided mints and return the proofs and mint used.
     */
    cashuPay?: CashuPayCb;
    onComplete?: OnCompleteCb;
    maxRelays: number;
    /**
     *
     * @param target The target of the zap
     * @param amount The amount to send indicated in the unit
     * @param unit The unit of the amount
     * @param opts Options for the zap
     */
    constructor(target: NDKEvent | NDKUser, amount: number, unit?: string, opts?: NDKZapperOptions);
    /**
     * Initiate zapping process
     *
     * This function will calculate the splits for this zap and initiate each zap split.
     */
    zap(): Promise<Map<NDKZapSplit, Error | NDKPaymentConfirmation | undefined>>;
    private zapNip57;
    /**
     * Fetches information about a NIP-61 zap and asks the caller to create cashu proofs for the zap.
     *
     * (note that the cashuPay function can use any method to create the proofs, including using lightning
     * to mint proofs in the specified mint, the responsibility of minting the proofs is delegated to the caller (e.g. ndk-wallet))
     */
    zapNip61(split: NDKZapSplit, data: CashuPaymentInfo): Promise<NDKNutzap | Error | undefined>;
    /**
     * Get the zap methods available for the recipient and initiates the zap
     * in the desired method.
     * @param split
     * @returns
     */
    zapSplit(split: NDKZapSplit): Promise<NDKPaymentConfirmation | undefined>;
    /**
     * Gets a bolt11 for a nip57 zap
     * @param event
     * @param amount
     * @param zapEndpoint
     * @returns
     */
    getLnInvoice(zapRequest: NDKEvent, amount: number, data: NDKLnUrlData): Promise<string | null>;
    getZapSplits(): NDKZapSplit[];
    /**
     * Gets the zap method that should be used to zap a pubbkey
     * @param ndk
     * @param pubkey
     * @returns
     */
    getZapMethods(ndk: NDK, recipient: Hexpubkey): Promise<NDKZapMethodInfo[]>;
    /**
     * @returns the relays to use for the zap request
     */
    relays(pubkey: Hexpubkey): Promise<string[]>;
}

type NDKValidationRatioFn = (relay: NDKRelay, validatedCount: number, nonValidatedCount: number) => number;
type NDKNetDebug = (msg: string, relay: NDKRelay, direction?: "send" | "recv") => void;
/**
 * An interface compatible with ndk-wallet that allows setting multiple handlers and callbacks.
 */
interface NDKWalletInterface {
    lnPay?: LnPayCb;
    cashuPay?: CashuPayCb;
    onPaymentComplete?: (results: Map<NDKZapSplit, NDKPaymentConfirmation | Error | undefined>) => void;
}
interface NDKConstructorParams {
    /**
     * Relays we should explicitly connect to
     */
    explicitRelayUrls?: string[];
    /**
     * Relays we should never connect to
     */
    blacklistRelayUrls?: string[];
    /**
     * When this is set, we always write only to this relays.
     */
    devWriteRelayUrls?: string[];
    /**
     * Outbox relay URLs.
     */
    outboxRelayUrls?: string[];
    /**
     * Enable outbox model (defaults to false)
     */
    enableOutboxModel?: boolean;
    /**
     * Auto-connect to main user's relays. The "main" user is determined
     * by the presence of a signer. Upon connection to the explicit relays,
     * the user's relays will be fetched and connected to if this is set to true.
     * @default true
     */
    autoConnectUserRelays?: boolean;
    /**
     * Automatically fetch user's mutelist
     * @default true
     */
    autoFetchUserMutelist?: boolean;
    /**
     * Signer to use for signing events by default
     */
    signer?: NDKSigner;
    /**
     * Cache adapter to use for caching events
     */
    cacheAdapter?: NDKCacheAdapter;
    /**
     * Debug instance to use
     */
    debug?: debug$1.Debugger;
    /**
     * Provide a caller function to receive all networking traffic from relays
     */
    netDebug?: NDKNetDebug;
    /**
     * Muted pubkeys and eventIds
     */
    mutedIds?: Map<Hexpubkey | NDKEventId, string>;
    /**
     * Client name to add to events' tag
     */
    clientName?: string;
    /**
     * Client nip89 to add to events' tag
     */
    clientNip89?: string;
    /**
     * Default relay-auth policy
     */
    relayAuthDefaultPolicy?: NDKAuthPolicy;
    /**
     * Whether to verify signatures on events synchronously or asynchronously.
     *
     * @default undefined
     *
     * When set to true, the signature verification will processed in a web worker.
     * You should listen for the `event:invalid-sig` event to handle invalid signatures.
     *
     * @example
     * ```typescript
     * const worker = new Worker("path/to/signature-verification.js");
     * ndk.delayedSigVerification = worker;
     * ndk.on("event:invalid-sig", (event) => {
     *    console.error("Invalid signature", event);
     * });
     */
    signatureVerificationWorker?: Worker | undefined;
    /**
     * The signature verification validation ratio for new relays.
     */
    initialValidationRatio?: number;
    /**
     * The lowest validation ratio any single relay can have.
     * Relays will have a sample of events verified based on this ratio.
     * When using this, you MUST listen for event:invalid-sig events
     * to handle invalid signatures and disconnect from evil relays.
     *
     * @default 0.1
     */
    lowestValidationRatio?: number;
    /**
     * A function that is invoked to calculate the validation ratio for a relay.
     */
    validationRatioFn?: NDKValidationRatioFn;
}
interface GetUserParams extends NDKUserParams {
    npub?: string;
    pubkey?: string;
    /**
     * @deprecated Use `pubkey` instead
     */
    hexpubkey?: string;
}
/**
 * The NDK class is the main entry point to the library.
 *
 * @emits signer:ready when a signer is ready
 * @emits invalid-signature when an event with an invalid signature is received
 */
declare class NDK extends EventEmitter<{
    event: (event: NDKEvent, relay: NDKRelay) => void;
    "signer:ready": (signer: NDKSigner) => void;
    "signer:required": () => void;
    /**
     * Emitted when an event with an invalid signature is received and the signature
     * was processed asynchronously.
     */
    "event:invalid-sig": (event: NDKEvent) => void;
    /**
     * Emitted when an event fails to publish.
     * @param event The event that failed to publish
     * @param error The error that caused the event to fail to publish
     * @param relays The relays that the event was attempted to be published to
     */
    "event:publish-failed": (event: NDKEvent, error: NDKPublishError, relays: WebSocket["url"][]) => void;
}> {
    private _explicitRelayUrls?;
    pool: NDKPool;
    outboxPool?: NDKPool;
    private _signer?;
    private _activeUser?;
    cacheAdapter?: NDKCacheAdapter;
    debug: debug$1.Debugger;
    devWriteRelaySet?: NDKRelaySet;
    outboxTracker?: OutboxTracker;
    mutedIds: Map<Hexpubkey | NDKEventId, string>;
    clientName?: string;
    clientNip89?: string;
    queuesZapConfig: Queue<NDKLnUrlData | undefined>;
    queuesNip05: Queue<ProfilePointer | null>;
    asyncSigVerification: boolean;
    initialValidationRatio: number;
    lowestValidationRatio: number;
    validationRatioFn?: NDKValidationRatioFn;
    subManager: NDKSubscriptionManager;
    publishingFailureHandled: boolean;
    /**
     * Default relay-auth policy that will be used when a relay requests authentication,
     * if no other policy is specified for that relay.
     *
     * @example Disconnect from relays that request authentication:
     * ```typescript
     * ndk.relayAuthDefaultPolicy = NDKAuthPolicies.disconnect(ndk.pool);
     * ```
     *
     * @example Sign in to relays that request authentication:
     * ```typescript
     * ndk.relayAuthDefaultPolicy = NDKAuthPolicies.signIn({ndk})
     * ```
     *
     * @example Sign in to relays that request authentication, asking the user for confirmation:
     * ```typescript
     * ndk.relayAuthDefaultPolicy = (relay: NDKRelay) => {
     *     const signIn = NDKAuthPolicies.signIn({ndk});
     *     if (confirm(`Relay ${relay.url} is requesting authentication, do you want to sign in?`)) {
     *        signIn(relay);
     *     }
     * }
     * ```
     */
    relayAuthDefaultPolicy?: NDKAuthPolicy;
    /**
     * Fetch function to use for HTTP requests.
     *
     * @example
     * ```typescript
     * import fetch from "node-fetch";
     *
     * ndk.httpFetch = fetch;
     * ```
     */
    httpFetch: typeof fetch | undefined;
    /**
     * Provide a caller function to receive all networking traffic from relays
     */
    readonly netDebug?: NDKNetDebug;
    autoConnectUserRelays: boolean;
    autoFetchUserMutelist: boolean;
    walletConfig?: NDKWalletInterface;
    constructor(opts?: NDKConstructorParams);
    set explicitRelayUrls(urls: WebSocket["url"][]);
    get explicitRelayUrls(): WebSocket["url"][];
    set signatureVerificationWorker(worker: Worker | undefined);
    /**
     * Adds an explicit relay to the pool.
     * @param url
     * @param relayAuthPolicy Authentication policy to use if different from the default
     * @param connect Whether to connect to the relay automatically
     * @returns
     */
    addExplicitRelay(urlOrRelay: string | NDKRelay, relayAuthPolicy?: NDKAuthPolicy, connect?: boolean): NDKRelay;
    toJSON(): string;
    get activeUser(): NDKUser | undefined;
    /**
     * Sets the active user for this NDK instance, typically this will be
     * called when assigning a signer to the NDK instance.
     *
     * This function will automatically connect to the user's relays if
     * `autoConnectUserRelays` is set to true.
     *
     * It will also fetch the user's mutelist if `autoFetchUserMutelist` is set to true.
     */
    set activeUser(user: NDKUser | undefined);
    get signer(): NDKSigner | undefined;
    set signer(newSigner: NDKSigner | undefined);
    /**
     * Connect to relays with optional timeout.
     * If the timeout is reached, the connection will be continued to be established in the background.
     */
    connect(timeoutMs?: number): Promise<void>;
    /**
     * Get a NDKUser object
     *
     * @param opts
     * @returns
     */
    getUser(opts: GetUserParams): NDKUser;
    /**
     * Get a NDKUser from a NIP05
     * @param nip05 NIP-05 ID
     * @param skipCache Skip cache
     * @returns
     */
    getUserFromNip05(nip05: string, skipCache?: boolean): Promise<NDKUser | undefined>;
    /**
     * Create a new subscription. Subscriptions automatically start, you can make them automatically close when all relays send back an EOSE by setting `opts.closeOnEose` to `true`)
     *
     * @param filters
     * @param opts
     * @param relaySet explicit relay set to use
     * @param autoStart automatically start the subscription
     * @returns NDKSubscription
     */
    subscribe(filters: NDKFilter | NDKFilter[], opts?: NDKSubscriptionOptions, relaySet?: NDKRelaySet, autoStart?: boolean): NDKSubscription;
    /**
     * Publish an event to a relay
     * @param event event to publish
     * @param relaySet explicit relay set to use
     * @param timeoutMs timeout in milliseconds to wait for the event to be published
     * @returns The relays the event was published to
     *
     * @deprecated Use `event.publish()` instead
     */
    publish(event: NDKEvent, relaySet?: NDKRelaySet, timeoutMs?: number): Promise<Set<NDKRelay>>;
    /**
     * Attempts to fetch an event from a tag, following relay hints and
     * other best practices.
     * @param tag Tag to fetch the event from
     * @param originalEvent Event where the tag came from
     * @param subOpts Subscription options to use when fetching the event
     * @param fallback Fallback options to use when the hint relay doesn't respond
     * @returns
     */
    fetchEventFromTag: (tag: NDKTag, originalEvent: NDKEvent, subOpts?: NDKSubscriptionOptions | undefined, fallback?: NDKFetchFallbackOptions | undefined) => Promise<NDKEvent | null>;
    /**
     * Fetch a single event.
     *
     * @param idOrFilter event id in bech32 format or filter
     * @param opts subscription options
     * @param relaySetOrRelay explicit relay set to use
     */
    fetchEvent(idOrFilter: string | NDKFilter | NDKFilter[], opts?: NDKSubscriptionOptions, relaySetOrRelay?: NDKRelaySet | NDKRelay): Promise<NDKEvent | null>;
    /**
     * Fetch events
     */
    fetchEvents(filters: NDKFilter | NDKFilter[], opts?: NDKSubscriptionOptions, relaySet?: NDKRelaySet): Promise<Set<NDKEvent>>;
    /**
     * Ensures that a signer is available to sign an event.
     */
    assertSigner(): void;
    /**
     * Creates a new Nip96 instance for the given domain.
     * @param domain Domain to use for nip96 uploads
     * @example Upload a file to a NIP-96 enabled domain:
     *
     * ```typescript
     * const blob = new Blob(["Hello, world!"], { type: "text/plain" });
     * const nip96 = ndk.getNip96("nostrcheck.me");
     * await nip96.upload(blob);
     * ```
     */
    getNip96(domain: string): Nip96;
    set wallet(wallet: NDKWalletInterface | undefined);
}

type NDKPoolStats = {
    total: number;
    connected: number;
    disconnected: number;
    connecting: number;
};
/**
 * Handles connections to all relays. A single pool should be used per NDK instance.
 *
 * @emit connecting - Emitted when a relay in the pool is connecting.
 * @emit connect - Emitted when all relays in the pool are connected, or when the specified timeout has elapsed, and some relays are connected.
 * @emit notice - Emitted when a relay in the pool sends a notice.
 * @emit flapping - Emitted when a relay in the pool is flapping.
 * @emit relay:connect - Emitted when a relay in the pool connects.
 * @emit relay:ready - Emitted when a relay in the pool is ready to serve requests.
 * @emit relay:disconnect - Emitted when a relay in the pool disconnects.
 */
declare class NDKPool extends EventEmitter<{
    notice: (relay: NDKRelay, notice: string) => void;
    flapping: (relay: NDKRelay) => void;
    connect: () => void;
    "relay:connecting": (relay: NDKRelay) => void;
    /**
     * Emitted when a relay in the pool connects.
     * @param relay - The relay that connected.
     */
    "relay:connect": (relay: NDKRelay) => void;
    "relay:ready": (relay: NDKRelay) => void;
    "relay:disconnect": (relay: NDKRelay) => void;
    "relay:auth": (relay: NDKRelay, challenge: string) => void;
    "relay:authed": (relay: NDKRelay) => void;
}> {
    private _relays;
    autoConnectRelays: Set<string>;
    blacklistRelayUrls: Set<WebSocket["url"]>;
    private debug;
    private temporaryRelayTimers;
    private flappingRelays;
    private backoffTimes;
    private ndk;
    constructor(relayUrls: WebSocket["url"][] | undefined, blacklistedRelayUrls: WebSocket["url"][] | undefined, ndk: NDK, debug?: debug$1.Debugger);
    get relays(): Map<string, NDKRelay>;
    set relayUrls(urls: WebSocket["url"][]);
    set name(name: string);
    /**
     * Adds a relay to the pool, and sets a timer to remove it if it is not used within the specified time.
     * @param relay - The relay to add to the pool.
     * @param removeIfUnusedAfter - The time in milliseconds to wait before removing the relay from the pool after it is no longer used.
     */
    useTemporaryRelay(relay: NDKRelay, removeIfUnusedAfter?: number, filters?: NDKFilter[] | string): void;
    /**
     * Adds a relay to the pool.
     *
     * @param relay - The relay to add to the pool.
     * @param connect - Whether or not to connect to the relay.
     */
    addRelay(relay: NDKRelay, connect?: boolean): void;
    /**
     * Removes a relay from the pool.
     * @param relayUrl - The URL of the relay to remove.
     * @returns {boolean} True if the relay was removed, false if it was not found.
     */
    removeRelay(relayUrl: string): boolean;
    /**
     * Checks whether a relay is already connected in the pool.
     */
    isRelayConnected(url: WebSocket["url"]): boolean;
    /**
     * Fetches a relay from the pool, or creates a new one if it does not exist.
     *
     * New relays will be attempted to be connected.
     */
    getRelay(url: WebSocket["url"], connect?: boolean, temporary?: boolean, filters?: NDKFilter[]): NDKRelay;
    private handleRelayConnect;
    private handleRelayReady;
    /**
     * Attempts to establish a connection to each relay in the pool.
     *
     * @async
     * @param {number} [timeoutMs] - Optional timeout in milliseconds for each connection attempt.
     * @returns {Promise<void>} A promise that resolves when all connection attempts have completed.
     * @throws {Error} If any of the connection attempts result in an error or timeout.
     */
    connect(timeoutMs?: number): Promise<void>;
    private checkOnFlappingRelays;
    private handleFlapping;
    size(): number;
    /**
     * Returns the status of each relay in the pool.
     * @returns {NDKPoolStats} An object containing the number of relays in each status.
     */
    stats(): NDKPoolStats;
    connectedRelays(): NDKRelay[];
    permanentAndConnectedRelays(): NDKRelay[];
    /**
     * Get a list of all relay urls in the pool.
     */
    urls(): string[];
}

/**
 * Pins an event
 */
declare function pinEvent(user: NDKUser, event: NDKEvent, pinEvent?: NDKEvent, publish?: boolean): Promise<NDKEvent>;

/**
 * Represents a NIP-23 article.
 *
 * @group Kind Wrapper
 */
declare class NDKArticle extends NDKEvent {
    static kind: NDKKind;
    static kinds: NDKKind[];
    constructor(ndk: NDK | undefined, rawEvent?: NostrEvent | NDKEvent);
    /**
     * Creates a NDKArticle from an existing NDKEvent.
     *
     * @param event NDKEvent to create the NDKArticle from.
     * @returns NDKArticle
     */
    static from(event: NDKEvent): NDKArticle;
    /**
     * Getter for the article title.
     *
     * @returns {string | undefined} - The article title if available, otherwise undefined.
     */
    get title(): string | undefined;
    /**
     * Setter for the article title.
     *
     * @param {string | undefined} title - The title to set for the article.
     */
    set title(title: string | undefined);
    /**
     * Getter for the article image.
     *
     * @returns {string | undefined} - The article image if available, otherwise undefined.
     */
    get image(): string | undefined;
    /**
     * Setter for the article image.
     *
     * @param {string | undefined} image - The image to set for the article.
     */
    set image(image: string | undefined);
    get summary(): string | undefined;
    set summary(summary: string | undefined);
    /**
     * Getter for the article's publication timestamp.
     *
     * @returns {number | undefined} - The Unix timestamp of when the article was published or undefined.
     */
    get published_at(): number | undefined;
    /**
     * Setter for the article's publication timestamp.
     *
     * @param {number | undefined} timestamp - The Unix timestamp to set for the article's publication date.
     */
    set published_at(timestamp: number | undefined);
    /**
     * Generates content tags for the article.
     *
     * This method first checks and sets the publication date if not available,
     * and then generates content tags based on the base NDKEvent class.
     *
     * @returns {ContentTag} - The generated content tags.
     */
    generateTags(): Promise<ContentTag>;
    /**
     * Getter for the article's URL.
     *
     * @returns {string | undefined} - The article's URL if available, otherwise undefined.
     */
    get url(): string | undefined;
    /**
     * Setter for the article's URL.
     *
     * @param {string | undefined} url - The URL to set for the article.
     */
    set url(url: string | undefined);
}

interface NDKClassifiedPriceTag {
    amount: number;
    currency?: string;
    frequency?: string;
}
/**
 * Represents a NIP-99 Classified Listing.
 *
 * @group Kind Wrapper
 */
declare class NDKClassified extends NDKEvent {
    constructor(ndk: NDK | undefined, rawEvent?: NostrEvent | NDKEvent);
    /**
     * Creates a NDKClassified from an existing NDKEvent.
     *
     * @param event NDKEvent to create the NDKClassified from.
     * @returns NDKClassified
     */
    static from(event: NDKEvent): NDKClassified;
    /**
     * Getter for the classified title.
     *
     * @returns {string | undefined} - The classified title if available, otherwise undefined.
     */
    get title(): string | undefined;
    /**
     * Setter for the classified title.
     *
     * @param {string | undefined} title - The title to set for the classified.
     */
    set title(title: string | undefined);
    /**
     * Getter for the classified summary.
     *
     * @returns {string | undefined} - The classified summary if available, otherwise undefined.
     */
    get summary(): string | undefined;
    /**
     * Setter for the classified summary.
     *
     * @param {string | undefined} summary - The summary to set for the classified.
     */
    set summary(summary: string | undefined);
    /**
     * Getter for the classified's publication timestamp.
     *
     * @returns {number | undefined} - The Unix timestamp of when the classified was published or undefined.
     */
    get published_at(): number | undefined;
    /**
     * Setter for the classified's publication timestamp.
     *
     * @param {number | undefined} timestamp - The Unix timestamp to set for the classified's publication date.
     */
    set published_at(timestamp: number | undefined);
    /**
     * Getter for the classified location.
     *
     * @returns {string | undefined} - The classified location if available, otherwise undefined.
     */
    get location(): string | undefined;
    /**
     * Setter for the classified location.
     *
     * @param {string | undefined} location - The location to set for the classified.
     */
    set location(location: string | undefined);
    /**
     * Getter for the classified price.
     *
     * @returns {NDKClassifiedPriceTag | undefined} - The classified price if available, otherwise undefined.
     */
    get price(): NDKClassifiedPriceTag | undefined;
    /**
     * Setter for the classified price.
     *
     * @param price - The price to set for the classified.
     */
    set price(priceTag: NDKClassifiedPriceTag | string | undefined);
    /**
     * Generates content tags for the classified.
     *
     * This method first checks and sets the publication date if not available,
     * and then generates content tags based on the base NDKEvent class.
     *
     * @returns {ContentTag} - The generated content tags.
     */
    generateTags(): Promise<ContentTag>;
}

/**
 * NIP-37 drafts.
 * @group Kind Wrapper
 *
 * @example
 * const myArticle = new NDKArticle();
 * myArticle.content = "This is my artic"
 *
 * const draft = new NDKDraft();
 * draft.event = myArticle;
 * draft.publish();
 */
declare class NDKDraft extends NDKEvent {
    _event: NostrEvent | undefined;
    constructor(ndk: NDK | undefined, rawEvent?: NostrEvent | NDKEvent);
    static from(event: NDKEvent): NDKDraft;
    /**
     * Sets an identifier (i.e. d-tag)
     */
    set identifier(id: string);
    get identifier(): string | undefined;
    /**
     * Event that is to be saved.
     */
    set event(e: NDKEvent | NostrEvent);
    /**
     * Gets the event.
     * @param param0
     * @returns NDKEvent of the draft event or null if the draft event has been deleted (emptied).
     */
    getEvent(signer?: NDKSigner): Promise<NDKEvent | null | undefined>;
    private prepareEvent;
    /**
     * Generates draft event.
     *
     * @param signer: Optional signer to encrypt with
     * @param publish: Whether to publish, optionally specifying relaySet to publish to
     */
    save({ signer, publish, relaySet, }: {
        signer?: NDKSigner;
        publish?: boolean;
        relaySet?: NDKRelaySet;
    }): Promise<Set<NDKRelay> | undefined>;
}

declare enum NDKDvmJobFeedbackStatus {
    Processing = "processing",
    Success = "success",
    Scheduled = "scheduled",
    PayReq = "payment_required"
}
declare class NDKDVMJobFeedback extends NDKEvent {
    constructor(ndk?: NDK, event?: NostrEvent);
    static from(event: NDKEvent): Promise<NDKDVMJobFeedback>;
    get status(): NDKDvmJobFeedbackStatus | string | undefined;
    set status(status: NDKDvmJobFeedbackStatus | string | undefined);
    get encrypted(): boolean;
    dvmDecrypt(): Promise<void>;
}

/**
 * NIP-90: Data vending machine request
 *
 * A generic Job request class for Data Vending Machines
 *
 * @example
 * const request = new NDKDVMRequest(ndk);
 * request.kind = NDKKind.DVMReqTextExtraction;
 * request.addInput(["https://allenfarrington.medium.com/modeling-bitcoin-value-with-vibes-99eca0997c5f", "url"])
 * await request.publish()
 */
declare class NDKDVMRequest extends NDKEvent {
    constructor(ndk: NDK | undefined, event?: NostrEvent);
    static from(event: NDKEvent): NDKDVMRequest;
    set bid(msatAmount: number | undefined);
    get bid(): number | undefined;
    /**
     * Adds a new input to the job
     * @param args The arguments to the input
     */
    addInput(...args: string[]): void;
    /**
     * Adds a new parameter to the job
     */
    addParam(...args: string[]): void;
    set output(output: string | string[] | undefined);
    get output(): string[] | undefined;
    get params(): string[][];
    getParam(name: string): string | undefined;
    createFeedback(status: NDKDvmJobFeedbackStatus | string): NDKDVMJobFeedback;
    /**
     * Enables job encryption for this event
     * @param dvm DVM that will receive the event
     * @param signer Signer to use for encryption
     */
    encryption(dvm: NDKUser, signer?: NDKSigner): Promise<void>;
    /**
     * Sets the DVM that will receive the event
     */
    set dvm(dvm: NDKUser | undefined);
}

/**
 * NIP-90
 *
 * This class creates DVM transcription job types
 */
declare class NDKTranscriptionDVM extends NDKDVMRequest {
    constructor(ndk: NDK | undefined, event?: NostrEvent);
    static from(event: NDKEvent): NDKTranscriptionDVM;
    /**
     * Returns the original source of the transcription
     */
    get url(): string | undefined;
    /**
     * Getter for the title tag
     */
    get title(): string | undefined;
    /**
     * Setter for the title tag
     */
    set title(value: string | undefined);
    /**
     * Getter for the image tag
     */
    get image(): string | undefined;
    /**
     * Setter for the image tag
     */
    set image(value: string | undefined);
}

/**
 * This event is published by Data Vending Machines when
 * they have finished processing a job.
 */
declare class NDKDVMJobResult extends NDKEvent {
    constructor(ndk?: NDK, event?: NostrEvent);
    static from(event: NDKEvent): NDKDVMJobResult;
    setAmount(msat: number, invoice?: string): void;
    set result(result: string | undefined);
    get result(): string | undefined;
    set status(status: string | undefined);
    get status(): string | undefined;
    get jobRequestId(): string | undefined;
    set jobRequest(event: NDKEvent | undefined);
    get jobRequest(): NDKEvent | undefined;
}

type NDKDvmParam = [string, string, ...string[]];

/**
 * Highlight as defined by NIP-84 (kind:9802).
 * @group Kind Wrapper
 */
declare class NDKHighlight extends NDKEvent {
    private _article;
    static kind: NDKKind;
    static kinds: NDKKind[];
    constructor(ndk?: NDK, rawEvent?: NostrEvent | NDKEvent);
    static from(event: NDKEvent): NDKHighlight;
    get url(): string | undefined;
    /**
     * Context tag.
     */
    set context(context: string | undefined);
    get context(): string | undefined;
    /**
     * Will return the article URL or NDKEvent if they have already been
     * set (it won't attempt to load remote events)
     */
    get article(): NDKEvent | string | undefined;
    /**
     * Article the highlight is coming from.
     *
     * @param article Article URL or NDKEvent.
     */
    set article(article: NDKEvent | string);
    getArticleTag(): NDKTag | undefined;
    getArticle(): Promise<NDKArticle | NDKEvent | string | undefined>;
}

interface NDKImetaTag {
    url?: string;
    blurhash?: string;
    dim?: string;
    alt?: string;
    m?: string;
    x?: string;
    fallback?: string[];
    [key: string]: string | string[] | undefined;
}
/**
 * Maps an imeta NDKTag to an NDKImetaTag
 */
declare function mapImetaTag(tag: NDKTag): NDKImetaTag;
/**
 * Converts an NDKImetaTag to an NDKTag
 */
declare function imetaTagToTag(imeta: NDKImetaTag): NDKTag;

/**
 * Represents an image.
 * @kind 20
 * @group Kind Wrapper
 */
declare class NDKImage extends NDKEvent {
    static kind: NDKKind;
    static kinds: NDKKind[];
    private _imetas;
    constructor(ndk: NDK | undefined, rawEvent?: NostrEvent);
    /**
     * Creates a NDKImage from an existing NDKEvent.
     *
     * @param event NDKEvent to create the NDKImage from.
     * @returns NDKImage
     */
    static from(event: NDKEvent): NDKImage;
    get isValid(): boolean;
    get imetas(): NDKImetaTag[];
    set imetas(tags: NDKImetaTag[]);
}

type NDKListItem = NDKRelay | NDKUser | NDKEvent;
/**
 * Represents any NIP-51 list kind.
 *
 * This class provides some helper methods to manage the list, particularly
 * a CRUD interface to list items.
 *
 * List items can be encrypted or not. Encrypted items are JSON-encoded and
 * self-signed by the user's key.
 *
 * @example Adding an event to the list.
 * const event1 = new NDKEvent(...);
 * const list = new NDKList();
 * list.addItem(event1);
 *
 * @example Adding an encrypted `p` tag to the list with a "person" mark.
 * const secretFollow = new NDKUser(...);
 * list.addItem(secretFollow, 'person', true);
 *
 * @emits change
 * @group Kind Wrapper
 */
declare class NDKList extends NDKEvent {
    _encryptedTags: NDKTag[] | undefined;
    /**
     * Stores the number of bytes the content was before decryption
     * to expire the cache when the content changes.
     */
    private encryptedTagsLength;
    constructor(ndk?: NDK, rawEvent?: NostrEvent | NDKEvent);
    /**
     * Wrap a NDKEvent into a NDKList
     */
    static from(ndkEvent: NDKEvent): NDKList;
    /**
     * Returns the title of the list. Falls back on fetching the name tag value.
     */
    get title(): string | undefined;
    /**
     * Sets the title of the list.
     */
    set title(title: string | undefined);
    /**
     * Returns the name of the list.
     * @deprecated Please use "title" instead.
     */
    get name(): string | undefined;
    /**
     * Sets the name of the list.
     * @deprecated Please use "title" instead. This method will use the `title` tag instead.
     */
    set name(name: string | undefined);
    /**
     * Returns the description of the list.
     */
    get description(): string | undefined;
    /**
     * Sets the description of the list.
     */
    set description(name: string | undefined);
    /**
     * Returns the image of the list.
     */
    get image(): string | undefined;
    /**
     * Sets the image of the list.
     */
    set image(name: string | undefined);
    private isEncryptedTagsCacheValid;
    /**
     * Returns the decrypted content of the list.
     */
    encryptedTags(useCache?: boolean): Promise<NDKTag[]>;
    /**
     * This method can be overriden to validate that a tag is valid for this list.
     *
     * (i.e. the NDKPersonList can validate that items are NDKUser instances)
     */
    validateTag(tagValue: string): boolean | string;
    getItems(type: string): NDKTag[];
    /**
     * Returns the unecrypted items in this list.
     */
    get items(): NDKTag[];
    /**
     * Adds a new item to the list.
     * @param relay Relay to add
     * @param mark Optional mark to add to the item
     * @param encrypted Whether to encrypt the item
     * @param position Where to add the item in the list (top or bottom)
     */
    addItem(item: NDKListItem | NDKTag, mark?: string | undefined, encrypted?: boolean, position?: "top" | "bottom"): Promise<void>;
    /**
     * Removes an item from the list from both the encrypted and unencrypted lists.
     * @param value value of item to remove from the list
     * @param publish whether to publish the change
     * @returns
     */
    removeItemByValue(value: string, publish?: boolean): Promise<Set<NDKRelay> | void>;
    /**
     * Removes an item from the list.
     *
     * @param index The index of the item to remove.
     * @param encrypted Whether to remove from the encrypted list or not.
     */
    removeItem(index: number, encrypted: boolean): Promise<NDKList>;
    has(item: string): boolean;
    /**
     * Creates a filter that will result in fetching
     * the items of this list
     * @example
     * const list = new NDKList(...);
     * const filters = list.filterForItems();
     * const events = await ndk.fetchEvents(filters);
     */
    filterForItems(): NDKFilter[];
}

/**
 * Represents a relay list for a user, ideally coming from a NIP-65 kind:10002 or alternatively from a kind:3 event's content.
 * @group Kind Wrapper
 */
declare class NDKRelayList extends NDKEvent {
    constructor(ndk?: NDK, rawEvent?: NostrEvent);
    static from(ndkEvent: NDKEvent): NDKRelayList;
    get readRelayUrls(): WebSocket["url"][];
    set readRelayUrls(relays: WebSocket["url"][]);
    get writeRelayUrls(): WebSocket["url"][];
    set writeRelayUrls(relays: WebSocket["url"][]);
    get bothRelayUrls(): WebSocket["url"][];
    set bothRelayUrls(relays: WebSocket["url"][]);
    get relays(): WebSocket["url"][];
    /**
     * Provides a relaySet for the relays in this list.
     */
    get relaySet(): NDKRelaySet;
}
declare function relayListFromKind3(ndk: NDK, contactList: NDKEvent): NDKRelayList | undefined;

/**
 * This is a NIP-89 app handler wrapper.
 *
 * @summary NIP-89 App Handler
 * @group Kind Wrapper
 * @implements kind:31990
 */
declare class NDKAppHandlerEvent extends NDKEvent {
    private profile;
    constructor(ndk?: NDK, rawEvent?: NostrEvent);
    static from(ndkEvent: NDKEvent): NDKAppHandlerEvent;
    /**
     * Fetches app handler information
     * If no app information is available on the kind:31990,
     * we fetch the event's author's profile and return that instead.
     */
    fetchProfile(): Promise<NDKUserProfile | undefined>;
}

declare class NDKCashuMintList extends NDKEvent {
    static kind: NDKKind;
    static kinds: NDKKind[];
    private _p2pk?;
    constructor(ndk?: NDK, event?: NostrEvent | NDKEvent);
    static from(event: NDKEvent): NDKCashuMintList;
    set relays(urls: WebSocket["url"][]);
    get relays(): WebSocket["url"][];
    set mints(urls: WebSocket["url"][]);
    get mints(): WebSocket["url"][];
    get p2pk(): string;
    set p2pk(pubkey: string | undefined);
    get relaySet(): NDKRelaySet | undefined;
}

type classWithConvertFunction<T> = {
    from: (event: NDKEvent) => T;
};
/**
 * Handles NIP-18 reposts.
 * @group Kind Wrapper
 */
declare class NDKRepost<T> extends NDKEvent {
    private _repostedEvents;
    constructor(ndk?: NDK, rawEvent?: NostrEvent);
    static from(event: NDKEvent): NDKRepost<unknown>;
    /**
     * Returns all reposted events by the current event.
     *
     * @param klass Optional class to convert the events to.
     * @returns
     */
    repostedEvents(klass?: classWithConvertFunction<T>, opts?: NDKSubscriptionOptions): Promise<T[]>;
    /**
     * Returns the reposted event IDs.
     */
    repostedEventIds(): string[];
}

type NDKIntervalFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
declare const possibleIntervalFrequencies: NDKIntervalFrequency[];
type NDKSubscriptionAmount = {
    amount: number;
    currency: string;
    term: NDKIntervalFrequency;
};
declare function calculateTermDurationInSeconds(term: NDKIntervalFrequency): number;
/**
 * Creates a new amount tag
 * @param amount Amount in base unit of the currency (e.g. cents, msats)
 * @param currency Currency code. Use msat for millisatoshis
 * @param term One of daily, weekly, monthly, quarterly, yearly
 * @returns
 */
declare function newAmount(amount: number, currency: string, term: NDKIntervalFrequency): NDKTag;
declare function parseTagToSubscriptionAmount(tag: NDKTag): NDKSubscriptionAmount | undefined;

/**
 * @description
 * Implements NIP-88 (TBD)'s subscription tiers
 *
 * This class will validate that incoming events are valid subscription tiers. Incomplete or invalid
 * amounts will be ignored.
 *
 * @example
 * const tier = new NDKSubscriptionTier;
 * tier.title = "Tier 1";
 * tier.addAmount(100000, "msat", "monthly"); // 100 sats per month
 * tier.addAmount(499, "usd", "monthly"); // $4.99 per month
 * tier.relayUrl = "wss://relay.highlighter.com/";
 * tier.relayUrl = "wss://relay.creator.com/";
 * tier.verifierPubkey = "<pubkey>";
 * tier.addPerk("Access to my private content");
 */
declare class NDKSubscriptionTier extends NDKArticle {
    static kind: NDKKind;
    static kinds: NDKKind[];
    constructor(ndk: NDK | undefined, rawEvent?: NostrEvent | NDKEvent);
    /**
     * Creates a new NDKSubscriptionTier from an event
     * @param event
     * @returns NDKSubscriptionTier
     */
    static from(event: NDKEvent): NDKSubscriptionTier;
    /**
     * Returns perks for this tier
     */
    get perks(): string[];
    /**
     * Adds a perk to this tier
     */
    addPerk(perk: string): void;
    /**
     * Returns the amount for this tier
     */
    get amounts(): NDKSubscriptionAmount[];
    /**
     * Adds an amount to this tier
     * @param amount Amount in the smallest unit of the currency (e.g. cents, msats)
     * @param currency Currency code. Use msat for millisatoshis
     * @param term One of daily, weekly, monthly, quarterly, yearly
     */
    addAmount(amount: number, currency: string, term: NDKIntervalFrequency): void;
    /**
     * Sets a relay where content related to this tier can be found
     * @param relayUrl URL of the relay
     */
    set relayUrl(relayUrl: string);
    /**
     * Returns the relay URLs for this tier
     */
    get relayUrls(): string[];
    /**
     * Gets the verifier pubkey for this tier. This is the pubkey that will generate
     * subscription payment receipts
     */
    get verifierPubkey(): string | undefined;
    /**
     * Sets the verifier pubkey for this tier.
     */
    set verifierPubkey(pubkey: string | undefined);
    /**
     * Checks if this tier is valid
     */
    get isValid(): boolean;
}

/**
 * Represents a subscription start event.
 * @example
 * const creator = new NDKUser;
 * const subscriber = new NDKUser;
 *
 * const subscriptionStart = new NDKSubscriptionStart(ndk);
 * subscriptionStart.amount = { amount: 100, currency: "USD", term: "monthly" };
 * subscriptionStart.recipient = creator;
 * subscriptionStart.author = subscriber;
 *
 * // {
 * //   kind: 7001,
 * //   pubkey: "<subscriber-pubkey>"
 * //   tags: [
 * //     ["amount", "100", "USD", "monthly"],
 * //     ["p", "<creator-pubkey>"]
 * //   ]
 * // }
 */
declare class NDKSubscriptionStart extends NDKEvent {
    private debug;
    constructor(ndk: NDK | undefined, rawEvent?: NostrEvent);
    static from(event: NDKEvent): NDKSubscriptionStart;
    /**
     * Recipient of the subscription. I.e. The author of this event subscribes to this user.
     */
    get recipient(): NDKUser | undefined;
    set recipient(user: NDKUser | undefined);
    /**
     * The amount of the subscription.
     */
    get amount(): NDKSubscriptionAmount | undefined;
    set amount(amount: NDKSubscriptionAmount | undefined);
    /**
     * The event id or NIP-33 tag id of the tier that the user is subscribing to.
     */
    get tierId(): string | undefined;
    set tier(tier: NDKSubscriptionTier | undefined);
    /**
     * Fetches the tier that the user is subscribing to.
     */
    fetchTier(): Promise<NDKSubscriptionTier | undefined>;
    get isValid(): boolean;
}

type ValidPeriod = {
    start: Date;
    end: Date;
};
/**
 * A subscription receipt event.
 *
 * @example
 * const creator = new NDKUser;
 * const subscriber = new NDKUser;
 * const receipt = new NDKSubscriptionReceipt(ndk, event);
 * event.recipient = creator;
 * event.subscriber = subscriber;
 */
declare class NDKSubscriptionReceipt extends NDKEvent {
    private debug;
    constructor(ndk: NDK | undefined, rawEvent?: NostrEvent);
    static from(event: NDKEvent): NDKSubscriptionReceipt;
    /**
     * This is the person being subscribed to
     */
    get recipient(): NDKUser | undefined;
    set recipient(user: NDKUser | undefined);
    /**
     * This is the person subscribing
     */
    get subscriber(): NDKUser | undefined;
    set subscriber(user: NDKUser | undefined);
    set subscriptionStart(event: NDKSubscriptionStart);
    get tierName(): string | undefined;
    get isValid(): boolean;
    get validPeriod(): ValidPeriod | undefined;
    set validPeriod(period: ValidPeriod | undefined);
    get startPeriod(): Date | undefined;
    get endPeriod(): Date | undefined;
    /**
     * Whether the subscription is currently active
     */
    isActive(time?: Date): boolean;
}

/**
 * Represents a horizontal or vertical video.
 * @group Kind Wrapper
 */
declare class NDKVideo extends NDKEvent {
    static kind: NDKKind;
    static kinds: NDKKind[];
    private _imetas;
    constructor(ndk: NDK | undefined, rawEvent?: NostrEvent);
    /**
     * Creates a NDKArticle from an existing NDKEvent.
     *
     * @param event NDKEvent to create the NDKArticle from.
     * @returns NDKArticle
     */
    static from(event: NDKEvent): NDKVideo;
    /**
     * Getter for the article title.
     *
     * @returns {string | undefined} - The article title if available, otherwise undefined.
     */
    get title(): string | undefined;
    /**
     * Setter for the article title.
     *
     * @param {string | undefined} title - The title to set for the article.
     */
    set title(title: string | undefined);
    /**
     * Getter for the article thumbnail.
     *
     * @returns {string | undefined} - The article thumbnail if available, otherwise undefined.
     */
    get thumbnail(): string | undefined;
    get imetas(): NDKImetaTag[];
    set imetas(tags: NDKImetaTag[]);
    get url(): string | undefined;
    /**
     * Getter for the article's publication timestamp.
     *
     * @returns {number | undefined} - The Unix timestamp of when the article was published or undefined.
     */
    get published_at(): number | undefined;
    /**
     * Setter for the article's publication timestamp.
     *
     * @param {number | undefined} timestamp - The Unix timestamp to set for the article's publication date.
     */
    set published_at(timestamp: number | undefined);
    /**
     * Generates content tags for the article.
     *
     * This method first checks and sets the publication date if not available,
     * and then generates content tags based on the base NDKEvent class.
     *
     * @returns {ContentTag} - The generated content tags.
     */
    generateTags(): Promise<ContentTag>;
    get duration(): number | undefined;
    /**
     * Setter for the video's duration
     *
     * @param {number | undefined} duration - The duration to set for the video (in seconds)
     */
    set duration(dur: number | undefined);
}

declare class NDKWiki extends NDKArticle {
    static kind: NDKKind;
    static kinds: NDKKind[];
}

declare const eventWrappingMap: Map<any, any>;
declare function wrapEvent<T extends NDKEvent>(event: NDKEvent): T | NDKEvent;

declare function eventsBySameAuthor(op: NDKEvent, events: NDKEvent[]): Map<string, NDKEvent>;
/**
 * Checks if an event is a reply to an original post or to a thread.
 * @param op The original event
 * @param event The event to check
 * @param threadIds An optional map of all events in the thread
 * @param tagType The tag type to search for (default: "e" for non-replaceable events and "a" for replaceable events)
 * @returns True if the event is a reply, false otherwise
 */
declare function eventIsReply(op: NDKEvent, event: NDKEvent, threadIds?: Set<NDKEventId>, tagType?: string): boolean;
/**
 * Filters the returned events so that the result is the events that are
 * part of a thread.
 *
 * Threads are defined as a sequence of events that are related to each other
 * and authored by the same user.
 * @param op The original event
 * @param events All candidate events (e.g. events tagging the OP)
 * @returns The events that are part of the thread sorted by creation time
 */
declare function eventThreads(op: NDKEvent, events: NDKEvent[]): NDKEvent[];
declare function getEventReplyIds(event: NDKEvent): NDKEventId[];
declare function isEventOriginalPost(event: NDKEvent): boolean;
declare function eventThreadIds(op: NDKEvent, events: NDKEvent[]): Map<NDKEventId, NDKEvent>;
declare function eventReplies(op: NDKEvent, events: NDKEvent[], threadEventIds: Set<NDKEventId>): NDKEvent[];
/**
 * Checks if an event is part of a thread.
 * @param op The original event
 * @param event The event to check
 * @param eventsByAuthor A map of all candidate events by the original author
 * @returns True if the event is part of the thread, false otherwise
 */
declare function eventIsPartOfThread(op: NDKEvent, event: NDKEvent, eventsByAuthor: Map<NDKEventId, NDKEvent>): boolean;
/**
 * Checks if an event has ETag markers.
 */
declare function eventHasETagMarkers(event: NDKEvent): boolean;
/**
 * Returns the root event ID of an event.
 * @param event The event to get the root event ID from
 * @param searchTag The tags to search for the root event ID @default "a" or "e"
 * @returns The root event ID or undefined if the event does not have a root event ID
 */
declare function getRootEventId(event: NDKEvent, searchTag?: string): NDKEventId | null | undefined;
/**
 * Returns the root tag of an event.
 * @param event The event to get the root tag from
 * @param searchTags The tags to search for the root tag (default: ["a", "e"])
 * @returns The root tag or undefined if the event does not have a root tag
 */
declare function getRootTag(event: NDKEvent, searchTag?: string): NDKTag | undefined;
declare function getReplyTag(event: NDKEvent, searchTag?: string): NDKTag | undefined;

declare class NDKSimpleGroupMemberList extends NDKEvent {
    relaySet: NDKRelaySet | undefined;
    memberSet: Set<Hexpubkey>;
    static kind: NDKKind;
    static kinds: NDKKind[];
    constructor(ndk: NDK | undefined, rawEvent?: NostrEvent | NDKEvent);
    static from(event: NDKEvent): NDKSimpleGroupMemberList;
    get members(): string[];
    hasMember(member: Hexpubkey): boolean;
    publish(relaySet?: NDKRelaySet, timeoutMs?: number, requiredRelayCount?: number): Promise<Set<NDKRelay>>;
}

declare class NDKSimpleGroupMetadata extends NDKEvent {
    static kind: NDKKind;
    static kinds: NDKKind[];
    constructor(ndk: NDK | undefined, rawEvent?: NostrEvent | NDKEvent);
    static from(event: NDKEvent): NDKSimpleGroupMetadata;
    get name(): string | undefined;
    get picture(): string | undefined;
    get about(): string | undefined;
    get scope(): "public" | "private" | undefined;
    set scope(scope: "public" | "private" | undefined);
    get access(): "open" | "closed" | undefined;
    set access(access: "open" | "closed" | undefined);
}

/**
 * Represents a NIP-29 group.
 * @catergory Kind Wrapper
 */
declare class NDKSimpleGroup {
    readonly ndk: NDK;
    groupId: string;
    readonly relaySet: NDKRelaySet;
    private fetchingMetadata;
    metadata: NDKSimpleGroupMetadata | undefined;
    memberList: NDKSimpleGroupMemberList | undefined;
    adminList: NDKSimpleGroupMemberList | undefined;
    constructor(ndk: NDK, relaySet: NDKRelaySet, groupId?: string);
    get id(): string;
    relayUrls(): string[];
    get name(): string | undefined;
    get about(): string | undefined;
    get picture(): string | undefined;
    get members(): Hexpubkey[] | [];
    get admins(): Hexpubkey[] | [];
    getMetadata(): Promise<NDKSimpleGroupMetadata>;
    /**
     * Creates the group by publishing a kind:9007 event.
     * @param signer
     * @returns
     */
    createGroup(signer?: NDKSigner): Promise<Set<NDKRelay>>;
    setMetadata({ name, about, picture, }: {
        name?: string;
        about?: string;
        picture?: string;
    }): Promise<Set<NDKRelay>>;
    /**
     * Adds a user to the group using a kind:9000 event
     * @param user user to add
     * @param opts options
     */
    addUser(user: NDKUser): Promise<NDKEvent>;
    getMemberListEvent(): Promise<NDKEvent | null>;
    /**
     * Gets a list of users that belong to this group
     */
    getMembers(): Promise<NDKUser[]>;
    /**
     * Generates an event that lists the members of a group.
     * @param groupId
     * @returns
     */
    static generateUserListEvent(groupId: string): NDKEvent;
    /**
     * Generates an event that adds a user to a group.
     * @param userPubkey pubkey of the user to add
     * @param groupId group to add the user to
     * @returns
     */
    static generateAddUserEvent(userPubkey: string, groupId: string): NDKEvent;
    requestToJoin(pubkey: Hexpubkey, content?: string): Promise<Set<NDKRelay>>;
    /**
     * Makes sure that a metadata event exists locally
     */
    ensureMetadataEvent(): Promise<void>;
}

/**
 * Implements NIP-78 App Settings
 *
 * @example
 * const appSettings = new NDKAppSettings(ndk)
 * appSettings.appName = "My App";
 * appSettings.set("my_key", "my_value");
 * await appSettings.save();
 *
 * @example
 * const appSettings = NDKAppSettings.from(event);
 * appSettings.appName = "My App";
 * console.log(appSettings.get("my_key"));
 *
 * @group Kind Wrapper
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/78.md
 */
declare class NDKAppSettings extends NDKEvent {
    appName: string | undefined;
    settings: Record<string, unknown>;
    constructor(ndk: NDK | undefined, rawEvent?: NostrEvent | NDKEvent);
    static from(event: NDKEvent): NDKAppSettings;
    /**
     * Set a value for a given key.
     *
     * @param key
     * @param value
     */
    set(key: string, value: unknown): void;
    /**
     * Get a value for a given key.
     *
     * @param key
     * @returns
     */
    get(key: string): unknown;
    publishReplaceable(relaySet?: NDKRelaySet, timeoutMs?: number, requiredRelayCount?: number): Promise<Set<NDKRelay>>;
}

type Nip04QueueItem = {
    type: "encrypt" | "decrypt";
    counterpartyHexpubkey: string;
    value: string;
    resolve: (value: string) => void;
    reject: (reason?: Error) => void;
};
type Nip07RelayMap = {
    [key: string]: {
        read: boolean;
        write: boolean;
    };
};
/**
 * NDKNip07Signer implements the NDKSigner interface for signing Nostr events
 * with a NIP-07 browser extension (e.g., getalby, nos2x).
 */
declare class NDKNip07Signer implements NDKSigner {
    private _userPromise;
    nip04Queue: Nip04QueueItem[];
    private nip04Processing;
    private debug;
    private waitTimeout;
    /**
     * @param waitTimeout - The timeout in milliseconds to wait for the NIP-07 to become available
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
    relays(ndk: NDK): Promise<NDKRelay[]>;
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
            getRelays?: () => Promise<Nip07RelayMap>;
            nip04?: {
                encrypt(recipientHexPubKey: string, value: string): Promise<string>;
                decrypt(senderHexPubKey: string, value: string): Promise<string>;
            };
            nip44?: Nip44;
        };
    }
}

interface NDKRpcRequest {
    id: string;
    pubkey: string;
    method: string;
    params: string[];
    event: NDKEvent;
}
interface NDKRpcResponse {
    id: string;
    result: string;
    error?: string;
    event: NDKEvent;
}
declare class NDKNostrRpc extends EventEmitter {
    private ndk;
    private signer;
    private relaySet;
    private debug;
    encryptionType: "nip04" | "nip44";
    private pool;
    constructor(ndk: NDK, signer: NDKSigner, debug: debug.Debugger, relayUrls?: string[]);
    /**
     * Subscribe to a filter. This function will resolve once the subscription is ready.
     */
    subscribe(filter: NDKFilter): Promise<NDKSubscription>;
    parseEvent(event: NDKEvent): Promise<NDKRpcRequest | NDKRpcResponse>;
    sendResponse(id: string, remotePubkey: string, result: string, kind?: NDKKind, error?: string): Promise<void>;
    /**
     * Sends a request.
     * @param remotePubkey
     * @param method
     * @param params
     * @param kind
     * @param id
     */
    sendRequest(remotePubkey: string, method: string, params?: string[], kind?: number, cb?: (res: NDKRpcResponse) => void): Promise<NDKRpcResponse>;
}

type NIP46Method = "connect" | "sign_event" | "nip04_encrypt" | "nip04_decrypt" | "nip44_encrypt" | "nip44_decrypt" | "get_public_key" | "ping";
type Nip46PermitCallbackParams = {
    /**
     * ID of the request
     */
    id: string;
    pubkey: string;
    method: NIP46Method;
    params?: any;
};
type Nip46PermitCallback = (params: Nip46PermitCallbackParams) => Promise<boolean>;
type Nip46ApplyTokenCallback = (pubkey: string, token: string) => Promise<void>;
interface IEventHandlingStrategy {
    handle(backend: NDKNip46Backend, id: string, remotePubkey: string, params: string[]): Promise<string | undefined>;
}
/**
 * This class implements a NIP-46 backend, meaning that it will hold a private key
 * of the npub that wants to be published as.
 *
 * This backend is meant to be used by an NDKNip46Signer, which is the class that
 * should run client-side, where the user wants to sign events from.
 */
declare class NDKNip46Backend {
    readonly ndk: NDK;
    readonly signer: NDKSigner;
    localUser?: NDKUser;
    readonly debug: debug.Debugger;
    rpc: NDKNostrRpc;
    private permitCallback;
    relayUrls: WebSocket["url"][];
    /**
     * @param ndk The NDK instance to use
     * @param signer The signer for the private key that wants to be published as
     * @param permitCallback Callback executed when permission is requested
     */
    constructor(ndk: NDK, signer: NDKSigner, permitCallback: Nip46PermitCallback, relayUrls?: WebSocket["url"][]);
    /**
     * @param ndk The NDK instance to use
     * @param privateKey The private key of the npub that wants to be published as
     * @param permitCallback Callback executed when permission is requested
     */
    constructor(ndk: NDK, privateKey: string, permitCallback: Nip46PermitCallback, relayUrls?: WebSocket["url"][]);
    /**
     * This method starts the backend, which will start listening for incoming
     * requests.
     */
    start(): Promise<void>;
    handlers: {
        [method: string]: IEventHandlingStrategy;
    };
    /**
     * Enables the user to set a custom strategy for handling incoming events.
     * @param method - The method to set the strategy for
     * @param strategy - The strategy to set
     */
    setStrategy(method: string, strategy: IEventHandlingStrategy): void;
    /**
     * Overload this method to apply tokens, which can
     * wrap permission sets to be applied to a pubkey.
     * @param pubkey public key to apply token to
     * @param token token to apply
     */
    applyToken(pubkey: string, token: string): Promise<void>;
    protected handleIncomingEvent(event: NDKEvent): Promise<void>;
    /**
     * This method should be overriden by the user to allow or reject incoming
     * connections.
     */
    pubkeyAllowed(params: Nip46PermitCallbackParams): Promise<boolean>;
}

/**
 * This NDKSigner implements NIP-46, which allows remote signing of events.
 * This class is meant to be used client-side, paired with the NDKNip46Backend or a NIP-46 backend (like Nostr-Connect)
 *
 * @emits authUrl -- Emitted when the user should take an action in certain URL.
 *                   When a client receives this event, it should direct the user
 *                   to go to that URL to authorize the application.
 *
 * @example
 * const ndk = new NDK()
 * const nip05 = await prompt("enter your nip-05") // Get a NIP-05 the user wants to login with
 * const privateKey = localStorage.getItem("nip46-local-key") // If we have a private key previously saved, use it
 * const signer = new NDKNip46Signer(ndk, nip05, privateKey) // Create a signer with (or without) a private key
 *
 * // Save generated private key for future use
 * localStorage.setItem("nip46-local-key", signer.localSigner.privateKey)
 *
 * // If the backend sends an auth_url event, open that URL as a popup so the user can authorize the app
 * signer.on("authUrl", (url) => { window.open(url, "auth", "width=600,height=600") })
 *
 * // wait until the signer is ready
 * const loggedinUser = await signer.blockUntilReady()
 *
 * alert("You are now logged in as " + loggedinUser.npub)
 */
declare class NDKNip46Signer extends EventEmitter implements NDKSigner {
    private ndk;
    private _user?;
    /**
     * The pubkey of the bunker that will be providing signatures
     */
    bunkerPubkey: string | undefined;
    /**
     * The pubkey of the user that events will be published as
     */
    userPubkey?: string | null;
    /**
     * An optional secret value provided to connect to the bunker
     */
    secret?: string | null;
    localSigner: NDKSigner;
    private nip05?;
    rpc: NDKNostrRpc;
    private debug;
    relayUrls: string[] | undefined;
    private subscription;
    /**
     * @param ndk - The NDK instance to use
     * @param remoteNip05 - The nip05 that wants to be published as
     * @param localSigner - The signer that will be used to request events to be signed
     */
    constructor(ndk: NDK, remoteNip05: string, localSigner?: NDKSigner);
    private connectionTokenInit;
    private nip05Init;
    /**
     * @deprecated Use userPubkey instead
     */
    get remotePubkey(): string | null | undefined;
    /**
     * We start listening for events from the bunker
     */
    private startListening;
    /**
     * Get the user that is being published as
     */
    user(): Promise<NDKUser>;
    blockUntilReady(): Promise<NDKUser>;
    getPublicKey(): Promise<Hexpubkey>;
    encrypt(recipient: NDKUser, value: string): Promise<string>;
    decrypt(sender: NDKUser, value: string): Promise<string>;
    nip04Encrypt(recipient: NDKUser, value: string): Promise<string>;
    nip04Decrypt(sender: NDKUser, value: string): Promise<string>;
    nip44Encrypt(recipient: NDKUser, value: string): Promise<string>;
    nip44Decrypt(sender: NDKUser, value: string): Promise<string>;
    private _encrypt;
    private _decrypt;
    sign(event: NostrEvent): Promise<string>;
    /**
     * Allows creating a new account on the remote server.
     * @param username Desired username for the NIP-05
     * @param domain Desired domain for the NIP-05
     * @param email Email address to associate with this account -- Remote servers may use this for recovery
     * @returns The public key of the newly created account
     */
    createAccount(username?: string, domain?: string, email?: string): Promise<Hexpubkey>;
}

declare class NDKPrivateKeySigner implements NDKSigner {
    private _user;
    _privateKey?: Uint8Array;
    constructor(privateKey?: Uint8Array | string);
    get privateKey(): string | undefined;
    static generate(): NDKPrivateKeySigner;
    blockUntilReady(): Promise<NDKUser>;
    user(): Promise<NDKUser>;
    sign(event: NostrEvent): Promise<string>;
    private getConversationKey;
    nip44Encrypt(recipient: NDKUser, value: string): Promise<string>;
    nip44Decrypt(sender: NDKUser, value: string): Promise<string>;
    /**
     * This method is deprecated and will be removed in a future release, for compatibility
     * this function calls nip04Encrypt.
     */
    encrypt(recipient: NDKUser, value: string, type?: ENCRYPTION_SCHEMES): Promise<string>;
    /**
     * This method is deprecated and will be removed in a future release, for compatibility
     * this function calls nip04Decrypt.
     */
    decrypt(sender: NDKUser, value: string, type?: ENCRYPTION_SCHEMES): Promise<string>;
    nip04Encrypt(recipient: NDKUser, value: string): Promise<string>;
    nip04Decrypt(sender: NDKUser, value: string): Promise<string>;
}

/**
 * Checks if a subscription is fully guaranteed to have been filled.
 *
 * This is useful to determine if a cache hit fully satisfies a subscription.
 *
 * @param subscription
 * @returns
 */
declare function queryFullyFilled(subscription: NDKSubscription): boolean;
/**
 * Compares whether a filter includes another filter.
 * @param filter1 Filter to compare from
 * @param filter2 Filter to compare to
 * @example
 * const filter1 = { authors: ["a", "b"] };
 * const filter2 = { authors: ["a", "b", "c"] };
 * compareFilter(filter1, filter2); // true
 *
 * const filter1 = { authors: ["a", "b"] };
 * const filter2 = { authors: ["a", "c"] };
 * compareFilter(filter1, filter2); // false
 * @returns
 */
declare function compareFilter(filter1: NDKFilter, filter2: NDKFilter): boolean;
/**
 * Generates a subscription ID based on the subscriptions and filter.
 *
 * When some of the subscriptions specify a subId, those are used,
 * joining them with a comma.
 *
 * If none of the subscriptions specify a subId, a subId is generated
 * by joining all the filter keys, and expanding the kinds with the requested kinds.
 */
declare function generateSubId(subscriptions: NDKSubscription[], filters: NDKFilter[]): string;
/**
 * Creates a valid nostr filter to REQ events that are tagging a NIP-19 bech32
 * @param id Bech32 of the event
 * @example
 * const bech32 = "nevent1qgs9kqvr4dkruv3t7n2pc6e6a7v9v2s5fprmwjv4gde8c4fe5y29v0spzamhxue69uhhyetvv9ujuurjd9kkzmpwdejhgtcqype6ycavy2e9zpx9mzeuekaahgw96ken0mzkcmgz40ljccwyrn88gxv2ewr"
 * const filter = filterForEventsTaggingId(bech32);
 * // filter => { "#e": [<id>] }
 *
 * @example
 * const bech32 = "naddr1qvzqqqr4gupzpjjwt0eqm6as279wf079c0j42jysp2t4s37u8pg5w2dfyktxgkntqqxnzde38yen2desxqmn2d3332u3ff";
 * const filter = filterForEventsTaggingId(bech32);
 * // filter => { "#a": ["30023:ca4e5bf20debb0578ae4bfc5c3e55548900a975847dc38514729a92596645a6b:1719357007561"]}
 */
declare function filterForEventsTaggingId(id: string): NDKFilter | undefined;
/**
 * Creates a valid nostr filter from a bech32 encoding along with a relay set (if one is present in the encoding).
 * @param id Bech32 of the event
 * @param ndk
 * @returns
 */
declare function filterAndRelaySetFromBech32(beche2: string, ndk: NDK): {
    filter: NDKFilter;
    relaySet?: NDKRelaySet;
};
/**
 * Creates a valid nostr filter from an event id or a NIP-19 bech32.
 *
 * @example
 * const bech32 = "nevent1qgs9kqvr4dkruv3t7n2pc6e6a7v9v2s5fprmwjv4gde8c4fe5y29v0spzamhxue69uhhyetvv9ujuurjd9kkzmpwdejhgtcqype6ycavy2e9zpx9mzeuekaahgw96ken0mzkcmgz40ljccwyrn88gxv2ewr"
 * const filter = filterFromBech32(bech32);
 * // filter => { ids: [...], authors: [...] }
 */
declare function filterFromId(id: string): NDKFilter;
declare function isNip33AValue(value: string): boolean;
/**
 * Matches an `a` tag of a NIP-33 (kind:pubkey:[identifier])
 */
declare const NIP33_A_REGEX: RegExp;
declare const BECH32_REGEX: RegExp;
/**
 * Returns the specified relays from a NIP-19 bech32.
 *
 * @param bech32 The NIP-19 bech32.
 */
declare function relaysFromBech32(bech32: string, ndk: NDK): NDKRelay[];

/**
 * Schedule a post for publishing at a later time using * a NIP-90 DVM.
 *
 * @param dvm {NDKUser} The DVM to use for scheduling.
 * @param relays {string[]} The relays the schedule event should be published to by the DVM. Defaults to all relays in the pool.
 * @param encrypted {boolean} Whether to encrypt the event. Defaults to true.
 * @param waitForConfirmationForMs {number} How long to wait for the DVM to confirm the schedule event. If none is provided, the event will be scheduled but not confirmed.
 *
 * @example
 * const event = new NDKEvent(ndk, { kind: 1, content: "hello world" });
 * event.created_at = Date.now()/1000 + 60 // schedule for 60 seconds from now
 * await event.sign();
 *
 * const dvm = ndk.getUser({ pubkey: "<a-kind-5905-dvm-pubkey>" });
 *
 * const result = await dvmSchedule(event, dvm);
 * console.log(result.status); // "success"
 */
declare function dvmSchedule(events: NDKEvent | NDKEvent[], dvm: NDKUser, relays?: string[], encrypted?: boolean, waitForConfirmationForMs?: number): Promise<string | void | NDKEvent>;

interface NDKZapInvoice {
    id?: NDKEventId;
    /**
     * The pubkey of the zapper app
     */
    zapper: string;
    /**
     * The pubkey of the user sending the zap
     */
    zappee: string;
    /**
     * The pubkey of the user receiving the zap
     */
    zapped: string;
    /**
     * The event that was zapped
     */
    zappedEvent?: string;
    /**
     * The amount zapped in millisatoshis
     */
    amount: number;
    /**
     * A comment attached to the zap
     */
    comment?: string;
}
/**
 * Parses a zap invoice from a kind 9735 event
 *
 * @param event The event to parse
 *
 * @returns NDKZapInvoice | null
 */
declare function zapInvoiceFromEvent(event: NDKEvent): NDKZapInvoice | null;

declare function generateZapRequest(target: NDKEvent | NDKUser, ndk: NDK, data: NDKLnUrlData, pubkey: string, amount: number, // amount to zap in millisatoshis
relays: string[], comment?: string, tags?: NDKTag[], signer?: NDKSigner): Promise<NDKEvent | null>;

declare function tryNormalizeRelayUrl(url: string): string | undefined;
/**
 * Normalizes a relay URL by removing authentication, www, and hash,
 * and ensures that it ends with a slash.
 *
 * @param url - The URL to be normalized.
 * @returns The normalized URL.
 */
declare function normalizeRelayUrl(url: string): string;
/**
 * Normalizes an array of URLs by removing duplicates and applying a normalization function to each URL.
 * Any URLs that fail to normalize will be ignored.
 *
 * @param urls - An array of URLs to be normalized.
 * @returns An array of normalized URLs without duplicates.
 */
declare function normalize(urls: string[]): string[];
declare function normalizeUrl(urlString: string, options?: any): string;

declare function getRelayListForUser(pubkey: Hexpubkey, ndk: NDK): Promise<NDKRelayList>;
/**
 * Fetches a map of relay lists for a number of users
 * @param pubkeys
 * @param ndk
 * @returns
 */
declare function getRelayListForUsers(pubkeys: Hexpubkey[], ndk: NDK, skipCache?: boolean): Promise<Map<Hexpubkey, NDKRelayList>>;

export { BECH32_REGEX, type CashuPayCb, type CashuPaymentInfo, DEFAULT_ENCRYPTION_SCHEME, type ENCRYPTION_SCHEMES, type EventPointer, type Hexpubkey, type IEventHandlingStrategy, type LNPaymentRequest, type LnPayCb, type LnPaymentInfo, NDKAppHandlerEvent, NDKAppSettings, NDKArticle, type NDKAuthPolicy, type NDKCacheAdapter, type NDKCacheEntry, type NDKCacheRelayInfo, NDKCashuMintList, NDKClassified, type NDKConstructorParams, NDKDVMJobFeedback, NDKDVMJobResult, NDKDVMRequest, NDKDraft, NDKDvmJobFeedbackStatus, type NDKDvmParam, NDKEvent, type NDKEventId, type NDKEventSerialized, type NDKFilter, type NDKFilterFingerprint, NDKHighlight, NDKImage, type NDKImetaTag, type NDKIntervalFrequency, NDKKind, type NDKLUD18ServicePayerData, NDKList, type NDKListItem, NDKListKinds, type NDKLnUrlData, NDKNip07Signer, NDKNip46Backend, NDKNip46Signer, NDKNostrRpc, NDKNutzap, type NDKPaymentConfirmation, type NDKPaymentConfirmationCashu, type NDKPaymentConfirmationLN, NDKPool, NDKPrivateKeySigner, NDKPublishError, NDKRelay, NDKRelayAuthPolicies, type NDKRelayConnectionStats, NDKRelayList, NDKRelaySet, NDKRelayStatus, type NDKRelayUrl, NDKRepost, type NDKRpcRequest, type NDKRpcResponse, type NDKSigner, NDKSimpleGroup, NDKSimpleGroupMemberList, NDKSimpleGroupMetadata, NDKSubscription, type NDKSubscriptionAmount, NDKSubscriptionCacheUsage, type NDKSubscriptionDelayedType, type NDKSubscriptionInternalId, type NDKSubscriptionOptions, NDKSubscriptionReceipt, NDKSubscriptionStart, NDKSubscriptionTier, type NDKTag, NDKTranscriptionDVM, NDKUser, type NDKUserParams, type NDKUserProfile, NDKVideo, type NDKWalletInterface, NDKWiki, type NDKZapConfirmation, type NDKZapConfirmationCashu, type NDKZapConfirmationLN, type NDKZapDetails, type NDKZapInvoice, type NDKZapMethod, type NDKZapMethodInfo, type NDKZapSplit, NDKZapper, NIP33_A_REGEX, type NIP46Method, type Nip46ApplyTokenCallback, type Nip46PermitCallback, type Nip46PermitCallbackParams, type NostrEvent, type Npub, type OnCompleteCb, type ProfilePointer, calculateRelaySetFromEvent, calculateTermDurationInSeconds, compareFilter, NDK as default, defaultOpts, deserialize, dvmSchedule, eventHasETagMarkers, eventIsPartOfThread, eventIsReply, eventReplies, eventThreadIds, eventThreads, eventWrappingMap, eventsBySameAuthor, filterAndRelaySetFromBech32, filterFingerprint, filterForEventsTaggingId, filterFromId, generateSubId, generateZapRequest, getEventReplyIds, getNip57ZapSpecFromLud, getRelayListForUser, getRelayListForUsers, getReplyTag, getRootEventId, getRootTag, imetaTagToTag, isEventOriginalPost, isNip33AValue, mapImetaTag, mergeFilters, newAmount, normalize, normalizeRelayUrl, normalizeUrl, parseTagToSubscriptionAmount, pinEvent, possibleIntervalFrequencies, profileFromEvent, queryFullyFilled, relayListFromKind3, relaysFromBech32, serialize, serializeProfile, tryNormalizeRelayUrl, wrapEvent, zapInvoiceFromEvent };

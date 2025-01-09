"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  NDKCashuDeposit: () => NDKCashuDeposit,
  NDKCashuToken: () => NDKCashuToken,
  NDKCashuWallet: () => NDKCashuWallet,
  NDKNWCWallet: () => NDKNWCWallet,
  NDKNutzapMonitor: () => NDKNutzapMonitor,
  NDKWalletChange: () => NDKWalletChange,
  NDKWalletStatus: () => NDKWalletStatus,
  NDKWebLNWallet: () => NDKWebLNWallet,
  getBolt11Amount: () => getBolt11Amount,
  getBolt11Description: () => getBolt11Description,
  getBolt11ExpiresAt: () => getBolt11ExpiresAt,
  getCashuMintRecommendations: () => getCashuMintRecommendations,
  proofsTotalBalance: () => proofsTotalBalance,
  walletFromLoadingString: () => walletFromLoadingString
});
module.exports = __toCommonJS(src_exports);

// src/nutzap-monitor/index.ts
var import_ndk = require("@nostr-dev-kit/ndk");
var import_tseep = require("tseep");
var import_debug = __toESM(require("debug"));
var d = (0, import_debug.default)("ndk-wallet:nutzap-monitor");
var NDKNutzapMonitor = class extends import_tseep.EventEmitter {
  ndk;
  user;
  relaySet;
  sub;
  eosed = false;
  redeemQueue = /* @__PURE__ */ new Map();
  knownTokens = /* @__PURE__ */ new Map();
  /**
   * Known wallets. This is necessary to be able to find the private key
   * that is needed to redeem the nutzap.
   */
  walletByP2pk = /* @__PURE__ */ new Map();
  allWallets = [];
  addWallet(wallet) {
    const p2pk = wallet.p2pk;
    if (p2pk) {
      d("adding wallet with p2pk %o", p2pk);
      this.walletByP2pk.set(p2pk, wallet);
    }
    this.allWallets.push(wallet);
  }
  /**
   * Create a new nutzap monitor.
   * @param ndk - The NDK instance.
   * @param user - The user to monitor.
   * @param relaySet - An optional relay set to monitor zaps on, if one is not provided, the monitor will use the relay set from the mint list, which is the correct default behavior of NIP-61 zaps.
   */
  constructor(ndk, user, relaySet) {
    super();
    this.ndk = ndk;
    this.user = user;
    this.relaySet = relaySet;
  }
  /**
   * Start the monitor.
   */
  async start(mintList) {
    const authors = [this.user.pubkey];
    if (this.sub) {
      this.sub.stop();
    }
    if (!mintList) {
      const list = await this.ndk.fetchEvent([
        { kinds: [import_ndk.NDKKind.CashuMintList], authors }
      ], { groupable: false, closeOnEose: true });
      if (!list)
        return false;
      mintList = import_ndk.NDKCashuMintList.from(list);
    }
    let wallet;
    let since;
    if (mintList?.p2pk) {
      wallet = this.walletByP2pk.get(mintList.p2pk);
      const mostRecentToken = await this.ndk.fetchEvent([
        { kinds: [import_ndk.NDKKind.CashuToken], authors, limit: 1 }
      ], { closeOnEose: true, groupable: false }, wallet?.relaySet);
      if (mostRecentToken)
        since = mostRecentToken.created_at;
    }
    this.relaySet = mintList.relaySet;
    if (!this.relaySet) {
      d("no relay set provided");
      throw new Error("no relay set provided");
    }
    console.log("starting nutzap monitor with", { since });
    this.sub = this.ndk.subscribe(
      { kinds: [import_ndk.NDKKind.Nutzap], "#p": [this.user.pubkey], since },
      {
        subId: "ndk-wallet:nutzap-monitor",
        cacheUsage: import_ndk.NDKSubscriptionCacheUsage.ONLY_RELAY
      },
      this.relaySet,
      false
    );
    this.sub.on("event", this.eventHandler.bind(this));
    this.sub.on("eose", this.eoseHandler.bind(this));
    this.sub.start();
    return true;
  }
  stop() {
    this.sub?.stop();
  }
  eoseHandler() {
    this.eosed = true;
    this.redeemQueue.forEach((nutzap) => {
      this.redeem(nutzap);
    });
  }
  async eventHandler(event) {
    console.log("nutzap event", event.id);
    if (this.knownTokens.has(event.id))
      return;
    this.knownTokens.set(event.id, 1 /* initial */);
    const nutzapEvent = await import_ndk.NDKNutzap.from(event);
    if (!nutzapEvent)
      return;
    this.emit("seen", nutzapEvent);
    if (!this.eosed) {
      this.pushToRedeemQueue(nutzapEvent);
    } else {
      this.redeem(nutzapEvent);
    }
  }
  pushToRedeemQueue(event) {
    if (this.redeemQueue.has(event.id))
      return;
    const nutzap = import_ndk.NDKNutzap.from(event);
    if (!nutzap)
      return;
    this.redeemQueue.set(nutzap.id, nutzap);
  }
  async redeem(nutzap) {
    d("nutzap seen %s", nutzap.id.substring(0, 6));
    const currentStatus = this.knownTokens.get(nutzap.id);
    if (!currentStatus || currentStatus > 1 /* initial */)
      return;
    this.knownTokens.set(nutzap.id, 2 /* processing */);
    try {
      const { proofs, mint } = nutzap;
      d("nutzap has %d proofs: %o", proofs.length, proofs);
      let wallet;
      wallet = this.findWalletForNutzap(nutzap);
      if (!wallet)
        throw new Error("wallet not found for nutzap");
      await wallet.redeemNutzap(
        nutzap,
        {
          onRedeemed: (res) => {
            const amount = res.reduce((acc, proof) => acc + proof.amount, 0);
            this.emit("redeem", nutzap, amount);
          }
        }
      );
    } catch (e) {
      console.trace(e);
      this.emit("failed", nutzap, e.message);
    }
  }
  findWalletForNutzap(nutzap) {
    const { p2pk, mint } = nutzap;
    let wallet;
    if (p2pk)
      wallet = this.walletByP2pk.get(p2pk);
    wallet ??= this.walletByP2pk.values().next().value;
    if (!wallet) {
      const normalizedMint = (0, import_ndk.normalizeUrl)(mint);
      wallet = this.allWallets.find((w) => w.mints.map(import_ndk.normalizeUrl).includes(normalizedMint));
      if (!wallet)
        throw new Error("wallet not found for nutzap (mint: " + normalizedMint + ")");
    }
    return wallet;
  }
};

// src/wallets/nwc/index.ts
var import_tseep2 = require("tseep");
var import_ndk4 = require("@nostr-dev-kit/ndk");

// src/wallets/nwc/req.ts
var import_ndk3 = require("@nostr-dev-kit/ndk");

// src/wallets/nwc/res.ts
var import_ndk2 = require("@nostr-dev-kit/ndk");
async function waitForResponse(requestId) {
  if (!this.pool)
    throw new Error("Wallet not initialized");
  return new Promise((resolve, reject) => {
    const sub = this.ndk.subscribe(
      {
        kinds: [import_ndk2.NDKKind.NostrWalletConnectRes],
        "#e": [requestId],
        limit: 1
      },
      { groupable: false, pool: this.pool },
      this.relaySet
    );
    sub.on("event", async (event) => {
      try {
        await event.decrypt(event.author, this.signer);
        const content = JSON.parse(event.content);
        sub.stop();
        if (content.error) {
          reject(content);
        } else {
          resolve(content);
        }
      } catch (e) {
        sub.stop();
        reject({
          result_type: "error",
          error: {
            code: "failed_to_parse_response",
            message: e.message
          }
        });
      }
    });
  });
}

// src/wallets/nwc/req.ts
async function sendReq(method, params) {
  if (!this.walletService || !this.signer) {
    throw new Error("Wallet not initialized");
  }
  const event = new import_ndk3.NDKEvent(this.ndk, {
    kind: import_ndk3.NDKKind.NostrWalletConnectReq,
    tags: [["p", this.walletService.pubkey]],
    content: JSON.stringify({ method, params })
  });
  await event.encrypt(this.walletService, this.signer, "nip04");
  await event.sign(this.signer);
  return new Promise((resolve, reject) => {
    waitForResponse.call(
      this,
      event.id
    ).then(resolve).catch(reject);
    event.publish(this.relaySet);
  });
}

// src/wallets/nwc/index.ts
var import_debug2 = __toESM(require("debug"));
var import_cashu_ts = require("@cashu/cashu-ts");
var d2 = (0, import_debug2.default)("ndk-wallet:nwc");
var NDKNWCWallet = class extends import_tseep2.EventEmitter {
  type = "nwc";
  status = "initial" /* INITIAL */;
  walletId = "nwc";
  pairingCode;
  ndk;
  walletService;
  relaySet;
  _status;
  signer;
  _balance;
  cachedInfo;
  pool;
  constructor(ndk) {
    super();
    this.ndk = ndk;
  }
  async init(pubkey, relayUrls, secret) {
    d2("initializing wallet", pubkey, relayUrls, secret);
    this.walletService = this.ndk.getUser({ pubkey });
    this.pool = new import_ndk4.NDKPool(relayUrls, [], this.ndk);
    await this.pool.connect(1e3);
    d2("connected to pool", this.pool.connectedRelays());
    this.signer = new import_ndk4.NDKPrivateKeySigner(secret);
    this._status = "ready" /* READY */;
    this.emit("ready");
  }
  /**
   * Initialize the wallet via a nostr+walletconnect URI
   */
  async initWithPairingCode(uri) {
    const u = new URL(uri);
    const pubkey = u.host ?? u.pathname;
    const relayUrls = u.searchParams.getAll("relay");
    const secret = u.searchParams.get("secret");
    this.pairingCode = uri;
    if (!pubkey || !relayUrls || !secret) {
      throw new Error("Invalid URI");
    }
    return this.init(pubkey, relayUrls, secret);
  }
  toLoadingString() {
    return JSON.stringify({
      type: "nwc",
      pairingCode: this.pairingCode
    });
  }
  async lnPay(payment) {
    if (!this.signer)
      throw new Error("Wallet not initialized");
    d2("lnPay", payment.pr);
    const res = await this.req("pay_invoice", { invoice: payment.pr });
    d2("lnPay res", res);
    if (res.result) {
      return {
        preimage: res.result.preimage
      };
    }
    throw new Error(res.error?.message || "Payment failed");
  }
  async cashuPay(payment) {
    for (const mint of payment.mints) {
      let unit = payment.unit;
      let amount = payment.amount;
      if (unit === "msat") {
        unit = "sat";
        amount = amount / 1e3;
      }
      const wallet = new import_cashu_ts.CashuWallet(new import_cashu_ts.CashuMint(mint), { unit });
      let quote;
      try {
        quote = await wallet.createMintQuote(amount);
        d2("cashuPay quote", quote);
      } catch (e) {
        console.error("error creating mint quote", e);
        throw e;
      }
      if (!quote)
        throw new Error("Didnt receive a mint quote");
      try {
        const res = await this.req("pay_invoice", { invoice: quote.request });
        d2("cashuPay res", res);
      } catch (e) {
        console.error("error paying invoice", e);
        throw e;
      }
      try {
        const mintProofs = await wallet.mintProofs(amount, quote.quote, {
          pubkey: payment.p2pk
        });
        d2("minted tokens", mintProofs);
        return {
          proofs: mintProofs,
          mint
        };
      } catch (e) {
        console.error("error minting tokens", e);
        throw e;
      }
    }
  }
  /**
   * Fetch the balance of this wallet
   */
  async updateBalance() {
    d2("updating balance");
    const res = await this.req("get_balance", {});
    d2("balance", res);
    if (!res.result)
      throw new Error("Failed to get balance");
    if (res.error)
      throw new Error(res.error.message);
    this._balance = [{
      unit: "msats",
      amount: res.result?.balance ?? 0
    }];
    this.emit("balance_updated");
  }
  /**
   * Get the balance of this wallet
   */
  balance() {
    return this._balance;
  }
  req = sendReq.bind(this);
  async getInfo(refetch = false) {
    if (refetch) {
      this.cachedInfo = void 0;
    }
    if (this.cachedInfo)
      return this.cachedInfo;
    const res = await this.req("get_info", {});
    d2("info", res);
    if (!res.result)
      throw new Error("Failed to get info");
    if (res.error)
      throw new Error(res.error.message);
    this.cachedInfo = res.result;
    return res.result;
  }
};

// src/wallets/cashu/wallet/index.ts
var import_ndk14 = require("@nostr-dev-kit/ndk");

// src/wallets/cashu/token.ts
var import_ndk5 = require("@nostr-dev-kit/ndk");

// src/wallets/cashu/decrypt.ts
var import_debug3 = __toESM(require("debug"));
var debug = (0, import_debug3.default)("ndk-wallet:cashu:decrypt");
async function decrypt(event) {
  try {
    await event.decrypt(void 0, void 0, "nip44");
    return;
  } catch (e) {
    debug("unable to decrypt with nip44, attempting with nip04", e);
    await event.decrypt(void 0, void 0, "nip04");
    debug("\u2705 decrypted with nip04", event.id);
  }
}

// src/wallets/cashu/token.ts
function proofsTotalBalance(proofs) {
  for (const proof of proofs) {
    if (proof.amount < 0) {
      throw new Error("proof amount is negative");
    }
  }
  return proofs.reduce((acc, proof) => acc + proof.amount, 0);
}
var NDKCashuToken = class _NDKCashuToken extends import_ndk5.NDKEvent {
  _proofs = [];
  original;
  constructor(ndk, event) {
    super(ndk, event);
    this.kind ??= import_ndk5.NDKKind.CashuToken;
  }
  static async from(event) {
    const token = new _NDKCashuToken(event.ndk, event);
    token.original = event;
    try {
      await decrypt(token);
    } catch {
      token.content = token.original.content;
    }
    try {
      const content = JSON.parse(token.content);
      token.proofs = content.proofs;
      if (!Array.isArray(token.proofs))
        return;
    } catch (e) {
      return;
    }
    return token;
  }
  get proofs() {
    return this._proofs;
  }
  set proofs(proofs) {
    const cs = /* @__PURE__ */ new Set();
    this._proofs = [];
    for (const proof of proofs) {
      if (cs.has(proof.C)) {
        console.warn("Passed in proofs had duplicates, ignoring", proof.C);
        continue;
      }
      this._proofs.push(proof);
      cs.add(proof.C);
    }
  }
  /**
   * Strips out anything we don't necessarily have to store.
   */
  cleanProof(proof) {
    return {
      id: proof.id,
      amount: proof.amount,
      C: proof.C,
      secret: proof.secret
    };
  }
  async toNostrEvent(pubkey) {
    this.content = JSON.stringify({
      proofs: this.proofs.map(this.cleanProof)
    });
    const user = await this.ndk.signer.user();
    await this.encrypt(user, void 0, "nip44");
    return super.toNostrEvent(pubkey);
  }
  get walletId() {
    const aTag = this.tags.find(([tag]) => tag === "a");
    if (!aTag)
      return;
    return aTag[1]?.split(":")[2];
  }
  set wallet(wallet) {
    const id = wallet.tagId();
    if (id)
      this.tags.push(["a", id]);
  }
  set mint(mint) {
    this.removeTag("mint");
    this.tags.push(["mint", (0, import_ndk5.normalizeUrl)(mint)]);
  }
  get mint() {
    const t = this.tagValue("mint");
    if (t)
      return (0, import_ndk5.normalizeUrl)(t);
  }
  get amount() {
    return proofsTotalBalance(this.proofs);
  }
  async publish(relaySet, timeoutMs, requiredRelayCount) {
    if (this.original) {
      return this.original.publish(relaySet, timeoutMs, requiredRelayCount);
    } else {
      return super.publish(relaySet, timeoutMs, requiredRelayCount);
    }
  }
};

// src/wallets/cashu/deposit.ts
var import_tseep3 = require("tseep");
var import_debug5 = __toESM(require("debug"));

// src/wallets/cashu/quote.ts
var import_ndk6 = require("@nostr-dev-kit/ndk");
var import_ndk7 = require("@nostr-dev-kit/ndk");

// src/utils/ln.ts
var import_light_bolt11_decoder = require("light-bolt11-decoder");
function getBolt11ExpiresAt(bolt11) {
  const decoded = (0, import_light_bolt11_decoder.decode)(bolt11);
  const expiry = decoded.expiry;
  const timestamp = decoded.sections.find((section) => section.name === "timestamp").value;
  if (typeof expiry === "number" && typeof timestamp === "number") {
    return expiry + timestamp;
  }
  return void 0;
}
function getBolt11Amount(bolt11) {
  const decoded = (0, import_light_bolt11_decoder.decode)(bolt11);
  const val = decoded.sections.find((section) => section.name === "amount")?.value;
  return Number(val);
}
function getBolt11Description(bolt11) {
  const decoded = (0, import_light_bolt11_decoder.decode)(bolt11);
  const val = decoded.sections.find((section) => section.name === "description")?.value;
  return val;
}

// src/wallets/cashu/quote.ts
var NDKCashuQuote = class _NDKCashuQuote extends import_ndk7.NDKEvent {
  quoteId;
  mint;
  amount;
  unit;
  _wallet;
  static kind = import_ndk6.NDKKind.CashuQuote;
  constructor(ndk, event) {
    super(ndk, event);
    this.kind ??= import_ndk6.NDKKind.CashuQuote;
  }
  static async from(event) {
    const quote = new _NDKCashuQuote(event.ndk, event);
    const original = event;
    try {
      await decrypt(quote);
    } catch {
      quote.content = original.content;
    }
    try {
      const content = JSON.parse(quote.content);
      quote.quoteId = content.quoteId;
      quote.mint = content.mint;
      quote.amount = content.amount;
      quote.unit = content.unit;
    } catch (e) {
      return;
    }
    return quote;
  }
  set wallet(wallet) {
    const tagId = wallet.tagId();
    if (!tagId)
      return;
    this.tags.push(["a", tagId]);
    this._wallet = wallet;
  }
  set invoice(invoice) {
    const bolt11Expiry = getBolt11ExpiresAt(invoice);
    if (bolt11Expiry)
      this.tags.push(["expiration", bolt11Expiry.toString()]);
  }
  async save() {
    if (!this.ndk)
      throw new Error("NDK is required");
    this.content = JSON.stringify({
      quoteId: this.quoteId,
      mint: this.mint,
      amount: this.amount,
      unit: this.unit
    });
    console.log("saving quote %o", this.rawEvent());
    await this.encrypt(this.ndk.activeUser, void 0, "nip44");
    await this.sign();
    await this.publish(this._wallet?.relaySet);
  }
};

// src/wallets/cashu/wallet/txs.ts
var import_ndk9 = require("@nostr-dev-kit/ndk");

// src/wallets/cashu/history.ts
var import_ndk8 = require("@nostr-dev-kit/ndk");
var import_debug4 = __toESM(require("debug"));
var d3 = (0, import_debug4.default)("ndk-wallet:wallet-change");
var MARKERS = {
  REDEEMED: "redeemed",
  CREATED: "created",
  DESTROYED: "destroyed",
  RESERVED: "reserved"
};
var NDKWalletChange = class _NDKWalletChange extends import_ndk8.NDKEvent {
  static MARKERS = MARKERS;
  static kind = import_ndk8.NDKKind.WalletChange;
  static kinds = [import_ndk8.NDKKind.WalletChange];
  constructor(ndk, event) {
    super(ndk, event);
    this.kind ??= import_ndk8.NDKKind.WalletChange;
  }
  static async from(event) {
    const walletChange = new _NDKWalletChange(event.ndk, event);
    const prevContent = walletChange.content;
    try {
      await decrypt(walletChange);
    } catch (e) {
      walletChange.content ??= prevContent;
    }
    try {
      const contentTags = JSON.parse(walletChange.content);
      walletChange.tags = [...contentTags, ...walletChange.tags];
    } catch (e) {
      return;
    }
    return walletChange;
  }
  set direction(direction) {
    this.removeTag("direction");
    if (direction)
      this.tags.push(["direction", direction]);
  }
  get direction() {
    return this.tagValue("direction");
  }
  set amount(amount) {
    this.removeTag("amount");
    this.tags.push(["amount", amount.toString()]);
  }
  get amount() {
    return this.tagValue("amount");
  }
  set fee(fee) {
    this.removeTag("fee");
    this.tags.push(["fee", fee.toString()]);
  }
  get fee() {
    return this.tagValue("fee");
  }
  set unit(unit) {
    this.removeTag("unit");
    if (unit)
      this.tags.push(["unit", unit.toString()]);
  }
  get unit() {
    return this.tagValue("unit");
  }
  set description(description) {
    this.removeTag("description");
    if (description)
      this.tags.push(["description", description.toString()]);
  }
  get description() {
    return this.tagValue("description");
  }
  set mint(mint) {
    this.removeTag("mint");
    if (mint)
      this.tags.push(["mint", mint.toString()]);
  }
  get mint() {
    return this.tagValue("mint");
  }
  /**
   * Tags tokens that were created in this history event
   */
  set destroyedTokens(events) {
    for (const event of events) {
      this.tags.push(event.tagReference(MARKERS.DESTROYED));
    }
  }
  set destroyedTokenIds(ids) {
    for (const id of ids) {
      this.tags.push(["e", id, "", MARKERS.DESTROYED]);
    }
  }
  /**
   * Tags tokens that were created in this history event
   */
  set createdTokens(events) {
    for (const event of events) {
      this.tags.push(event.tagReference(MARKERS.CREATED));
    }
  }
  set reservedTokens(events) {
    for (const event of events) {
      this.tags.push(event.tagReference(MARKERS.RESERVED));
    }
  }
  addRedeemedNutzap(event) {
    this.tag(event, MARKERS.REDEEMED);
  }
  async toNostrEvent(pubkey) {
    const encryptedTags = [];
    const unencryptedTags = [];
    for (const tag of this.tags) {
      if (!this.shouldEncryptTag(tag)) {
        unencryptedTags.push(tag);
      } else {
        encryptedTags.push(tag);
      }
    }
    this.tags = unencryptedTags.filter((t) => t[0] !== "client");
    this.content = JSON.stringify(encryptedTags);
    const user = await this.ndk.signer.user();
    await this.encrypt(user, void 0, "nip44");
    return super.toNostrEvent(pubkey);
  }
  /**
   * Whether this entry includes a redemption of a Nutzap
   */
  get hasNutzapRedemption() {
    return this.getMatchingTags("e", MARKERS.REDEEMED).length > 0;
  }
  shouldEncryptTag(tag) {
    const unencryptedTagNames = ["d", "client", "a"];
    if (unencryptedTagNames.includes(tag[0])) {
      return false;
    }
    if (tag[0] === "e" && tag[3] === MARKERS.REDEEMED) {
      return false;
    }
    return true;
  }
};

// src/wallets/cashu/wallet/txs.ts
async function createOutTxEvent(wallet, paymentRequest, paymentResult, updateStateResult) {
  let description = paymentRequest.paymentDescription;
  let amount;
  let unit;
  if (paymentRequest.pr) {
    amount = getBolt11Amount(paymentRequest.pr);
    unit = "msat";
    description ??= getBolt11Description(paymentRequest.pr);
  } else {
    amount = paymentRequest.amount;
    unit = paymentRequest.unit || this.wallet.unit;
  }
  if (!amount) {
    console.error("BUG: Unable to find amount for paymentRequest", paymentRequest);
  }
  const historyEvent = new NDKWalletChange(wallet.ndk);
  if (wallet.event)
    historyEvent.tags.push(wallet.event.tagReference());
  historyEvent.direction = "out";
  historyEvent.amount = amount ?? 0;
  historyEvent.unit = unit;
  historyEvent.mint = paymentResult.walletChange.mint;
  if (paymentResult.fee)
    historyEvent.fee = paymentResult.fee;
  if (paymentRequest.target) {
    historyEvent.tags.push(paymentRequest.target.tagReference());
    if (!(paymentRequest.target instanceof import_ndk9.NDKUser)) {
      historyEvent.tags.push(["p", paymentRequest.target.pubkey]);
    }
  }
  if (updateStateResult.created)
    historyEvent.createdTokens = [updateStateResult.created];
  if (updateStateResult.deleted)
    historyEvent.destroyedTokenIds = updateStateResult.deleted;
  if (updateStateResult.reserved)
    historyEvent.reservedTokens = [updateStateResult.reserved];
  await historyEvent.sign();
  historyEvent.publish(wallet.relaySet);
  return historyEvent;
}
async function createInTxEvent(wallet, proofs, unit, mint, updateStateResult, { nutzap, fee, description }) {
  const historyEvent = new NDKWalletChange(wallet.ndk);
  const amount = proofsTotalBalance(proofs);
  if (wallet.event)
    historyEvent.tags.push(wallet.event.tagReference());
  historyEvent.direction = "in";
  historyEvent.amount = amount;
  historyEvent.unit = wallet.unit;
  historyEvent.mint = mint;
  historyEvent.description = description;
  if (nutzap)
    historyEvent.description ??= "redeemed nutzap";
  if (updateStateResult.created)
    historyEvent.createdTokens = [updateStateResult.created];
  if (updateStateResult.deleted)
    historyEvent.destroyedTokenIds = updateStateResult.deleted;
  if (updateStateResult.reserved)
    historyEvent.reservedTokens = [updateStateResult.reserved];
  if (nutzap)
    historyEvent.addRedeemedNutzap(nutzap);
  if (fee)
    historyEvent.fee = fee;
  console.log("created history event", JSON.stringify(historyEvent.rawEvent(), null, 4));
  await historyEvent.sign();
  historyEvent.publish(wallet.relaySet);
  return historyEvent;
}

// src/wallets/cashu/deposit.ts
var d4 = (0, import_debug5.default)("ndk-wallet:cashu:deposit");
function randomMint(wallet) {
  const mints = wallet.mints;
  const mint = mints[Math.floor(Math.random() * mints.length)];
  return mint;
}
var NDKCashuDeposit = class _NDKCashuDeposit extends import_tseep3.EventEmitter {
  mint;
  amount;
  quoteId;
  wallet;
  _wallet;
  checkTimeout;
  checkIntervalLength = 2500;
  finalized = false;
  unit;
  quoteEvent;
  constructor(wallet, amount, mint, unit) {
    super();
    this.wallet = wallet;
    this.mint = mint || randomMint(wallet);
    this.amount = amount;
    this.unit = unit;
  }
  static fromQuoteEvent(wallet, quote) {
    if (!quote.amount)
      throw new Error("quote has no amount");
    if (!quote.mint)
      throw new Error("quote has no mint");
    const unit = quote.unit ?? wallet.unit;
    const deposit = new _NDKCashuDeposit(wallet, quote.amount, quote.mint, quote.unit);
    deposit.quoteId = quote.quoteId;
    return deposit;
  }
  /**
   * Creates a quote ID and start monitoring for payment.
   * 
   * Once a payment is received, the deposit will emit a "success" event.
   * 
   * @param pollTime - time in milliseconds between checks
   * @returns 
   */
  async start(pollTime = 2500) {
    const cashuWallet = await this.wallet.cashuWallet(this.mint);
    const quote = await cashuWallet.createMintQuote(this.amount);
    d4("created quote %s for %d %s", quote.quote, this.amount, this.mint);
    this.quoteId = quote.quote;
    this.wallet.depositMonitor.addDeposit(this);
    setTimeout(this.check.bind(this, pollTime), pollTime);
    this.createQuoteEvent(quote.quote, quote.request).then((event) => this.quoteEvent = event);
    return quote.request;
  }
  /**
   * This generates a 7374 event containing the quote ID
   * with an optional expiration set to the bolt11 expiry (if there is one)
   */
  async createQuoteEvent(quoteId, bolt11) {
    const { ndk } = this.wallet;
    const quoteEvent = new NDKCashuQuote(ndk);
    quoteEvent.quoteId = quoteId;
    quoteEvent.mint = this.mint;
    quoteEvent.amount = this.amount;
    quoteEvent.unit = this.unit;
    quoteEvent.wallet = this.wallet;
    quoteEvent.invoice = bolt11;
    try {
      await quoteEvent.save();
      d4("saved quote on event %s", quoteEvent.rawEvent());
    } catch (e) {
      d4("error saving quote on event %s", e.relayErrors);
    }
    return quoteEvent;
  }
  async runCheck() {
    if (!this.finalized)
      await this.finalize();
    if (!this.finalized)
      this.delayCheck();
  }
  delayCheck() {
    setTimeout(() => {
      this.runCheck();
      this.checkIntervalLength += 500;
    }, this.checkIntervalLength);
  }
  /**
   * Check if the deposit has been finalized.
   * @param timeout A timeout in milliseconds to wait before giving up.
   */
  async check(timeout) {
    this.runCheck();
    if (timeout) {
      setTimeout(() => {
        clearTimeout(this.checkTimeout);
      }, timeout);
    }
  }
  async finalize() {
    if (!this.quoteId)
      throw new Error("No quoteId set.");
    let proofs;
    try {
      d4("Checking for minting status of %s", this.quoteId);
      const cashuWallet = await this.wallet.cashuWallet(this.mint);
      const proofsWeHave = await this.wallet.proofsForMint(this.mint);
      proofs = await cashuWallet.mintProofs(this.amount, this.quoteId, {
        proofsWeHave
      });
      if (proofs.length === 0)
        return;
    } catch (e) {
      if (e.message.match(/not paid/i))
        return;
      if (e.message.match(/already issued/i)) {
        d4("Mint is saying the quote has already been issued, destroying quote event: %s", e.message);
        this.destroyQuoteEvent();
        this.finalized = true;
        return;
      }
      if (e.message.match(/rate limit/i)) {
        d4("Mint seems to be rate limiting, lowering check interval");
        this.checkIntervalLength += 5e3;
        return;
      }
      d4(e.message);
      return;
    }
    try {
      this.finalized = true;
      const updateRes = await this.wallet.state.update({
        store: proofs,
        mint: this.mint
      });
      const tokenEvent = updateRes.created;
      if (!tokenEvent)
        throw new Error("no token event created");
      createInTxEvent(this.wallet, proofs, this.wallet.unit, this.mint, updateRes, { description: "Deposit" });
      this.emit("success", tokenEvent);
      this.destroyQuoteEvent();
    } catch (e) {
      console.log("relayset", this.wallet.relaySet);
      this.emit("error", e.message);
      console.error(e);
    }
  }
  async destroyQuoteEvent() {
    if (!this.quoteEvent)
      return;
    const deleteEvent = await this.quoteEvent.delete(void 0, false);
    deleteEvent.publish(this.wallet.relaySet);
  }
};

// src/wallets/cashu/wallet/index.ts
var import_debug7 = __toESM(require("debug"));
var import_cashu_ts5 = require("@cashu/cashu-ts");

// src/wallets/cashu/validate.ts
var import_cashu_ts3 = require("@cashu/cashu-ts");
var import_debug6 = __toESM(require("debug"));
var import_ndk10 = require("@nostr-dev-kit/ndk");

// src/wallets/cashu/mint.ts
var import_cashu_ts2 = require("@cashu/cashu-ts");
var mintWallets = /* @__PURE__ */ new Map();
var mintWalletPromises = /* @__PURE__ */ new Map();
function mintKey(mint, unit, pk) {
  if (unit === "sats") {
    unit = "sat";
  }
  if (pk) {
    const pkStr = new TextDecoder().decode(pk);
    return `${mint}-${unit}-${pkStr}`;
  }
  return `${mint}-${unit}`;
}
async function walletForMint(mint, unit, pk, timeout = 5e3) {
  if (unit === "sats" || unit.startsWith("msat")) {
    unit = "sat";
  }
  const key = mintKey(mint, unit, pk);
  if (mintWallets.has(key))
    return mintWallets.get(key);
  if (mintWalletPromises.has(key)) {
    return mintWalletPromises.get(key);
  }
  const wallet = new import_cashu_ts2.CashuWallet(new import_cashu_ts2.CashuMint(mint), { unit, bip39seed: pk });
  console.log("[WALLET] loading mint", mint, { withPk: pk ? true : false });
  const loadPromise = new Promise(async (resolve) => {
    try {
      const timeoutPromise = new Promise((_, rejectTimeout) => {
        setTimeout(() => rejectTimeout(new Error("timeout loading mint")), timeout);
      });
      await Promise.race([wallet.loadMint(), timeoutPromise]);
      console.log("[WALLET] loaded mint", mint);
      mintWallets.set(key, wallet);
      mintWalletPromises.delete(key);
      resolve(wallet);
    } catch (e) {
      console.error("[WALLET] error loading mint", mint, e.message);
      mintWalletPromises.delete(key);
      resolve(null);
    }
  });
  mintWalletPromises.set(key, loadPromise);
  return loadPromise;
}

// src/wallets/cashu/validate.ts
var d5 = (0, import_debug6.default)("ndk-wallet:cashu:validate");
async function consolidateTokens() {
  d5("checking %d tokens for spent proofs", this.tokens.length);
  const mints = new Set(this.tokens.map((t) => t.mint).filter((mint) => !!mint));
  d5("found %d mints", mints.size);
  mints.forEach((mint) => {
    consolidateMintTokens(
      mint,
      this.tokens.filter((t) => t.mint === mint),
      this
    );
  });
}
async function consolidateMintTokens(mint, tokens, wallet) {
  const allProofs = tokens.map((t) => t.proofs).flat();
  const _wallet = await walletForMint(mint, wallet.unit);
  if (!_wallet)
    return;
  d5(
    "checking %d proofs in %d tokens for spent proofs for mint %s",
    allProofs.length,
    tokens.length,
    mint
  );
  const proofStates = await _wallet.checkProofsStates(allProofs);
  const spentProofs = [];
  const unspentProofs = [];
  allProofs.forEach((proof, index) => {
    const { state } = proofStates[index];
    if (state === import_cashu_ts3.CheckStateEnum.SPENT) {
      spentProofs.push(proof);
    } else if (state === import_cashu_ts3.CheckStateEnum.UNSPENT) {
      unspentProofs.push(proof);
    }
  });
  console.log({
    spentProofs,
    unspentProofs
  });
  if (spentProofs.length === 0 && tokens.length === 1) {
    console.log("no spent proofs and we already had a single token, skipping", mint);
    return;
  }
  if (unspentProofs.length > 0) {
    const newToken = new NDKCashuToken(wallet.ndk);
    newToken.proofs = unspentProofs;
    newToken.mint = mint;
    newToken.wallet = wallet;
    await newToken.publish(wallet.relaySet);
    console.log("published new token", newToken.id);
  } else {
    console.log("no unspent proofs, skipping creating new token", mint);
  }
  wallet.addUsedTokens(tokens);
  console.log("destroying ", tokens.length, "tokens");
  const deleteEvent = new import_ndk10.NDKEvent(wallet.ndk, { kind: import_ndk10.NDKKind.EventDeletion });
  for (const token of tokens) {
    deleteEvent.tags.push(["e", token.id]);
  }
  await deleteEvent.publish(wallet.relaySet);
}

// src/wallets/cashu/wallet/index.ts
var import_tseep5 = require("tseep");

// src/wallets/cashu/event-handlers/index.ts
var import_ndk11 = require("@nostr-dev-kit/ndk");

// src/wallets/cashu/event-handlers/token.ts
async function handleToken(event) {
  if (this.knownTokens.has(event.id))
    return;
  const token = await NDKCashuToken.from(event);
  if (!token)
    return;
  this.addToken(token);
}
var token_default = handleToken;

// src/wallets/cashu/event-handlers/deletion.ts
function handleEventDeletion(event) {
  const deletedIds = event.getMatchingTags("e").map((tag) => tag[1]);
  for (const deletedId of deletedIds) {
    if (!this.knownTokens.has(deletedId)) {
      continue;
    }
    this.removeTokenId(deletedId);
  }
}

// src/wallets/cashu/event-handlers/quote.ts
async function handleQuote(event) {
  const quote = await NDKCashuQuote.from(event);
  if (!quote)
    return;
  const deposit = NDKCashuDeposit.fromQuoteEvent(this, quote);
  if (this.depositMonitor.addDeposit(deposit)) {
    deposit.check();
  }
}

// src/wallets/cashu/event-handlers/index.ts
async function eventHandler(event) {
  switch (event.kind) {
    case import_ndk11.NDKKind.CashuToken:
      token_default.bind(this, event).call(this);
      break;
    case import_ndk11.NDKKind.CashuQuote:
      handleQuote.bind(this, event).call(this);
      break;
    case import_ndk11.NDKKind.EventDeletion:
      handleEventDeletion.bind(this, event).call(this);
      break;
  }
}

// src/wallets/cashu/deposit-monitor.ts
var import_tseep4 = require("tseep");
var NDKCashuDepositMonitor = class extends import_tseep4.EventEmitter {
  deposits = /* @__PURE__ */ new Map();
  constructor() {
    super();
  }
  addDeposit(deposit) {
    const { quoteId } = deposit;
    if (!quoteId)
      throw new Error("deposit has no quote ID");
    if (this.deposits.has(quoteId))
      return false;
    deposit.once("success", (token) => {
      this.removeDeposit(quoteId);
    });
    console.log("[DEPOSIT MONITOR] adding deposit %s", quoteId);
    this.deposits.set(quoteId, deposit);
    this.emit("change");
    return true;
  }
  removeDeposit(quoteId) {
    console.log("[DEPOSIT MONITOR] removing deposit %s", quoteId);
    this.deposits.delete(quoteId);
    this.emit("change");
  }
};

// src/wallets/cashu/pay/nut.ts
var import_ndk12 = require("@nostr-dev-kit/ndk");

// src/wallets/cashu/pay.ts
function correctP2pk(p2pk) {
  if (p2pk) {
    if (p2pk.length === 64)
      p2pk = `02${p2pk}`;
  }
  return p2pk;
}

// src/wallets/cashu/pay/ln.ts
var import_cashu_ts4 = require("@cashu/cashu-ts");
async function payLn(wallet, pr) {
  let invoiceAmount = getBolt11Amount(pr);
  if (!invoiceAmount)
    throw new Error("invoice amount is required");
  invoiceAmount = invoiceAmount / 1e3;
  const eligibleMints = wallet.getMintsWithBalance(invoiceAmount);
  console.log("eligible mints", eligibleMints, { invoiceAmount });
  for (const mint of eligibleMints) {
    try {
      const result = await executePayment(mint, pr, invoiceAmount, wallet);
      if (result) {
        return result;
      }
    } catch (error) {
      console.log("Failed to execute payment for mint %s: %s", mint, error);
    }
  }
}
async function executePayment(mint, pr, amount, wallet) {
  console.log("executing payment from mint", mint);
  const result = { walletChange: { mint }, preimage: "" };
  const cashuWallet = await wallet.cashuWallet(mint);
  const mintProofs = wallet.proofsForMint(mint);
  const amountAvailable = mintProofs.reduce((acc, proof) => acc + proof.amount, 0);
  if (amountAvailable < amount)
    return null;
  try {
    const meltQuote = await cashuWallet.createMeltQuote(pr);
    const amountToSend = meltQuote.amount + meltQuote.fee_reserve;
    const proofs = cashuWallet.selectProofsToSend(mintProofs, amountToSend);
    console.log("proofs to send", proofs);
    result.walletChange.destroy = proofs.send;
    const meltResult = await cashuWallet.meltProofs(meltQuote, proofs.send);
    console.log("Melt result: %o", meltResult);
    if (meltResult.quote.state === import_cashu_ts4.MeltQuoteState.PAID) {
      console.log("Payment successful");
      result.walletChange.store = meltResult.change;
      result.fee = calculateFee(amount, proofs.send, meltResult.change);
      result.preimage = meltResult.quote.payment_preimage ?? "";
      return result;
    }
    return null;
  } catch (e) {
    if (e instanceof Error) {
      console.log("Failed to pay with mint %s", e.message);
      throw e;
    }
    return null;
  }
}
function calculateFee(sentAmount, proofs, change) {
  let fee = -sentAmount;
  for (const proof of proofs)
    fee += proof.amount;
  for (const proof of change)
    fee -= proof.amount;
  return fee;
}

// src/wallets/cashu/pay/nut.ts
async function createToken(wallet, amount, unit, recipientMints, p2pk) {
  p2pk = correctP2pk(p2pk);
  const senderMints = wallet.mints;
  const mintsInCommon = findMintsInCommon([recipientMints, senderMints]);
  if (unit === "msat")
    throw new Error("msat should not reach createToken");
  console.log("mints in common", { mintsInCommon, recipientMints, senderMints });
  for (const mint of mintsInCommon) {
    try {
      const res = await createTokenInMint(wallet, mint, amount, p2pk);
      if (res) {
        console.log("result of paying within the same mint", res);
        return res;
      }
    } catch (e) {
      console.log("failed to prepare token for payment from mint %s: %s", mint, e);
    }
  }
  return await createTokenWithMintTransfer(wallet, amount, unit, recipientMints, p2pk);
}
async function createTokenInMint(wallet, mint, amount, p2pk) {
  const walletChange = { mint };
  const cashuWallet = await wallet.cashuWallet(mint);
  try {
    console.log("Attempting with mint %s", mint);
    const proofsWeHave = wallet.proofsForMint(mint);
    const proofs = cashuWallet.selectProofsToSend(proofsWeHave, amount);
    console.log("keeping %d proofs, providing proofs to send: %o", proofs.keep.length, proofs.send);
    const sendResult = await cashuWallet.send(amount, proofs.send, {
      pubkey: p2pk,
      proofsWeHave
    });
    console.log("token preparation result: %o", sendResult);
    walletChange.destroy = proofs.send;
    walletChange.store = sendResult.keep;
    return {
      walletChange,
      send: { proofs: sendResult.send, mint },
      fee: calculateFee2(proofs.send, [...sendResult.send, ...sendResult.keep])
    };
  } catch (e) {
    console.log(
      "failed to pay with mint %s using proofs %o: %s",
      mint,
      e.message
    );
  }
}
function calculateFee2(providedProofs, returnedProofs) {
  const totalProvided = providedProofs.reduce((acc, p) => acc + p.amount, 0);
  const totalReturned = returnedProofs.reduce((acc, p) => acc + p.amount, 0);
  if (totalProvided < totalReturned) {
    console.log("BUG: calculate fee thinks we received back a higher amount of proofs than we sent to the mint", {
      providedProofs,
      returnedProofs
    });
  }
  return totalProvided - totalReturned;
}
async function createTokenWithMintTransfer(wallet, amount, unit, recipientMints, p2pk) {
  const generateQuote = async () => {
    const generateQuoteFromSomeMint = async (mint2) => {
      const targetMintWallet3 = await walletForMint(mint2, unit);
      if (!targetMintWallet3)
        throw new Error("unable to load wallet for mint " + mint2);
      const quote3 = await targetMintWallet3.createMintQuote(amount);
      console.log("received a quote from mint", { quoteId: quote3.quote, mint: mint2 });
      return { quote: quote3, mint: mint2, targetMintWallet: targetMintWallet3 };
    };
    const quotesPromises = recipientMints.map(generateQuoteFromSomeMint);
    const { quote: quote2, mint, targetMintWallet: targetMintWallet2 } = await Promise.any(quotesPromises);
    if (!quote2) {
      console.log("failed to get quote from any mint");
      throw new Error("failed to get quote from any mint");
    }
    console.log("quote from mint %s: %o", mint, quote2, targetMintWallet2.mint);
    return { quote: quote2, mint, targetMintWallet: targetMintWallet2 };
  };
  const { quote, mint: targetMint, targetMintWallet } = await generateQuote();
  if (!quote)
    return;
  console.log("instructing local wallet to pay", { quoteId: quote.quote, targetMint, m: targetMintWallet.mint });
  const invoiceAmount = getBolt11Amount(quote.request);
  if (!invoiceAmount)
    throw new Error("invoice amount is required");
  const invoiceAmountInSat = invoiceAmount / 1e3;
  if (invoiceAmountInSat > amount)
    throw new Error(`invoice amount is more than the amount passed in (${invoiceAmountInSat} vs ${amount})`);
  const payLNResult = await payLn(wallet, quote.request);
  console.log("LN payment result: %o", payLNResult);
  if (!payLNResult) {
    console.log("payment failed");
    return;
  }
  let proofs = [];
  try {
    console.log("will try to mint proofs", { w: targetMintWallet.mint, quoteId: quote.quote });
    proofs = await targetMintWallet.mintProofs(amount, quote.quote, {
      pubkey: p2pk
    });
  } catch (e) {
    console.log("failed to mint proofs, fuck, the mint ate the cashu", e);
  }
  console.log("minted tokens with proofs %o", proofs);
  return {
    walletChange: payLNResult.walletChange,
    send: { proofs, mint: targetMint },
    fee: payLNResult.fee
  };
}
function findMintsInCommon(mintCollections) {
  const mintCounts = /* @__PURE__ */ new Map();
  for (const mints of mintCollections) {
    for (const mint of mints) {
      const normalizedMint = (0, import_ndk12.normalizeUrl)(mint);
      if (!mintCounts.has(normalizedMint)) {
        mintCounts.set(normalizedMint, 1);
      } else {
        mintCounts.set(normalizedMint, mintCounts.get(normalizedMint) + 1);
      }
    }
  }
  const commonMints = [];
  for (const [mint, count] of mintCounts.entries()) {
    if (count === mintCollections.length) {
      commonMints.push(mint);
    }
  }
  return commonMints;
}

// src/wallets/cashu/wallet/payment.ts
var PaymentHandler = class {
  wallet;
  constructor(wallet) {
    this.wallet = wallet;
  }
  /**
   * Pay a LN invoice with this wallet
   */
  async lnPay(payment, createTxEvent = true) {
    if (!payment.pr)
      throw new Error("pr is required");
    const invoiceAmount = getBolt11Amount(payment.pr);
    if (!invoiceAmount)
      throw new Error("invoice amount is required");
    if (payment.amount && invoiceAmount > payment.amount) {
      throw new Error("invoice amount is more than the amount passed in");
    }
    const res = await payLn(this.wallet, payment.pr);
    if (!res?.preimage)
      return;
    const updateRes = await this.wallet.state.update(res.walletChange);
    if (createTxEvent)
      createOutTxEvent(this.wallet, payment, res, updateRes);
    return res;
  }
  /**
   * Swaps tokens to a specific amount, optionally locking to a p2pk.
   */
  async cashuPay(payment) {
    let { amount, unit } = payment;
    if (unit.startsWith("msat")) {
      unit = "sat";
      amount = amount / 1e3;
    }
    const createResult = await createToken(
      this.wallet,
      amount,
      unit,
      payment.mints,
      payment.p2pk
    );
    if (!createResult) {
      console.log("failed to pay with cashu");
      return;
    }
    const isP2pk = (p) => p.secret.startsWith('["P2PK"');
    const isNotP2pk = (p) => !isP2pk(p);
    createResult.walletChange.reserve = createResult.send.proofs?.filter(isNotP2pk) ?? [];
    this.wallet.state.update(createResult.walletChange).then((updateRes) => {
      createOutTxEvent(this.wallet, payment, createResult, updateRes);
    });
    return createResult.send;
  }
};

// src/wallets/cashu/wallet/state.ts
var import_ndk13 = require("@nostr-dev-kit/ndk");
var WalletState = class {
  constructor(wallet, tokens = [], usedTokenIds = /* @__PURE__ */ new Set(), knownTokens = /* @__PURE__ */ new Set()) {
    this.wallet = wallet;
    this.tokens = tokens;
    this.usedTokenIds = usedTokenIds;
    this.knownTokens = knownTokens;
  }
  /**
   * Returns the tokens that are available for spending
   */
  get availableTokens() {
    return this.tokens.filter((t) => !this.usedTokenIds.has(t.id));
  }
  /**
   * Returns a map of the proof C values to the token where it was found
   */
  getAllMintProofTokens(mint) {
    const allMintProofs = /* @__PURE__ */ new Map();
    this.tokens.filter((t) => mint ? t.mint === mint : true).forEach((t) => {
      t.proofs.forEach((p) => {
        allMintProofs.set(p.C, t);
      });
    });
    return allMintProofs;
  }
  /**
   * Returns all proofs for a given mint
   */
  proofsForMint(mint) {
    mint = (0, import_ndk13.normalizeUrl)(mint);
    return this.tokens.filter((t) => t.mint === mint).map((t) => t.proofs).flat();
  }
  /**
   * Adds a token to the list of used tokens
   * to make sure it's proofs are no longer available
   */
  addUsedTokens(token) {
    for (const t of token) {
      this.usedTokenIds.add(t.id);
    }
    this.wallet.emit("balance_updated");
  }
  /**
   * Updates the internal state to add a token,
   * there is no change published anywhere when calling this function.
   */
  addToken(token) {
    if (!token.mint)
      throw new Error("token " + token.encode() + " has no mint");
    if (this.knownTokens.has(token.id)) {
      const stackTrace = new Error().stack;
      console.debug("Refusing to add the same token twice", token.id, stackTrace);
      return false;
    }
    const allMintProofs = this.getAllMintProofTokens(token.mint);
    for (const proof of token.proofs) {
      if (allMintProofs.has(proof.C)) {
        const collidingToken = allMintProofs.get(proof.C);
        if (!collidingToken) {
          console.trace("BUG: unable to find colliding token", {
            token: token.id,
            proof: proof.C
          });
          throw new Error("BUG: unable to find colliding token");
        }
        if (token.created_at <= collidingToken.created_at) {
          console.log("skipping adding requested token since we have a newer token with the same proof", {
            requestedTokenId: token.id,
            relay: token.onRelays.map((r) => r.url)
          });
          this.wallet.warn("Received an older token with proofs that were already known, this is likely a relay that didn't receive (or respected) a delete event", token);
          return false;
        }
        this.removeTokenId(collidingToken.id);
      }
    }
    if (!this.knownTokens.has(token.id)) {
      this.knownTokens.add(token.id);
      this.tokens.push(token);
      this.wallet.emit("balance_updated");
    }
    return true;
  }
  /**
   * Removes a token that has been deleted
   */
  removeTokenId(id) {
    if (!this.knownTokens.has(id)) {
      return false;
    }
    this.tokens = this.tokens.filter((t) => t.id !== id);
    this.wallet.emit("balance_updated");
  }
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
  async calculateNewState(change) {
    const newState = {
      deletedTokenIds: /* @__PURE__ */ new Set(),
      deletedProofs: /* @__PURE__ */ new Set(),
      reserveProofs: [],
      saveProofs: []
    };
    const { mint } = change;
    const proofCsToBeStored = /* @__PURE__ */ new Set();
    let proofCsToBeDeleted = /* @__PURE__ */ new Set();
    if (change.destroy)
      proofCsToBeDeleted = new Set(
        change.destroy.map((proofToBeDestroyed) => proofToBeDestroyed.C)
      );
    const allProofsInMint = new Set(this.proofsForMint(mint).map((proof) => proof.C));
    console.log("we have %d proofs in %s", allProofsInMint.size, mint, allProofsInMint);
    for (const proofToStore of change.store || []) {
      if (allProofsInMint.has(proofToStore.C))
        continue;
      console.log("new proof to store: %s", proofToStore.C.substring(0, 8));
      newState.saveProofs.push(proofToStore);
      proofCsToBeStored.add(proofToStore.C);
    }
    console.log("we have a %d new proofs to store", newState.saveProofs.length);
    newState.deletedProofs = new Set(change.destroy?.map((proof) => proof.C));
    console.log("we have %d proofs to delete", newState.deletedProofs.size);
    const proofsToTokenMap = this.getAllMintProofTokens(change.mint);
    for (const proofToDelete of newState.deletedProofs) {
      const token = proofsToTokenMap.get(proofToDelete);
      if (!token) {
        console.log("BUG! Unable to find token id from known proof's C", {
          proofsToTokenKeys: proofsToTokenMap.keys(),
          CToDelete: proofToDelete.substring(0, 10)
        });
        continue;
      }
      for (const proofInTokenToBeDeleted of token.proofs) {
        if (proofCsToBeDeleted.has(proofInTokenToBeDeleted.C))
          continue;
        if (proofCsToBeStored.has(proofInTokenToBeDeleted.C))
          continue;
        console.log("moving over proof %s in token %s, which will be deleted", proofInTokenToBeDeleted.C.substring(0, 8), token.id.substring(0, 8));
        newState.saveProofs.push(proofInTokenToBeDeleted);
        proofCsToBeStored.add(proofInTokenToBeDeleted.C);
      }
      newState.deletedTokenIds.add(token.id);
    }
    console.log("calculatedNewState output", newState);
    return newState;
  }
  /**
   * Updates the wallet state based on a send result
   * @param sendResult 
   */
  async update(change) {
    const newState = await this.calculateNewState(change);
    const res = {};
    if (newState.saveProofs.length > 0) {
      const newToken = new NDKCashuToken(this.wallet.ndk);
      newToken.proofs = newState.saveProofs;
      console.log("publishing a new token with %d proofs", newState.saveProofs.length, newState.saveProofs);
      newToken.mint = change.mint;
      newToken.wallet = this.wallet;
      await newToken.sign();
      newToken.publish(this.wallet.relaySet);
      res.created = newToken;
      this.addToken(newToken);
    }
    if (newState.deletedTokenIds.size > 0) {
      const deleteEvent = new import_ndk13.NDKEvent(this.wallet.ndk, {
        kind: import_ndk13.NDKKind.EventDeletion,
        tags: [
          ["k", import_ndk13.NDKKind.CashuToken.toString()],
          ...Array.from(newState.deletedTokenIds).map((id) => ["e", id])
        ]
      });
      await deleteEvent.sign();
      console.log("publishing delete event", JSON.stringify(deleteEvent.rawEvent(), null, 4));
      deleteEvent.publish(this.wallet.relaySet);
      res.deleted = Array.from(newState.deletedTokenIds);
      for (const tokenId of newState.deletedTokenIds) {
        this.removeTokenId(tokenId);
      }
    }
    if (newState.reserveProofs.length > 0) {
      const reserveToken = new NDKCashuToken(this.wallet.ndk);
      reserveToken.proofs = newState.reserveProofs;
      reserveToken.mint = change.mint;
      reserveToken.wallet = this.wallet;
      await reserveToken.sign();
      reserveToken.publish(this.wallet.relaySet);
      res.reserved = reserveToken;
    }
    return res;
  }
};

// src/wallets/cashu/wallet/index.ts
var d6 = (0, import_debug7.default)("ndk-wallet:cashu:wallet");
var NDKCashuWallet = class _NDKCashuWallet extends import_tseep5.EventEmitter {
  type = "nip-60";
  /**
   * Active tokens in this wallet
   */
  tokens = [];
  /**
   * Token ids that have been used
   */
  usedTokenIds = /* @__PURE__ */ new Set();
  /**
   * Known tokens in this wallet
   */
  knownTokens = /* @__PURE__ */ new Set();
  skipPrivateKey = false;
  p2pk;
  sub;
  ndk;
  status = "initial" /* INITIAL */;
  static kind = import_ndk14.NDKKind.CashuWallet;
  static kinds = [import_ndk14.NDKKind.CashuWallet];
  privateTags = [];
  publicTags = [];
  _event;
  walletId = "";
  depositMonitor = new NDKCashuDepositMonitor();
  /**
   * Warnings that have been raised
   */
  warnings = [];
  paymentHandler;
  state;
  constructor(ndk, event) {
    super();
    if (!ndk)
      throw new Error("no ndk instance");
    this.ndk = ndk;
    if (!event) {
      event = new import_ndk14.NDKEvent(ndk);
      event.kind = import_ndk14.NDKKind.CashuWallet;
      event.dTag = Math.random().toString(36).substring(3);
      event.tags = [];
    }
    this.event = event;
    this.ndk = ndk;
    this.paymentHandler = new PaymentHandler(this);
    this.state = new WalletState(this);
  }
  /**
   * Creates a new NIP-60 wallet
   * @param ndk 
   * @param mints 
   * @param relayUrls 
   * @returns 
   */
  static create(ndk, mints = [], relayUrls = []) {
    const wallet = new _NDKCashuWallet(ndk);
    wallet.mints = mints;
    wallet.relays = relayUrls;
    return wallet;
  }
  set event(e) {
    this.walletId = e?.dTag ?? "";
    this._event = e;
  }
  get event() {
    return this._event;
  }
  tagId() {
    return this.event?.tagId();
  }
  /**
   * Returns the tokens that are available for spending
   */
  get availableTokens() {
    return this.tokens.filter((t) => !this.usedTokenIds.has(t.id));
  }
  /**
   * Adds a token to the list of used tokens
   * to make sure it's proofs are no longer available
   */
  addUsedTokens(token) {
    for (const t of token) {
      this.usedTokenIds.add(t.id);
    }
    this.emit("balance_updated");
  }
  checkProofs = consolidateTokens.bind(this);
  consolidateTokens = consolidateTokens.bind(this);
  toLoadingString() {
    return JSON.stringify({
      type: "nip60",
      bech32: this.event.encode()
    });
  }
  async mintNuts(amounts, unit) {
    let result;
    const totalAmount = amounts.reduce((acc, amount) => acc + amount, 0);
    for (const mint of this.mints) {
      const wallet = await this.cashuWallet(mint);
      const mintProofs = await this.proofsForMint(mint);
      result = await wallet.send(totalAmount, mintProofs, {
        proofsWeHave: mintProofs,
        includeFees: true,
        outputAmounts: {
          sendAmounts: amounts
        }
      });
      if (result.send.length > 0)
        break;
    }
    return result;
  }
  static async from(event) {
    if (!event.ndk)
      throw new Error("no ndk instance on event");
    const wallet = new _NDKCashuWallet(event.ndk, event);
    if (!wallet.event)
      return;
    if (wallet.isDeleted)
      return;
    const prevContent = wallet.event.content;
    wallet.publicTags = wallet.event.tags;
    try {
      await decrypt(wallet.event);
      wallet.privateTags = JSON.parse(wallet.event.content);
    } catch (e) {
      try {
        wallet.privateTags = JSON.parse(wallet.event.content);
      } catch (e2) {
        throw e2;
      }
    }
    wallet.event.content ??= prevContent;
    await wallet.getP2pk();
    return wallet;
  }
  /**
   * Starts monitoring the wallet
   */
  start(opts) {
    const pubkey = opts?.pubkey ?? this.event?.pubkey;
    if (!pubkey)
      throw new Error("no pubkey");
    console.log("start %s", this.walletId);
    const filters = [
      { kinds: [import_ndk14.NDKKind.CashuToken], authors: [pubkey], ...this.event?.filter() },
      { kinds: [import_ndk14.NDKKind.WalletChange], authors: [pubkey] },
      { kinds: [import_ndk14.NDKKind.CashuQuote], authors: [pubkey] },
      { kinds: [import_ndk14.NDKKind.EventDeletion], authors: [pubkey], "#k": [import_ndk14.NDKKind.CashuToken.toString()] }
    ];
    if (this.event) {
      filters[0] = { ...filters[0], ...this.event.filter() };
      filters[1] = { ...filters[1], ...this.event.filter() };
      filters[2] = { ...filters[2], ...this.event.filter() };
    }
    this.sub = this.ndk.subscribe(filters, opts, this.relaySet, false);
    this.sub.on("event", eventHandler.bind(this));
    this.sub.on("eose", () => {
      this.emit("ready");
    });
    this.sub.start();
  }
  stop() {
    this.sub?.stop();
  }
  get allTags() {
    return this.privateTags.concat(this.publicTags);
  }
  setPrivateTag(name, value) {
    this.privateTags = this.privateTags.filter((t) => t[0] !== name);
    if (Array.isArray(value)) {
      for (const v of value) {
        this.privateTags.push([name, v]);
      }
    } else {
      this.privateTags.push([name, value]);
    }
  }
  getPrivateTags(name) {
    return this.privateTags.filter((t) => t[0] === name).map((t) => t[1]).flat();
  }
  getPrivateTag(name) {
    return this.privateTags.find((t) => t[0] === name)?.[1];
  }
  setPublicTag(name, value) {
    this.publicTags = this.publicTags.filter((t) => t[0] !== name);
    if (Array.isArray(value)) {
      for (const v of value) {
        this.publicTags.push([name, v]);
      }
    } else {
      this.publicTags.push([name, value]);
    }
  }
  getPublicTags(name) {
    return this.publicTags.filter((t) => t[0] === name).map((t) => t[1]);
  }
  set relays(urls) {
    this.setPrivateTag("relay", urls);
  }
  get relays() {
    return this.getPrivateTags("relay");
  }
  set mints(urls) {
    this.setPublicTag("mint", urls);
  }
  get mints() {
    return this.getPublicTags("mint");
  }
  set name(value) {
    this.setPublicTag("name", value);
  }
  get name() {
    return this.getPrivateTag("name") ?? this.event?.tagValue("name");
  }
  get unit() {
    return this.getPrivateTag("unit") ?? "sats";
  }
  set unit(unit) {
    this.setPrivateTag("unit", unit);
  }
  /**
   * Returns the p2pk of this wallet or generates a new one if we don't have one
   */
  async getP2pk() {
    if (this.p2pk)
      return this.p2pk;
    let signer;
    if (this.privkey) {
      signer = new import_ndk14.NDKPrivateKeySigner(this.privkey);
    } else {
      signer = import_ndk14.NDKPrivateKeySigner.generate();
      this.privkey = signer.privateKey;
    }
    const user = await signer.user();
    this.p2pk = user.pubkey;
    return this.p2pk;
  }
  get privkeyUint8Array() {
    const privkey = this.getPrivateTag("privkey");
    if (privkey)
      return new TextEncoder().encode(privkey);
  }
  /**
   * Returns the private key of this wallet
   */
  get privkey() {
    const privkey = this.getPrivateTag("privkey");
    if (privkey)
      return privkey;
  }
  set privkey(privkey) {
    if (privkey) {
      this.setPrivateTag("privkey", privkey ?? false);
    } else {
      this.skipPrivateKey = privkey === false;
      this.p2pk = void 0;
    }
  }
  /**
   * Whether this wallet has been deleted
   */
  get isDeleted() {
    if (!this.event?.tags)
      return false;
    return this.event.tags.some((t) => t[0] === "deleted");
  }
  async publish() {
    if (!this.event)
      throw new Error("wallet event not available");
    if (!this.isDeleted) {
      if (!this.skipPrivateKey && !this.privkey) {
        const signer = import_ndk14.NDKPrivateKeySigner.generate();
        this.privkey = signer.privateKey;
      }
      this.event.tags = this.publicTags;
      for (const tag of this.event.tags) {
        if (tag[0] === "privkey") {
          throw new Error("privkey should not be in public tags!");
        }
      }
      this.event.content = JSON.stringify(this.privateTags);
      const user = await this.ndk.signer.user();
      await this.event.encrypt(user, void 0, "nip44");
    }
    return this.event.publishReplaceable(this.relaySet);
  }
  get relaySet() {
    if (!this.event)
      return void 0;
    if (this.relays.length === 0)
      return void 0;
    return import_ndk14.NDKRelaySet.fromRelayUrls(this.relays, this.ndk);
  }
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
  deposit(amount, mint, unit) {
    console.log("[WALLET DEPOSIT] creating deposit", { amount, mint, unit });
    const deposit = new NDKCashuDeposit(this, amount, mint, unit);
    deposit.on("success", (token) => {
      this.addToken(token);
    });
    return deposit;
  }
  /**
   * Receives a token and adds it to the wallet
   * @param token
   * @returns the token event that was created
   */
  async receiveToken(token, description) {
    let { mint, unit } = (0, import_cashu_ts5.getDecodedToken)(token);
    const wallet = await this.cashuWallet(mint);
    const proofs = await wallet.receive(token);
    const updateRes = await this.state.update({
      store: proofs,
      mint
    });
    const tokenEvent = updateRes.created;
    if (tokenEvent)
      this.addToken(tokenEvent);
    unit ??= this.unit;
    createInTxEvent(this, proofs, unit, mint, updateRes, { description });
    return tokenEvent;
  }
  /**
   * Pay a LN invoice with this wallet
   */
  async lnPay(payment, createTxEvent = true) {
    return this.paymentHandler.lnPay(payment, createTxEvent);
  }
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
  async cashuPay(payment) {
    return this.paymentHandler.cashuPay(payment);
  }
  /**
   * Returns a map of the proof C values to the token where it was found
   * @param mint 
   * @returns 
   */
  getAllMintProofTokens(mint) {
    const allMintProofs = /* @__PURE__ */ new Map();
    this.tokens.filter((t) => mint ? t.mint === mint : true).forEach((t) => {
      t.proofs.forEach((p) => {
        allMintProofs.set(p.C, t);
      });
    });
    return allMintProofs;
  }
  wallets = /* @__PURE__ */ new Map();
  async cashuWallet(mint) {
    if (this.wallets.has(mint))
      return this.wallets.get(mint);
    const w = await walletForMint(mint, this.unit);
    if (!w)
      throw new Error("unable to load wallet for mint " + mint);
    this.wallets.set(mint, w);
    return w;
  }
  // TODO: this is not efficient, we should use a set
  hasProof(secret) {
    return this.tokens.some((t) => t.proofs.some((p) => p.secret === secret));
  }
  /**
   * Returns all proofs for a given mint
   * @param mint 
   * @returns 
   */
  proofsForMint(mint) {
    mint = (0, import_ndk14.normalizeUrl)(mint);
    return this.tokens.filter((t) => t.mint === mint).map((t) => t.proofs).flat();
  }
  async redeemNutzap(nutzap, { onRedeemed, onTxEventCreated }) {
    const user = this.ndk.activeUser;
    if (!user)
      throw new Error("no active user");
    let privkey = this.privkey;
    if (nutzap.p2pk === user.pubkey) {
      if (this.ndk.signer instanceof import_ndk14.NDKPrivateKeySigner)
        privkey = this.ndk.signer.privateKey;
      else {
        throw new Error("nutzap p2pk to the active user directly and we don't have access to the private key; login with your nsec to redeem this nutzap");
      }
    }
    try {
      const mint = nutzap.mint;
      const proofs = nutzap.proofs;
      if (!mint)
        throw new Error("missing mint");
      const _wallet = await this.cashuWallet(mint);
      const proofsWeHave = this.proofsForMint(mint);
      const res = await _wallet.receive(
        { proofs, mint },
        { proofsWeHave, privkey }
      );
      d6("redeemed nutzap %o", nutzap.rawEvent());
      onRedeemed?.(res);
      const receivedAmount = proofs.reduce((acc, proof) => acc + proof.amount, 0);
      const redeemedAmount = res.reduce((acc, proof) => acc + proof.amount, 0);
      const fee = receivedAmount - redeemedAmount;
      const updateRes = await this.state.update({
        store: res,
        mint
      });
      const txEvent = await createInTxEvent(this, res, nutzap.unit, mint, updateRes, { nutzap, fee });
      onTxEventCreated?.(txEvent);
    } catch (e) {
      console.trace(e);
    }
  }
  /**
   * Updates the internal state to add a token,
   * there is no change published anywhere when calling this function.
   */
  addToken(token) {
    if (!token.mint)
      throw new Error("token " + token.encode() + " has no mint");
    if (this.knownTokens.has(token.id)) {
      const stackTrace = new Error().stack;
      d6("Refusing to add the same token twice", token.id, stackTrace);
      return false;
    }
    const allMintProofs = this.getAllMintProofTokens(token.mint);
    for (const proof of token.proofs) {
      if (allMintProofs.has(proof.C)) {
        const collidingToken = allMintProofs.get(proof.C);
        if (!collidingToken) {
          console.trace("BUG: unable to find colliding token", {
            token: token.id,
            proof: proof.C
          });
          throw new Error("BUG: unable to find colliding token");
        }
        if (token.created_at <= collidingToken.created_at) {
          console.log("skipping adding requested token since we have a newer token with the same proof", {
            requestedTokenId: token.id,
            relay: token.onRelays.map((r) => r.url)
          });
          this.warn("Received an older token with proofs that were already known, this is likely a relay that didn't receive (or respected) a delete event", token);
          return false;
        }
        this.removeTokenId(collidingToken.id);
      }
    }
    if (!this.knownTokens.has(token.id)) {
      this.knownTokens.add(token.id);
      this.tokens.push(token);
      this.emit("balance_updated");
    }
    return true;
  }
  warn(msg, event, relays) {
    relays ??= event?.onRelays;
    this.warnings.push({ msg, event, relays });
    this.emit("warning", { msg, event, relays });
  }
  /**
   * Removes a token that has been deleted
   */
  removeTokenId(id) {
    if (!this.knownTokens.has(id)) {
      return false;
    }
    this.tokens = this.tokens.filter((t) => t.id !== id);
    this.emit("balance_updated");
  }
  /**
   * Deletes this wallet
   */
  async delete(reason, publish = true) {
    if (!this.event)
      throw new Error("wallet event not available");
    this.event.content = "";
    this.event.tags = [["d", this.walletId], ["deleted"]];
    if (publish)
      this.event.publishReplaceable();
    return this.event.delete(reason, publish);
  }
  /**
   * Gets all tokens, grouped by mint
   */
  get mintTokens() {
    const tokens = {};
    for (const token of this.tokens) {
      if (token.mint) {
        tokens[token.mint] ??= [];
        tokens[token.mint].push(token);
      }
    }
    return tokens;
  }
  balance() {
    if (this.status === "loading" /* LOADING */) {
      const balance = this.getPrivateTag("balance");
      if (balance)
        return [
          {
            amount: Number(balance),
            unit: this.unit
          }
        ];
    }
    const proofBalances = proofsTotalBalance(this.tokens.map((t) => t.proofs).flat());
    return [
      {
        amount: proofBalances,
        unit: this.unit
      }
    ];
  }
  /**
   * Writes the wallet balance to relays
   */
  async syncBalance() {
    const balance = (await this.balance())?.[0].amount;
    if (!balance)
      return;
    this.setPrivateTag("balance", balance.toString() ?? "0");
    console.log("publishing balance (%d)", balance);
    this.publish();
  }
  mintBalance(mint) {
    return proofsTotalBalance(
      this.tokens.filter((t) => t.mint === mint).map((t) => t.proofs).flat()
    );
  }
  get mintBalances() {
    const balances = {};
    for (const token of this.tokens) {
      if (token.mint) {
        balances[token.mint] ??= 0;
        balances[token.mint] += token.amount;
      }
    }
    return balances;
  }
  getMintsWithBalance(amount) {
    return Object.entries(this.mintBalances).filter(([_, balance]) => balance >= amount).map(([mint]) => mint);
  }
};

// src/wallets/index.ts
var NDKWalletStatus = /* @__PURE__ */ ((NDKWalletStatus2) => {
  NDKWalletStatus2["INITIAL"] = "initial";
  NDKWalletStatus2["LOADING"] = "loading";
  NDKWalletStatus2["READY"] = "ready";
  NDKWalletStatus2["FAILED"] = "failed";
  return NDKWalletStatus2;
})(NDKWalletStatus || {});
async function walletFromLoadingString(ndk, str) {
  const payload = JSON.parse(str);
  switch (payload.type) {
    case "nwc":
      const w = new NDKNWCWallet(ndk);
      await w.initWithPairingCode(payload.pairingCode);
      return w;
    case "nip60":
      const event = await ndk.fetchEvent(payload.bech32);
      if (!event)
        return void 0;
      return await NDKCashuWallet.from(event);
  }
}

// src/wallets/cashu/mint/utils.ts
var import_ndk15 = require("@nostr-dev-kit/ndk");
async function getCashuMintRecommendations(ndk, filter) {
  const f = [
    { kinds: [import_ndk15.NDKKind.EcashMintRecommendation], "#k": ["38002"], ...filter || {} },
    { kinds: [import_ndk15.NDKKind.CashuMintList], ...filter || {} }
  ];
  const res = {};
  const recommendations = await ndk.fetchEvents(f);
  for (const event of recommendations) {
    switch (event.kind) {
      case import_ndk15.NDKKind.EcashMintRecommendation:
        for (const uTag of event.getMatchingTags("u")) {
          if (uTag[2] && uTag[2] !== "cashu")
            continue;
          const url = uTag[1];
          if (!url)
            continue;
          const entry = res[url] || { events: [], pubkeys: /* @__PURE__ */ new Set() };
          entry.events.push(event);
          entry.pubkeys.add(event.pubkey);
          res[url] = entry;
        }
        break;
      case import_ndk15.NDKKind.CashuMintList:
        for (const mintTag of event.getMatchingTags("mint")) {
          const url = mintTag[1];
          if (!url)
            continue;
          const entry = res[url] || { events: [], pubkeys: /* @__PURE__ */ new Set() };
          entry.events.push(event);
          entry.pubkeys.add(event.pubkey);
          res[url] = entry;
        }
        break;
    }
  }
  return res;
}

// src/wallets/webln/index.ts
var import_tseep6 = require("tseep");
var import_webln = require("webln");

// src/wallets/webln/pay.ts
var import_cashu_ts6 = require("@cashu/cashu-ts");
var NDKLnPay = class {
  wallet;
  info;
  type = "ln";
  constructor(wallet, info) {
    this.wallet = wallet;
    this.info = info;
  }
  async pay() {
    if (this.type === "ln") {
      return this.payLn();
    } else {
      return this.payNut();
    }
  }
  /**
   * Uses LN balance to pay to a mint
   */
  async payNut() {
    const { mints, p2pk } = this.info;
    let { amount, unit } = this.info;
    if (unit === "msat") {
      amount /= 1e3;
      unit = "sat";
    }
    const quotesPromises = mints.map(async (mint2) => {
      const wallet2 = new import_cashu_ts6.CashuWallet(new import_cashu_ts6.CashuMint(mint2), { unit });
      const quote2 = await wallet2.createMintQuote(amount);
      return { quote: quote2, mint: mint2 };
    });
    const { quote, mint } = await Promise.any(quotesPromises);
    if (!quote) {
      console.warn("failed to get quote from any mint");
      throw new Error("failed to get quote from any mint");
    }
    const res = await this.wallet.pay({ pr: quote.request });
    console.log("payment result", res);
    if (!res) {
      console.warn("payment failed");
      throw new Error("payment failed");
    }
    const wallet = new import_cashu_ts6.CashuWallet(new import_cashu_ts6.CashuMint(mint), { unit });
    const { proofs } = await wallet.mintTokens(amount, quote.quote, {
      pubkey: p2pk
    });
    console.warn("minted tokens with proofs %o", proofs);
    return { proofs, mint };
  }
  /**
   * Straightforward; uses LN balance to pay a LN invoice
   */
  async payLn() {
    const data = this.info;
    if (!data.pr)
      throw new Error("missing pr");
    let paid = false;
    const ret = await this.wallet.pay(data);
    return ret ? ret.preimage : void 0;
  }
};

// src/wallets/webln/index.ts
var NDKWebLNWallet = class extends import_tseep6.EventEmitter {
  type = "webln";
  walletId = "webln";
  status = "initial" /* INITIAL */;
  provider;
  _balance;
  constructor() {
    super();
    (0, import_webln.requestProvider)().then((p) => {
      if (p) {
        this.provider = p;
        this.status = "ready" /* READY */;
        this.emit("ready");
      } else {
        this.status = "failed" /* FAILED */;
      }
    }).catch(() => this.status = "failed" /* FAILED */);
  }
  async pay(payment) {
    if (!this.provider)
      throw new Error("Provider not ready");
    return this.provider.sendPayment(payment.pr);
  }
  async lnPay(payment) {
    const pay = new NDKLnPay(this, payment);
    const preimage = await pay.payLn();
    if (!preimage)
      return;
    return { preimage };
  }
  async cashuPay(payment) {
    const pay = new NDKLnPay(this, payment);
    return pay.payNut();
  }
  async updateBalance() {
    if (!this.provider) {
      return new Promise((resolve) => {
        this.once("ready", () => {
          resolve();
        });
      });
    }
    const b = await this.provider.getBalance?.();
    if (b)
      this._balance = [{ amount: b.balance, unit: b.currency || "sats" }];
    return;
  }
  balance() {
    if (!this.provider) {
      return void 0;
    }
    return this._balance;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  NDKCashuDeposit,
  NDKCashuToken,
  NDKCashuWallet,
  NDKNWCWallet,
  NDKNutzapMonitor,
  NDKWalletChange,
  NDKWalletStatus,
  NDKWebLNWallet,
  getBolt11Amount,
  getBolt11Description,
  getBolt11ExpiresAt,
  getCashuMintRecommendations,
  proofsTotalBalance,
  walletFromLoadingString
});

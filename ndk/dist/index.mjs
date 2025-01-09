// src/relay/pool/index.ts
import { EventEmitter as EventEmitter3 } from "tseep";

// src/relay/index.ts
import debug from "debug";
import { EventEmitter as EventEmitter2 } from "tseep";

// src/events/index.ts
import { EventEmitter } from "tseep";

// src/outbox/write.ts
function getRelaysForSync(ndk, author, type = "write") {
  if (!ndk.outboxTracker) return void 0;
  const item = ndk.outboxTracker.data.get(author);
  if (!item) return void 0;
  if (type === "write") {
    return item.writeRelays;
  } else {
    return item.readRelays;
  }
}
async function getWriteRelaysFor(ndk, author, type = "write") {
  if (!ndk.outboxTracker) return void 0;
  if (!ndk.outboxTracker.data.has(author)) {
    await ndk.outboxTracker.trackUsers([author]);
  }
  return getRelaysForSync(ndk, author, type);
}

// src/outbox/relay-ranking.ts
function getTopRelaysForAuthors(ndk, authors) {
  const relaysWithCount = /* @__PURE__ */ new Map();
  authors.forEach((author) => {
    const writeRelays = getRelaysForSync(ndk, author);
    if (writeRelays) {
      writeRelays.forEach((relay) => {
        const count = relaysWithCount.get(relay) || 0;
        relaysWithCount.set(relay, count + 1);
      });
    }
  });
  const sortedRelays = Array.from(relaysWithCount.entries()).sort((a, b) => b[1] - a[1]);
  return sortedRelays.map((entry) => entry[0]);
}

// src/outbox/index.ts
function getAllRelaysForAllPubkeys(ndk, pubkeys, type = "read") {
  const pubkeysToRelays = /* @__PURE__ */ new Map();
  const authorsMissingRelays = /* @__PURE__ */ new Set();
  pubkeys.forEach((pubkey) => {
    const relays = getRelaysForSync(ndk, pubkey, type);
    if (relays && relays.size > 0) {
      relays.forEach((relay) => {
        const pubkeysInRelay = pubkeysToRelays.get(relay) || /* @__PURE__ */ new Set();
        pubkeysInRelay.add(pubkey);
      });
      pubkeysToRelays.set(pubkey, relays);
    } else {
      authorsMissingRelays.add(pubkey);
    }
  });
  return { pubkeysToRelays, authorsMissingRelays };
}
function chooseRelayCombinationForPubkeys(ndk, pubkeys, type, { count, preferredRelays } = {}) {
  count ??= 2;
  preferredRelays ??= /* @__PURE__ */ new Set();
  const pool = ndk.pool;
  const connectedRelays = pool.connectedRelays();
  connectedRelays.forEach((relay) => {
    preferredRelays.add(relay.url);
  });
  const relayToAuthorsMap = /* @__PURE__ */ new Map();
  const { pubkeysToRelays, authorsMissingRelays } = getAllRelaysForAllPubkeys(ndk, pubkeys, type);
  const sortedRelays = getTopRelaysForAuthors(ndk, pubkeys);
  const addAuthorToRelay = (author, relay) => {
    const authorsInRelay = relayToAuthorsMap.get(relay) || [];
    authorsInRelay.push(author);
    relayToAuthorsMap.set(relay, authorsInRelay);
  };
  for (const [author, authorRelays] of pubkeysToRelays.entries()) {
    let missingRelayCount = count;
    for (const relay of connectedRelays) {
      if (authorRelays.has(relay.url)) {
        addAuthorToRelay(author, relay.url);
        missingRelayCount--;
      }
    }
    for (const authorRelay of authorRelays) {
      if (relayToAuthorsMap.has(authorRelay)) {
        addAuthorToRelay(author, authorRelay);
        missingRelayCount--;
      }
    }
    if (missingRelayCount <= 0) continue;
    for (const relay of sortedRelays) {
      if (missingRelayCount <= 0) break;
      if (authorRelays.has(relay)) {
        addAuthorToRelay(author, relay);
        missingRelayCount--;
      }
    }
  }
  for (const author of authorsMissingRelays) {
    pool.permanentAndConnectedRelays().forEach((relay) => {
      const authorsInRelay = relayToAuthorsMap.get(relay.url) || [];
      authorsInRelay.push(author);
      relayToAuthorsMap.set(relay.url, authorsInRelay);
    });
  }
  return relayToAuthorsMap;
}

// src/outbox/read/with-authors.ts
function getRelaysForFilterWithAuthors(ndk, authors, relayGoalPerAuthor = 2) {
  return chooseRelayCombinationForPubkeys(ndk, authors, "write", { count: relayGoalPerAuthor });
}

// src/utils/normalize-url.ts
function tryNormalizeRelayUrl(url) {
  try {
    return normalizeRelayUrl(url);
  } catch {
    return void 0;
  }
}
function normalizeRelayUrl(url) {
  let r = normalizeUrl(url.toLowerCase(), {
    stripAuthentication: false,
    stripWWW: false,
    stripHash: true
  });
  if (!r.endsWith("/")) {
    r += "/";
  }
  return r;
}
function normalize(urls) {
  const normalized = /* @__PURE__ */ new Set();
  for (const url of urls) {
    try {
      normalized.add(normalizeRelayUrl(url));
    } catch {
    }
  }
  return Array.from(normalized);
}
var DATA_URL_DEFAULT_MIME_TYPE = "text/plain";
var DATA_URL_DEFAULT_CHARSET = "us-ascii";
var testParameter = (name, filters) => filters.some((filter) => filter instanceof RegExp ? filter.test(name) : filter === name);
var supportedProtocols = /* @__PURE__ */ new Set(["https:", "http:", "file:"]);
var hasCustomProtocol = (urlString) => {
  try {
    const { protocol } = new URL(urlString);
    return protocol.endsWith(":") && !protocol.includes(".") && !supportedProtocols.has(protocol);
  } catch {
    return false;
  }
};
var normalizeDataURL = (urlString, { stripHash }) => {
  const match = /^data:(?<type>[^,]*?),(?<data>[^#]*?)(?:#(?<hash>.*))?$/.exec(urlString);
  if (!match) {
    throw new Error(`Invalid URL: ${urlString}`);
  }
  let type = match.groups?.type ?? "";
  let data = match.groups?.data ?? "";
  let hash = match.groups?.hash ?? "";
  const mediaType = type.split(";");
  hash = stripHash ? "" : hash;
  let isBase64 = false;
  if (mediaType[mediaType.length - 1] === "base64") {
    mediaType.pop();
    isBase64 = true;
  }
  const mimeType = mediaType.shift()?.toLowerCase() ?? "";
  const attributes = mediaType.map((attribute) => {
    let [key, value = ""] = attribute.split("=").map((string) => string.trim());
    if (key === "charset") {
      value = value.toLowerCase();
      if (value === DATA_URL_DEFAULT_CHARSET) {
        return "";
      }
    }
    return `${key}${value ? `=${value}` : ""}`;
  }).filter(Boolean);
  const normalizedMediaType = [...attributes];
  if (isBase64) {
    normalizedMediaType.push("base64");
  }
  if (normalizedMediaType.length > 0 || mimeType && mimeType !== DATA_URL_DEFAULT_MIME_TYPE) {
    normalizedMediaType.unshift(mimeType);
  }
  return `data:${normalizedMediaType.join(";")},${isBase64 ? data.trim() : data}${hash ? `#${hash}` : ""}`;
};
function normalizeUrl(urlString, options = {}) {
  options = {
    defaultProtocol: "http",
    normalizeProtocol: true,
    forceHttp: false,
    forceHttps: false,
    stripAuthentication: true,
    stripHash: false,
    stripTextFragment: true,
    stripWWW: true,
    removeQueryParameters: [/^utm_\w+/i],
    removeTrailingSlash: true,
    removeSingleSlash: true,
    removeDirectoryIndex: false,
    removeExplicitPort: false,
    sortQueryParameters: true,
    ...options
  };
  if (typeof options.defaultProtocol === "string" && !options.defaultProtocol.endsWith(":")) {
    options.defaultProtocol = `${options.defaultProtocol}:`;
  }
  urlString = urlString.trim();
  if (/^data:/i.test(urlString)) {
    return normalizeDataURL(urlString, options);
  }
  if (hasCustomProtocol(urlString)) {
    return urlString;
  }
  const hasRelativeProtocol = urlString.startsWith("//");
  const isRelativeUrl = !hasRelativeProtocol && /^\.*\//.test(urlString);
  if (!isRelativeUrl) {
    urlString = urlString.replace(/^(?!(?:\w+:)?\/\/)|^\/\//, options.defaultProtocol);
  }
  const urlObject = new URL(urlString);
  if (options.forceHttp && options.forceHttps) {
    throw new Error("The `forceHttp` and `forceHttps` options cannot be used together");
  }
  if (options.forceHttp && urlObject.protocol === "https:") {
    urlObject.protocol = "http:";
  }
  if (options.forceHttps && urlObject.protocol === "http:") {
    urlObject.protocol = "https:";
  }
  if (options.stripAuthentication) {
    urlObject.username = "";
    urlObject.password = "";
  }
  if (options.stripHash) {
    urlObject.hash = "";
  } else if (options.stripTextFragment) {
    urlObject.hash = urlObject.hash.replace(/#?:~:text.*?$/i, "");
  }
  if (urlObject.pathname) {
    const protocolRegex = /\b[a-z][a-z\d+\-.]{1,50}:\/\//g;
    let lastIndex = 0;
    let result = "";
    for (; ; ) {
      const match = protocolRegex.exec(urlObject.pathname);
      if (!match) {
        break;
      }
      const protocol = match[0];
      const protocolAtIndex = match.index;
      const intermediate = urlObject.pathname.slice(lastIndex, protocolAtIndex);
      result += intermediate.replace(/\/{2,}/g, "/");
      result += protocol;
      lastIndex = protocolAtIndex + protocol.length;
    }
    const remnant = urlObject.pathname.slice(lastIndex, urlObject.pathname.length);
    result += remnant.replace(/\/{2,}/g, "/");
    urlObject.pathname = result;
  }
  if (urlObject.pathname) {
    try {
      urlObject.pathname = decodeURI(urlObject.pathname);
    } catch {
    }
  }
  if (options.removeDirectoryIndex === true) {
    options.removeDirectoryIndex = [/^index\.[a-z]+$/];
  }
  if (Array.isArray(options.removeDirectoryIndex) && options.removeDirectoryIndex.length > 0) {
    let pathComponents = urlObject.pathname.split("/");
    const lastComponent = pathComponents[pathComponents.length - 1];
    if (testParameter(lastComponent, options.removeDirectoryIndex)) {
      pathComponents = pathComponents.slice(0, -1);
      urlObject.pathname = pathComponents.slice(1).join("/") + "/";
    }
  }
  if (urlObject.hostname) {
    urlObject.hostname = urlObject.hostname.replace(/\.$/, "");
    if (options.stripWWW && /^www\.(?!www\.)[a-z\-\d]{1,63}\.[a-z.\-\d]{2,63}$/.test(urlObject.hostname)) {
      urlObject.hostname = urlObject.hostname.replace(/^www\./, "");
    }
  }
  if (Array.isArray(options.removeQueryParameters)) {
    for (const key of [...urlObject.searchParams.keys()]) {
      if (testParameter(key, options.removeQueryParameters)) {
        urlObject.searchParams.delete(key);
      }
    }
  }
  if (!Array.isArray(options.keepQueryParameters) && options.removeQueryParameters === true) {
    urlObject.search = "";
  }
  if (Array.isArray(options.keepQueryParameters) && options.keepQueryParameters.length > 0) {
    for (const key of [...urlObject.searchParams.keys()]) {
      if (!testParameter(key, options.keepQueryParameters)) {
        urlObject.searchParams.delete(key);
      }
    }
  }
  if (options.sortQueryParameters) {
    urlObject.searchParams.sort();
    try {
      urlObject.search = decodeURIComponent(urlObject.search);
    } catch {
    }
  }
  if (options.removeTrailingSlash) {
    urlObject.pathname = urlObject.pathname.replace(/\/$/, "");
  }
  if (options.removeExplicitPort && urlObject.port) {
    urlObject.port = "";
  }
  const oldUrlString = urlString;
  urlString = urlObject.toString();
  if (!options.removeSingleSlash && urlObject.pathname === "/" && !oldUrlString.endsWith("/") && urlObject.hash === "") {
    urlString = urlString.replace(/\/$/, "");
  }
  if ((options.removeTrailingSlash || urlObject.pathname === "/") && urlObject.hash === "" && options.removeSingleSlash) {
    urlString = urlString.replace(/\/$/, "");
  }
  if (hasRelativeProtocol && !options.normalizeProtocol) {
    urlString = urlString.replace(/^http:\/\//, "//");
  }
  if (options.stripProtocol) {
    urlString = urlString.replace(/^(?:https?:)?\/\//, "");
  }
  return urlString;
}

// src/relay/sets/index.ts
var NDKPublishError = class extends Error {
  errors;
  publishedToRelays;
  /**
   * Intended relay set where the publishing was intended to happen.
   */
  intendedRelaySet;
  constructor(message, errors, publishedToRelays, intendedRelaySet) {
    super(message);
    this.errors = errors;
    this.publishedToRelays = publishedToRelays;
    this.intendedRelaySet = intendedRelaySet;
  }
  get relayErrors() {
    const errors = [];
    for (const [relay, err] of this.errors) {
      errors.push(`${relay.url}: ${err}`);
    }
    return errors.join("\n");
  }
};
var NDKRelaySet = class _NDKRelaySet {
  relays;
  debug;
  ndk;
  pool;
  constructor(relays, ndk, pool) {
    this.relays = relays;
    this.ndk = ndk;
    this.pool = pool ?? ndk.pool;
    this.debug = ndk.debug.extend("relayset");
  }
  /**
   * Adds a relay to this set.
   */
  addRelay(relay) {
    this.relays.add(relay);
  }
  get relayUrls() {
    return Array.from(this.relays).map((r) => r.url);
  }
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
  static fromRelayUrls(relayUrls, ndk, connect = true, pool) {
    pool = pool ?? ndk.pool;
    if (!pool) throw new Error("No pool provided");
    const relays = /* @__PURE__ */ new Set();
    for (const url of relayUrls) {
      const relay = pool.relays.get(normalizeRelayUrl(url));
      if (relay) {
        if (relay.status < 5 /* CONNECTED */ && connect) {
          relay.connect();
        }
        relays.add(relay);
      } else {
        const temporaryRelay = new NDKRelay(
          normalizeRelayUrl(url),
          ndk?.relayAuthDefaultPolicy,
          ndk
        );
        pool.useTemporaryRelay(
          temporaryRelay,
          void 0,
          "requested from fromRelayUrls " + relayUrls
        );
        relays.add(temporaryRelay);
      }
    }
    return new _NDKRelaySet(new Set(relays), ndk, pool);
  }
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
  async publish(event, timeoutMs, requiredRelayCount = 1) {
    const publishedToRelays = /* @__PURE__ */ new Set();
    const errors = /* @__PURE__ */ new Map();
    const isEphemeral2 = event.isEphemeral();
    event.publishStatus = "pending";
    const promises = Array.from(this.relays).map((relay) => {
      return new Promise((resolve) => {
        relay.publish(event, timeoutMs).then((e) => {
          publishedToRelays.add(relay);
          resolve();
        }).catch((err) => {
          if (!isEphemeral2) {
            errors.set(relay, err);
          }
          resolve();
        });
      });
    });
    await Promise.all(promises);
    if (publishedToRelays.size < requiredRelayCount) {
      if (!isEphemeral2) {
        const error = new NDKPublishError(
          "Not enough relays received the event",
          errors,
          publishedToRelays,
          this
        );
        event.publishStatus = "error";
        event.publishError = error;
        this.ndk.emit("event:publish-failed", event, error, this.relayUrls);
        throw error;
      }
    } else {
      event.emit("published", { relaySet: this, publishedToRelays });
    }
    return publishedToRelays;
  }
  get size() {
    return this.relays.size;
  }
};

// src/relay/sets/calculate.ts
import createDebug from "debug";
var d = createDebug("ndk:outbox:calculate");
async function calculateRelaySetFromEvent(ndk, event) {
  const relays = /* @__PURE__ */ new Set();
  const authorWriteRelays = await getWriteRelaysFor(ndk, event.pubkey);
  if (authorWriteRelays) {
    authorWriteRelays.forEach((relayUrl) => {
      const relay = ndk.pool?.getRelay(relayUrl);
      if (relay) relays.add(relay);
    });
  }
  let relayHints = event.tags.filter((tag) => ["a", "e"].includes(tag[0])).map((tag) => tag[2]).filter((url) => url && url.startsWith("wss://")).filter((url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }).map((url) => normalizeRelayUrl(url));
  relayHints = Array.from(new Set(relayHints)).slice(0, 5);
  relayHints.forEach((relayUrl) => {
    const relay = ndk.pool?.getRelay(relayUrl, true, true);
    if (relay) {
      d("Adding relay hint %s", relayUrl);
      relays.add(relay);
    }
  });
  const pTags = event.getMatchingTags("p").map((tag) => tag[1]);
  if (pTags.length < 5) {
    const pTaggedRelays = Array.from(
      chooseRelayCombinationForPubkeys(ndk, pTags, "read", {
        preferredRelays: new Set(authorWriteRelays)
      }).keys()
    );
    pTaggedRelays.forEach((relayUrl) => {
      const relay = ndk.pool?.getRelay(relayUrl, false, true);
      if (relay) {
        d("Adding p-tagged relay %s", relayUrl);
        relays.add(relay);
      }
    });
  } else {
    d("Too many p-tags to consider %d", pTags.length);
  }
  ndk.pool?.permanentAndConnectedRelays().forEach((relay) => relays.add(relay));
  return new NDKRelaySet(relays, ndk);
}
function calculateRelaySetsFromFilter(ndk, filters, pool) {
  const result = /* @__PURE__ */ new Map();
  const authors = /* @__PURE__ */ new Set();
  filters.forEach((filter) => {
    if (filter.authors) {
      filter.authors.forEach((author) => authors.add(author));
    }
  });
  if (authors.size > 0) {
    const authorToRelaysMap = getRelaysForFilterWithAuthors(ndk, Array.from(authors));
    for (const relayUrl of authorToRelaysMap.keys()) {
      result.set(relayUrl, []);
    }
    for (const filter of filters) {
      if (filter.authors) {
        for (const [relayUrl, authors2] of authorToRelaysMap.entries()) {
          const authorFilterAndRelayPubkeyIntersection = filter.authors.filter(
            (author) => authors2.includes(author)
          );
          result.set(relayUrl, [
            ...result.get(relayUrl),
            {
              ...filter,
              // Overwrite authors sent to this relay with the authors that were
              // present in the filter and are also present in the relay
              authors: authorFilterAndRelayPubkeyIntersection
            }
          ]);
        }
      } else {
        for (const relayUrl of authorToRelaysMap.keys()) {
          result.set(relayUrl, [...result.get(relayUrl), filter]);
        }
      }
    }
  } else {
    if (ndk.explicitRelayUrls) {
      ndk.explicitRelayUrls.forEach((relayUrl) => {
        result.set(relayUrl, filters);
      });
    }
  }
  if (result.size === 0) {
    pool.permanentAndConnectedRelays().slice(0, 5).forEach((relay) => {
      result.set(relay.url, filters);
    });
  }
  return result;
}
function calculateRelaySetsFromFilters(ndk, filters, pool) {
  const a = calculateRelaySetsFromFilter(ndk, filters, pool);
  return a;
}

// src/events/content-tagger.ts
import { nip19 } from "nostr-tools";
function mergeTags(tags1, tags2) {
  const tagMap = /* @__PURE__ */ new Map();
  const generateKey = (tag) => tag.join(",");
  const isContained = (smaller, larger) => {
    return smaller.every((value, index) => value === larger[index]);
  };
  const processTag = (tag) => {
    for (const [key, existingTag] of tagMap) {
      if (isContained(existingTag, tag) || isContained(tag, existingTag)) {
        if (tag.length >= existingTag.length) {
          tagMap.set(key, tag);
        }
        return;
      }
    }
    tagMap.set(generateKey(tag), tag);
  };
  tags1.concat(tags2).forEach(processTag);
  return Array.from(tagMap.values());
}
async function generateContentTags(content, tags = []) {
  const tagRegex = /(@|nostr:)(npub|nprofile|note|nevent|naddr)[a-zA-Z0-9]+/g;
  const hashtagRegex = /(?<=\s|^)(#[^\s!@#$%^&*()=+./,[{\]};:'"?><]+)/g;
  const promises = [];
  const addTagIfNew = (t) => {
    if (!tags.find((t2) => ["q", t[0]].includes(t2[0]) && t2[1] === t[1])) {
      tags.push(t);
    }
  };
  content = content.replace(tagRegex, (tag) => {
    try {
      const entity = tag.split(/(@|nostr:)/)[2];
      const { type, data } = nip19.decode(entity);
      let t;
      switch (type) {
        case "npub":
          t = ["p", data];
          break;
        case "nprofile":
          t = ["p", data.pubkey];
          break;
        case "note":
          promises.push(
            new Promise(async (resolve) => {
              addTagIfNew([
                "e",
                data,
                await maybeGetEventRelayUrl(entity),
                "mention"
              ]);
              resolve();
            })
          );
          break;
        case "nevent":
          promises.push(
            new Promise(async (resolve) => {
              const { id, author } = data;
              let { relays } = data;
              if (!relays || relays.length === 0) {
                relays = [await maybeGetEventRelayUrl(entity)];
              }
              addTagIfNew(["e", id, relays[0], "mention"]);
              if (author) addTagIfNew(["p", author]);
              resolve();
            })
          );
          break;
        case "naddr":
          promises.push(
            new Promise(async (resolve) => {
              const id = [data.kind, data.pubkey, data.identifier].join(":");
              let relays = data.relays ?? [];
              if (relays.length === 0) {
                relays = [await maybeGetEventRelayUrl(entity)];
              }
              addTagIfNew(["a", id, relays[0], "mention"]);
              addTagIfNew(["p", data.pubkey]);
              resolve();
            })
          );
          break;
        default:
          return tag;
      }
      if (t) addTagIfNew(t);
      return `nostr:${entity}`;
    } catch (error) {
      return tag;
    }
  });
  await Promise.all(promises);
  content = content.replace(hashtagRegex, (tag, word) => {
    const t = ["t", word.slice(1)];
    if (!tags.find((t2) => t2[0] === t[0] && t2[1] === t[1])) {
      tags.push(t);
    }
    return tag;
  });
  return { content, tags };
}
async function maybeGetEventRelayUrl(nip19Id) {
  return "";
}

// src/events/kind.ts
function isReplaceable() {
  if (this.kind === void 0) throw new Error("Kind not set");
  return [0, 3].includes(this.kind) || this.kind >= 1e4 && this.kind < 2e4 || this.kind >= 3e4 && this.kind < 4e4;
}
function isEphemeral() {
  if (this.kind === void 0) throw new Error("Kind not set");
  return this.kind >= 2e4 && this.kind < 3e4;
}
function isParamReplaceable() {
  if (this.kind === void 0) throw new Error("Kind not set");
  return this.kind >= 3e4 && this.kind < 4e4;
}

// src/events/kinds/index.ts
var NDKKind = /* @__PURE__ */ ((NDKKind2) => {
  NDKKind2[NDKKind2["Metadata"] = 0] = "Metadata";
  NDKKind2[NDKKind2["Text"] = 1] = "Text";
  NDKKind2[NDKKind2["RecommendRelay"] = 2] = "RecommendRelay";
  NDKKind2[NDKKind2["Contacts"] = 3] = "Contacts";
  NDKKind2[NDKKind2["EncryptedDirectMessage"] = 4] = "EncryptedDirectMessage";
  NDKKind2[NDKKind2["EventDeletion"] = 5] = "EventDeletion";
  NDKKind2[NDKKind2["Repost"] = 6] = "Repost";
  NDKKind2[NDKKind2["Reaction"] = 7] = "Reaction";
  NDKKind2[NDKKind2["BadgeAward"] = 8] = "BadgeAward";
  NDKKind2[NDKKind2["GroupChat"] = 9] = "GroupChat";
  NDKKind2[NDKKind2["GroupNote"] = 11] = "GroupNote";
  NDKKind2[NDKKind2["GroupReply"] = 12] = "GroupReply";
  NDKKind2[NDKKind2["Image"] = 20] = "Image";
  NDKKind2[NDKKind2["GenericRespose"] = 22] = "GenericRespose";
  NDKKind2[NDKKind2["GenericRepost"] = 16] = "GenericRepost";
  NDKKind2[NDKKind2["ChannelCreation"] = 40] = "ChannelCreation";
  NDKKind2[NDKKind2["ChannelMetadata"] = 41] = "ChannelMetadata";
  NDKKind2[NDKKind2["ChannelMessage"] = 42] = "ChannelMessage";
  NDKKind2[NDKKind2["ChannelHideMessage"] = 43] = "ChannelHideMessage";
  NDKKind2[NDKKind2["ChannelMuteUser"] = 44] = "ChannelMuteUser";
  NDKKind2[NDKKind2["GenericReply"] = 1111] = "GenericReply";
  NDKKind2[NDKKind2["Media"] = 1063] = "Media";
  NDKKind2[NDKKind2["Report"] = 1984] = "Report";
  NDKKind2[NDKKind2["Label"] = 1985] = "Label";
  NDKKind2[NDKKind2["DVMReqTextExtraction"] = 5e3] = "DVMReqTextExtraction";
  NDKKind2[NDKKind2["DVMReqTextSummarization"] = 5001] = "DVMReqTextSummarization";
  NDKKind2[NDKKind2["DVMReqTextTranslation"] = 5002] = "DVMReqTextTranslation";
  NDKKind2[NDKKind2["DVMReqTextGeneration"] = 5050] = "DVMReqTextGeneration";
  NDKKind2[NDKKind2["DVMReqImageGeneration"] = 5100] = "DVMReqImageGeneration";
  NDKKind2[NDKKind2["DVMReqTextToSpeech"] = 5250] = "DVMReqTextToSpeech";
  NDKKind2[NDKKind2["DVMReqDiscoveryNostrContent"] = 5300] = "DVMReqDiscoveryNostrContent";
  NDKKind2[NDKKind2["DVMReqDiscoveryNostrPeople"] = 5301] = "DVMReqDiscoveryNostrPeople";
  NDKKind2[NDKKind2["DVMReqTimestamping"] = 5900] = "DVMReqTimestamping";
  NDKKind2[NDKKind2["DVMEventSchedule"] = 5905] = "DVMEventSchedule";
  NDKKind2[NDKKind2["DVMJobFeedback"] = 7e3] = "DVMJobFeedback";
  NDKKind2[NDKKind2["Subscribe"] = 7001] = "Subscribe";
  NDKKind2[NDKKind2["Unsubscribe"] = 7002] = "Unsubscribe";
  NDKKind2[NDKKind2["SubscriptionReceipt"] = 7003] = "SubscriptionReceipt";
  NDKKind2[NDKKind2["CashuReserve"] = 7373] = "CashuReserve";
  NDKKind2[NDKKind2["CashuQuote"] = 7374] = "CashuQuote";
  NDKKind2[NDKKind2["CashuToken"] = 7375] = "CashuToken";
  NDKKind2[NDKKind2["WalletChange"] = 7376] = "WalletChange";
  NDKKind2[NDKKind2["GroupAdminAddUser"] = 9e3] = "GroupAdminAddUser";
  NDKKind2[NDKKind2["GroupAdminRemoveUser"] = 9001] = "GroupAdminRemoveUser";
  NDKKind2[NDKKind2["GroupAdminEditMetadata"] = 9002] = "GroupAdminEditMetadata";
  NDKKind2[NDKKind2["GroupAdminEditStatus"] = 9006] = "GroupAdminEditStatus";
  NDKKind2[NDKKind2["GroupAdminCreateGroup"] = 9007] = "GroupAdminCreateGroup";
  NDKKind2[NDKKind2["GroupAdminRequestJoin"] = 9021] = "GroupAdminRequestJoin";
  NDKKind2[NDKKind2["MuteList"] = 1e4] = "MuteList";
  NDKKind2[NDKKind2["PinList"] = 10001] = "PinList";
  NDKKind2[NDKKind2["RelayList"] = 10002] = "RelayList";
  NDKKind2[NDKKind2["BookmarkList"] = 10003] = "BookmarkList";
  NDKKind2[NDKKind2["CommunityList"] = 10004] = "CommunityList";
  NDKKind2[NDKKind2["PublicChatList"] = 10005] = "PublicChatList";
  NDKKind2[NDKKind2["BlockRelayList"] = 10006] = "BlockRelayList";
  NDKKind2[NDKKind2["SearchRelayList"] = 10007] = "SearchRelayList";
  NDKKind2[NDKKind2["SimpleGroupList"] = 10009] = "SimpleGroupList";
  NDKKind2[NDKKind2["InterestList"] = 10015] = "InterestList";
  NDKKind2[NDKKind2["CashuMintList"] = 10019] = "CashuMintList";
  NDKKind2[NDKKind2["EmojiList"] = 10030] = "EmojiList";
  NDKKind2[NDKKind2["DirectMessageReceiveRelayList"] = 10050] = "DirectMessageReceiveRelayList";
  NDKKind2[NDKKind2["BlossomList"] = 10063] = "BlossomList";
  NDKKind2[NDKKind2["NostrWaletConnectInfo"] = 13194] = "NostrWaletConnectInfo";
  NDKKind2[NDKKind2["TierList"] = 17e3] = "TierList";
  NDKKind2[NDKKind2["FollowSet"] = 3e4] = "FollowSet";
  NDKKind2[NDKKind2["CategorizedPeopleList"] = 3e4 /* FollowSet */] = "CategorizedPeopleList";
  NDKKind2[NDKKind2["CategorizedBookmarkList"] = 30001] = "CategorizedBookmarkList";
  NDKKind2[NDKKind2["RelaySet"] = 30002] = "RelaySet";
  NDKKind2[NDKKind2["CategorizedRelayList"] = 30002 /* RelaySet */] = "CategorizedRelayList";
  NDKKind2[NDKKind2["BookmarkSet"] = 30003] = "BookmarkSet";
  NDKKind2[NDKKind2["CurationSet"] = 30004] = "CurationSet";
  NDKKind2[NDKKind2["ArticleCurationSet"] = 30004] = "ArticleCurationSet";
  NDKKind2[NDKKind2["VideoCurationSet"] = 30005] = "VideoCurationSet";
  NDKKind2[NDKKind2["ImageCurationSet"] = 30006] = "ImageCurationSet";
  NDKKind2[NDKKind2["InterestSet"] = 30015] = "InterestSet";
  NDKKind2[NDKKind2["InterestsList"] = 30015 /* InterestSet */] = "InterestsList";
  NDKKind2[NDKKind2["EmojiSet"] = 30030] = "EmojiSet";
  NDKKind2[NDKKind2["ModularArticle"] = 30040] = "ModularArticle";
  NDKKind2[NDKKind2["ModularArticleItem"] = 30041] = "ModularArticleItem";
  NDKKind2[NDKKind2["Wiki"] = 30818] = "Wiki";
  NDKKind2[NDKKind2["Draft"] = 31234] = "Draft";
  NDKKind2[NDKKind2["SubscriptionTier"] = 37001] = "SubscriptionTier";
  NDKKind2[NDKKind2["EcashMintRecommendation"] = 38e3] = "EcashMintRecommendation";
  NDKKind2[NDKKind2["HighlightSet"] = 39802] = "HighlightSet";
  NDKKind2[NDKKind2["CategorizedHighlightList"] = 39802 /* HighlightSet */] = "CategorizedHighlightList";
  NDKKind2[NDKKind2["Nutzap"] = 9321] = "Nutzap";
  NDKKind2[NDKKind2["ZapRequest"] = 9734] = "ZapRequest";
  NDKKind2[NDKKind2["Zap"] = 9735] = "Zap";
  NDKKind2[NDKKind2["Highlight"] = 9802] = "Highlight";
  NDKKind2[NDKKind2["ClientAuth"] = 22242] = "ClientAuth";
  NDKKind2[NDKKind2["NostrWalletConnectReq"] = 23194] = "NostrWalletConnectReq";
  NDKKind2[NDKKind2["NostrWalletConnectRes"] = 23195] = "NostrWalletConnectRes";
  NDKKind2[NDKKind2["NostrConnect"] = 24133] = "NostrConnect";
  NDKKind2[NDKKind2["BlossomUpload"] = 24242] = "BlossomUpload";
  NDKKind2[NDKKind2["HttpAuth"] = 27235] = "HttpAuth";
  NDKKind2[NDKKind2["ProfileBadge"] = 30008] = "ProfileBadge";
  NDKKind2[NDKKind2["BadgeDefinition"] = 30009] = "BadgeDefinition";
  NDKKind2[NDKKind2["MarketStall"] = 30017] = "MarketStall";
  NDKKind2[NDKKind2["MarketProduct"] = 30018] = "MarketProduct";
  NDKKind2[NDKKind2["Article"] = 30023] = "Article";
  NDKKind2[NDKKind2["AppSpecificData"] = 30078] = "AppSpecificData";
  NDKKind2[NDKKind2["Classified"] = 30402] = "Classified";
  NDKKind2[NDKKind2["HorizontalVideo"] = 34235] = "HorizontalVideo";
  NDKKind2[NDKKind2["VerticalVideo"] = 34236] = "VerticalVideo";
  NDKKind2[NDKKind2["CashuWallet"] = 37375] = "CashuWallet";
  NDKKind2[NDKKind2["GroupMetadata"] = 39e3] = "GroupMetadata";
  NDKKind2[NDKKind2["GroupAdmins"] = 39001] = "GroupAdmins";
  NDKKind2[NDKKind2["GroupMembers"] = 39002] = "GroupMembers";
  NDKKind2[NDKKind2["AppRecommendation"] = 31989] = "AppRecommendation";
  NDKKind2[NDKKind2["AppHandler"] = 31990] = "AppHandler";
  return NDKKind2;
})(NDKKind || {});
var NDKListKinds = [
  1e4 /* MuteList */,
  10001 /* PinList */,
  10002 /* RelayList */,
  10003 /* BookmarkList */,
  10004 /* CommunityList */,
  10005 /* PublicChatList */,
  10006 /* BlockRelayList */,
  10007 /* SearchRelayList */,
  10015 /* InterestList */,
  10030 /* EmojiList */,
  10050 /* DirectMessageReceiveRelayList */,
  3e4 /* FollowSet */,
  30003 /* BookmarkSet */,
  30001 /* CategorizedBookmarkList */,
  // Backwards compatibility
  30002 /* RelaySet */,
  30004 /* ArticleCurationSet */,
  30005 /* VideoCurationSet */,
  30015 /* InterestSet */,
  30030 /* EmojiSet */,
  39802 /* HighlightSet */
];

// src/signers/index.ts
var DEFAULT_ENCRYPTION_SCHEME = "nip44";

// src/events/nip04.ts
async function encrypt(recipient, signer, type = DEFAULT_ENCRYPTION_SCHEME) {
  if (!this.ndk) throw new Error("No NDK instance found!");
  if (!signer) {
    await this.ndk.assertSigner();
    signer = this.ndk.signer;
  }
  if (!recipient) {
    const pTags = this.getMatchingTags("p");
    if (pTags.length !== 1) {
      throw new Error(
        "No recipient could be determined and no explicit recipient was provided"
      );
    }
    recipient = this.ndk.getUser({ pubkey: pTags[0][1] });
  }
  this.content = await signer?.encrypt(recipient, this.content, type);
}
async function decrypt(sender, signer, type) {
  if (!this.ndk) throw new Error("No NDK instance found!");
  if (!signer) {
    await this.ndk.assertSigner();
    signer = this.ndk.signer;
  }
  if (!sender) {
    sender = this.author;
  }
  if (!type) {
    type = this.content.match(/\?iv=/) ? "nip04" : "nip44";
  }
  this.content = await signer?.decrypt(sender, this.content, type);
}

// src/events/nip19.ts
import { nip19 as nip192 } from "nostr-tools";
var DEFAULT_RELAY_COUNT = 2;
function encode(maxRelayCount = DEFAULT_RELAY_COUNT) {
  let relays = [];
  if (this.onRelays.length > 0) {
    relays = this.onRelays.map((relay) => relay.url);
  } else if (this.relay) {
    relays = [this.relay.url];
  }
  if (relays.length > maxRelayCount) {
    relays = relays.slice(0, maxRelayCount);
  }
  if (this.isParamReplaceable()) {
    return nip192.naddrEncode({
      kind: this.kind,
      pubkey: this.pubkey,
      identifier: this.replaceableDTag(),
      relays
    });
  } else if (relays.length > 0) {
    return nip192.neventEncode({
      id: this.tagId(),
      relays,
      author: this.pubkey
    });
  } else {
    return nip192.noteEncode(this.tagId());
  }
}

// src/events/repost.ts
async function repost(publish = true, signer) {
  if (!signer && publish) {
    if (!this.ndk) throw new Error("No NDK instance found");
    this.ndk.assertSigner();
    signer = this.ndk.signer;
  }
  const e = new NDKEvent(this.ndk, {
    kind: getKind(this)
  });
  e.content = JSON.stringify(this.rawEvent());
  e.tag(this);
  if (this.kind !== 1 /* Text */) {
    e.tags.push(["k", `${this.kind}`]);
  }
  if (signer) await e.sign(signer);
  if (publish) await e.publish();
  return e;
}
function getKind(event) {
  if (event.kind === 1) {
    return 6 /* Repost */;
  }
  return 16 /* GenericRepost */;
}

// src/thread/index.ts
function eventsBySameAuthor(op, events) {
  const eventsByAuthor = /* @__PURE__ */ new Map();
  eventsByAuthor.set(op.id, op);
  events.forEach((event) => {
    if (event.pubkey === op.pubkey) {
      eventsByAuthor.set(event.id, event);
    }
  });
  return eventsByAuthor;
}
var hasMarkers = (event, tagType) => {
  return event.getMatchingTags(tagType).some((tag) => tag[3] && tag[3] !== "");
};
function eventIsReply(op, event, threadIds = /* @__PURE__ */ new Set(), tagType) {
  tagType ??= op.tagType();
  const tags = event.getMatchingTags(tagType);
  threadIds.add(op.tagId());
  if (threadIds.has(event.tagId())) return false;
  const heedExplicitReplyMarker = () => {
    let eventIsTagged = false;
    for (const tag of tags) {
      if (tag[3] === "reply") return threadIds.has(tag[1]);
      const markerIsEmpty = tag[3] === "" || tag[3] === void 0;
      const markerIsRoot = tag[3] === "root";
      if (tag[1] === op.tagId() && (markerIsEmpty || markerIsRoot)) {
        eventIsTagged = markerIsRoot ? "root" : true;
      }
    }
    if (!eventIsTagged) return false;
    if (eventIsTagged === "root") return true;
  };
  const explicitReplyMarker = heedExplicitReplyMarker();
  if (explicitReplyMarker !== void 0) return explicitReplyMarker;
  if (hasMarkers(event, tagType)) return false;
  const expectedTags = op.getMatchingTags("e").map((tag) => tag[1]);
  expectedTags.push(op.id);
  return event.getMatchingTags("e").every((tag) => expectedTags.includes(tag[1]));
}
function eventThreads(op, events) {
  const eventsByAuthor = eventsBySameAuthor(op, events);
  const threadEvents = events.filter((event) => eventIsPartOfThread(op, event, eventsByAuthor));
  return threadEvents.sort((a, b) => a.created_at - b.created_at);
}
function getEventReplyIds(event) {
  if (hasMarkers(event, event.tagType())) {
    let rootTag;
    const replyTags = [];
    event.getMatchingTags(event.tagType()).forEach((tag) => {
      if (tag[3] === "root") rootTag = tag;
      if (tag[3] === "reply") replyTags.push(tag);
    });
    if (replyTags.length === 0) {
      if (rootTag) {
        replyTags.push(rootTag);
      }
    }
    return replyTags.map((tag) => tag[1]);
  } else {
    return event.getMatchingTags("e").map((tag) => tag[1]);
  }
}
function isEventOriginalPost(event) {
  return getEventReplyIds(event).length === 0;
}
function eventThreadIds(op, events) {
  const threadIds = /* @__PURE__ */ new Map();
  const threadEvents = eventThreads(op, events);
  threadEvents.forEach((event) => threadIds.set(event.id, event));
  return threadIds;
}
function eventReplies(op, events, threadEventIds) {
  threadEventIds ??= new Set(eventThreadIds(op, events).keys());
  return events.filter((event) => eventIsReply(op, event, threadEventIds));
}
function eventIsPartOfThread(op, event, eventsByAuthor) {
  if (op.pubkey !== event.pubkey) return false;
  const taggedEventIds = event.getMatchingTags("e").map((tag) => tag[1]);
  const allTaggedEventsAreByOriginalAuthor = taggedEventIds.every((id) => eventsByAuthor.has(id));
  return allTaggedEventsAreByOriginalAuthor;
}
function eventHasETagMarkers(event) {
  return event.getMatchingTags("e").some((tag) => tag[3]);
}
function getRootEventId(event, searchTag) {
  searchTag ??= event.tagType();
  const rootEventTag = getRootTag(event, searchTag);
  if (rootEventTag) return rootEventTag[1];
  const replyTag = getReplyTag(event, searchTag);
  return replyTag?.[1];
}
function getRootTag(event, searchTag) {
  searchTag ??= event.tagType();
  const rootEventTag = event.tags.find((tag) => tag[3] === "root");
  if (!rootEventTag) {
    if (eventHasETagMarkers(event)) return;
    const matchingTags = event.getMatchingTags(searchTag);
    if (matchingTags.length < 3) return matchingTags[0];
  }
  return rootEventTag;
}
function getReplyTag(event, searchTag) {
  searchTag ??= event.tagType();
  let replyTag = event.tags.find((tag) => tag[3] === "reply");
  if (replyTag) return replyTag;
  if (!replyTag) replyTag = event.tags.find((tag) => tag[3] === "root");
  if (!replyTag) {
    if (eventHasETagMarkers(event)) return;
    const matchingTags = event.getMatchingTags(searchTag);
    if (matchingTags.length === 1) return matchingTags[0];
    if (matchingTags.length === 2) return matchingTags[1];
  }
}

// src/events/fetch-tagged-event.ts
async function fetchTaggedEvent(tag, marker) {
  if (!this.ndk) throw new Error("NDK instance not found");
  const t = this.getMatchingTags(tag, marker);
  if (t.length === 0) return void 0;
  const [_, id, hint] = t[0];
  let relay;
  const event = await this.ndk.fetchEvent(id, {}, relay);
  return event;
}
async function fetchRootEvent(subOpts) {
  if (!this.ndk) throw new Error("NDK instance not found");
  const rootTag = getRootTag(this);
  if (!rootTag) return void 0;
  return this.ndk.fetchEventFromTag(rootTag, this, subOpts);
}
async function fetchReplyEvent(subOpts) {
  if (!this.ndk) throw new Error("NDK instance not found");
  const replyTag = getReplyTag(this);
  if (!replyTag) return void 0;
  return this.ndk.fetchEventFromTag(replyTag, this, subOpts);
}

// src/events/serializer.ts
function serialize(includeSig = false, includeId = false) {
  const payload = [0, this.pubkey, this.created_at, this.kind, this.tags, this.content];
  if (includeSig) payload.push(this.sig);
  if (includeId) payload.push(this.id);
  return JSON.stringify(payload);
}
function deserialize(serializedEvent) {
  const eventArray = JSON.parse(serializedEvent);
  const ret = {
    pubkey: eventArray[1],
    created_at: eventArray[2],
    kind: eventArray[3],
    tags: eventArray[4],
    content: eventArray[5]
  };
  if (eventArray.length >= 7) ret.sig = eventArray[6];
  if (eventArray.length >= 8) ret.id = eventArray[7];
  return ret;
}

// src/events/validation.ts
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { schnorr } from "@noble/curves/secp256k1";

// src/events/signature.ts
var worker;
var processingQueue = {};
function signatureVerificationInit(w) {
  worker = w;
  worker.onmessage = (msg) => {
    const [eventId, result] = msg.data;
    const record = processingQueue[eventId];
    if (!record) {
      console.error("No record found for event", eventId);
      return;
    }
    delete processingQueue[eventId];
    for (const resolve of record.resolves) {
      resolve(result);
    }
  };
}
async function verifySignatureAsync(event, persist) {
  const promise = new Promise((resolve) => {
    const serialized = event.serialize();
    let enqueue = false;
    if (!processingQueue[event.id]) {
      processingQueue[event.id] = { event, resolves: [] };
      enqueue = true;
    }
    processingQueue[event.id].resolves.push(resolve);
    if (!enqueue) return;
    worker.postMessage({
      serialized,
      id: event.id,
      sig: event.sig,
      pubkey: event.pubkey
    });
  });
  return promise;
}

// src/events/validation.ts
import { LRUCache } from "typescript-lru-cache";
var PUBKEY_REGEX = /^[a-f0-9]{64}$/;
function validate() {
  if (typeof this.kind !== "number") return false;
  if (typeof this.content !== "string") return false;
  if (typeof this.created_at !== "number") return false;
  if (typeof this.pubkey !== "string") return false;
  if (!this.pubkey.match(PUBKEY_REGEX)) return false;
  if (!Array.isArray(this.tags)) return false;
  for (let i = 0; i < this.tags.length; i++) {
    const tag = this.tags[i];
    if (!Array.isArray(tag)) return false;
    for (let j = 0; j < tag.length; j++) {
      if (typeof tag[j] === "object") return false;
    }
  }
  return true;
}
var verifiedSignatures = new LRUCache({
  maxSize: 1e3,
  entryExpirationTimeInMS: 6e4
});
function verifySignature(persist) {
  if (typeof this.signatureVerified === "boolean") return this.signatureVerified;
  const prevVerification = verifiedSignatures.get(this.id);
  if (prevVerification !== null) {
    return this.signatureVerified = !!prevVerification;
  }
  try {
    if (this.ndk?.asyncSigVerification) {
      verifySignatureAsync(this, persist).then((result) => {
        if (persist) {
          this.signatureVerified = result;
          if (result) verifiedSignatures.set(this.id, this.sig);
        }
        if (!result) {
          this.ndk.emit("event:invalid-sig", this);
          verifiedSignatures.set(this.id, false);
        }
      });
    } else {
      const hash = sha256(new TextEncoder().encode(this.serialize()));
      const res = schnorr.verify(this.sig, hash, this.pubkey);
      if (res) verifiedSignatures.set(this.id, this.sig);
      else verifiedSignatures.set(this.id, false);
      return this.signatureVerified = res;
    }
  } catch (err) {
    return this.signatureVerified = false;
  }
}
function getEventHash() {
  return getEventHashFromSerializedEvent(this.serialize());
}
function getEventHashFromSerializedEvent(serializedEvent) {
  const eventHash = sha256(new TextEncoder().encode(serializedEvent));
  return bytesToHex(eventHash);
}

// src/events/index.ts
var skipClientTagOnKinds = [3 /* Contacts */];
var NDKEvent = class _NDKEvent extends EventEmitter {
  ndk;
  created_at;
  content = "";
  tags = [];
  kind;
  id = "";
  sig;
  pubkey = "";
  signatureVerified;
  _author = void 0;
  /**
   * The relay that this event was first received from.
   */
  relay;
  /**
   * The relays that this event was received from and/or successfully published to.
   */
  get onRelays() {
    let res = [];
    if (!this.ndk) {
      if (this.relay) res.push(this.relay);
    } else {
      res = this.ndk.subManager.seenEvents.get(this.id) || [];
    }
    return res;
  }
  /**
   * The status of the publish operation.
   */
  publishStatus = "success";
  publishError;
  constructor(ndk, event) {
    super();
    this.ndk = ndk;
    this.created_at = event?.created_at;
    this.content = event?.content || "";
    this.tags = event?.tags || [];
    this.id = event?.id || "";
    this.sig = event?.sig;
    this.pubkey = event?.pubkey || "";
    this.kind = event?.kind;
    if (event instanceof _NDKEvent) {
      if (this.relay) {
        this.relay = event.relay;
        this.ndk?.subManager.seenEvent(event.id, this.relay);
      }
      this.publishStatus = event.publishStatus;
      this.publishError = event.publishError;
    }
  }
  /**
   * Deserialize an NDKEvent from a serialized payload.
   * @param ndk
   * @param event
   * @returns
   */
  static deserialize(ndk, event) {
    return new _NDKEvent(ndk, deserialize(event));
  }
  /**
   * Returns the event as is.
   */
  rawEvent() {
    return {
      created_at: this.created_at,
      content: this.content,
      tags: this.tags,
      kind: this.kind,
      pubkey: this.pubkey,
      id: this.id,
      sig: this.sig
    };
  }
  set author(user) {
    this.pubkey = user.pubkey;
    this._author = user;
    this._author.ndk ??= this.ndk;
  }
  /**
   * Returns an NDKUser for the author of the event.
   */
  get author() {
    if (this._author) return this._author;
    if (!this.ndk) throw new Error("No NDK instance found");
    const user = this.ndk.getUser({ pubkey: this.pubkey });
    this._author = user;
    return user;
  }
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
  tagExternal(entity, type, markerUrl) {
    let iTag = ["i"];
    let kTag = ["k"];
    switch (type) {
      case "url":
        const url = new URL(entity);
        url.hash = "";
        iTag.push(url.toString());
        kTag.push(`${url.protocol}//${url.host}`);
        break;
      case "hashtag":
        iTag.push(`#${entity.toLowerCase()}`);
        kTag.push("#");
        break;
      case "geohash":
        iTag.push(`geo:${entity.toLowerCase()}`);
        kTag.push("geo");
        break;
      case "isbn":
        iTag.push(`isbn:${entity.replace(/-/g, "")}`);
        kTag.push("isbn");
        break;
      case "podcast:guid":
        iTag.push(`podcast:guid:${entity}`);
        kTag.push("podcast:guid");
        break;
      case "podcast:item:guid":
        iTag.push(`podcast:item:guid:${entity}`);
        kTag.push("podcast:item:guid");
        break;
      case "podcast:publisher:guid":
        iTag.push(`podcast:publisher:guid:${entity}`);
        kTag.push("podcast:publisher:guid");
        break;
      case "isan":
        iTag.push(`isan:${entity.split("-").slice(0, 4).join("-")}`);
        kTag.push("isan");
        break;
      case "doi":
        iTag.push(`doi:${entity.toLowerCase()}`);
        kTag.push("doi");
        break;
      default:
        throw new Error(`Unsupported NIP-73 entity type: ${type}`);
    }
    if (markerUrl) {
      iTag.push(markerUrl);
    }
    this.tags.push(iTag);
    this.tags.push(kTag);
  }
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
  tag(target, marker, skipAuthorTag, forceTag) {
    let tags = [];
    const isNDKUser = target.fetchProfile !== void 0;
    if (isNDKUser) {
      forceTag ??= "p";
      const tag = [forceTag, target.pubkey];
      if (marker) tag.push(...["", marker]);
      tags.push(tag);
    } else if (target instanceof _NDKEvent) {
      const event = target;
      skipAuthorTag ??= event?.pubkey === this.pubkey;
      tags = event.referenceTags(marker, skipAuthorTag, forceTag);
      for (const pTag of event.getMatchingTags("p")) {
        if (pTag[1] === this.pubkey) continue;
        if (this.tags.find((t) => t[0] === "p" && t[1] === pTag[1])) continue;
        this.tags.push(["p", pTag[1]]);
      }
    } else if (Array.isArray(target)) {
      tags = [target];
    } else {
      throw new Error("Invalid argument", target);
    }
    this.tags = mergeTags(this.tags, tags);
  }
  /**
   * Return a NostrEvent object, trying to fill in missing fields
   * when possible, adding tags when necessary.
   * @param pubkey {string} The pubkey of the user who the event belongs to.
   * @returns {Promise<NostrEvent>} A promise that resolves to a NostrEvent.
   */
  async toNostrEvent(pubkey) {
    if (!pubkey && this.pubkey === "") {
      const user = await this.ndk?.signer?.user();
      this.pubkey = user?.pubkey || "";
    }
    if (!this.created_at) {
      this.created_at = Math.floor(Date.now() / 1e3);
    }
    const { content, tags } = await this.generateTags();
    this.content = content || "";
    this.tags = tags;
    try {
      this.id = this.getEventHash();
    } catch (e) {
    }
    return this.rawEvent();
  }
  serialize = serialize.bind(this);
  getEventHash = getEventHash.bind(this);
  validate = validate.bind(this);
  verifySignature = verifySignature.bind(this);
  /**
   * Is this event replaceable (whether parameterized or not)?
   *
   * This will return true for kind 0, 3, 10k-20k and 30k-40k
   */
  isReplaceable = isReplaceable.bind(this);
  isEphemeral = isEphemeral.bind(this);
  /**
   * Is this event parameterized replaceable?
   *
   * This will return true for kind 30k-40k
   */
  isParamReplaceable = isParamReplaceable.bind(this);
  /**
   * Encodes a bech32 id.
   *
   * @param relays {string[]} The relays to encode in the id
   * @returns {string} - Encoded naddr, note or nevent.
   */
  encode = encode.bind(this);
  encrypt = encrypt.bind(this);
  decrypt = decrypt.bind(this);
  /**
   * Get all tags with the given name
   * @param tagName {string} The name of the tag to search for
   * @returns {NDKTag[]} An array of the matching tags
   */
  getMatchingTags(tagName, marker) {
    const t = this.tags.filter((tag) => tag[0] === tagName);
    if (marker === void 0) return t;
    return t.filter((tag) => tag[3] === marker);
  }
  /**
   * Check if the event has a tag with the given name
   * @param tagName
   * @param marker
   * @returns
   */
  hasTag(tagName, marker) {
    return this.tags.some((tag) => tag[0] === tagName && (!marker || tag[3] === marker));
  }
  /**
   * Get the first tag with the given name
   * @param tagName Tag name to search for
   * @returns The value of the first tag with the given name, or undefined if no such tag exists
   */
  tagValue(tagName) {
    const tags = this.getMatchingTags(tagName);
    if (tags.length === 0) return void 0;
    return tags[0][1];
  }
  /**
   * Gets the NIP-31 "alt" tag of the event.
   */
  get alt() {
    return this.tagValue("alt");
  }
  /**
   * Sets the NIP-31 "alt" tag of the event. Use this to set an alt tag so
   * clients that don't handle a particular event kind can display something
   * useful for users.
   */
  set alt(alt) {
    this.removeTag("alt");
    if (alt) this.tags.push(["alt", alt]);
  }
  /**
   * Gets the NIP-33 "d" tag of the event.
   */
  get dTag() {
    return this.tagValue("d");
  }
  /**
   * Sets the NIP-33 "d" tag of the event.
   */
  set dTag(value) {
    this.removeTag("d");
    if (value) this.tags.push(["d", value]);
  }
  /**
   * Remove all tags with the given name (e.g. "d", "a", "p")
   * @param tagName Tag name(s) to search for and remove
   * @returns {void}
   */
  removeTag(tagName) {
    const tagNames = Array.isArray(tagName) ? tagName : [tagName];
    this.tags = this.tags.filter((tag) => !tagNames.includes(tag[0]));
  }
  /**
   * Sign the event if a signer is present.
   *
   * It will generate tags.
   * Repleacable events will have their created_at field set to the current time.
   * @param signer {NDKSigner} The NDKSigner to use to sign the event
   * @returns {Promise<string>} A Promise that resolves to the signature of the signed event.
   */
  async sign(signer) {
    if (!signer) {
      this.ndk?.assertSigner();
      signer = this.ndk.signer;
    } else {
      this.author = await signer.user();
    }
    const nostrEvent = await this.toNostrEvent();
    this.sig = await signer.sign(nostrEvent);
    return this.sig;
  }
  /**
   *
   * @param relaySet
   * @param timeoutMs
   * @param requiredRelayCount
   * @returns
   */
  async publishReplaceable(relaySet, timeoutMs, requiredRelayCount) {
    this.id = "";
    this.created_at = Math.floor(Date.now() / 1e3);
    this.sig = "";
    return this.publish(relaySet, timeoutMs, requiredRelayCount);
  }
  /**
   * Attempt to sign and then publish an NDKEvent to a given relaySet.
   * If no relaySet is provided, the relaySet will be calculated by NDK.
   * @param relaySet {NDKRelaySet} The relaySet to publish the even to.
   * @param timeoutM {number} The timeout for the publish operation in milliseconds.
   * @param requiredRelayCount The number of relays that must receive the event for the publish to be considered successful.
   * @returns A promise that resolves to the relays the event was published to.
   */
  async publish(relaySet, timeoutMs, requiredRelayCount) {
    if (!this.sig) await this.sign();
    if (!this.ndk)
      throw new Error("NDKEvent must be associated with an NDK instance to publish");
    if (!relaySet) {
      relaySet = this.ndk.devWriteRelaySet || await calculateRelaySetFromEvent(this.ndk, this);
    }
    if (this.kind === 5 /* EventDeletion */ && this.ndk.cacheAdapter?.deleteEventIds) {
      const eTags = this.getMatchingTags("e").map((tag) => tag[1]);
      this.ndk.cacheAdapter.deleteEventIds(eTags);
    }
    const rawEvent = this.rawEvent();
    if (this.ndk.cacheAdapter?.addUnpublishedEvent) {
      try {
        this.ndk.cacheAdapter.addUnpublishedEvent(this, relaySet.relayUrls);
      } catch (e) {
        console.error("Error adding unpublished event to cache", e);
      }
    }
    if (this.kind === 5 /* EventDeletion */ && this.ndk.cacheAdapter?.deleteEventIds) {
      this.ndk.cacheAdapter.deleteEventIds(this.getMatchingTags("e").map((tag) => tag[1]));
    }
    console.log("Dispatch published event", this.kind);
    this.ndk.subManager.dispatchEvent(rawEvent, void 0, true);
    const relays = await relaySet.publish(this, timeoutMs, requiredRelayCount);
    relays.forEach((relay) => this.ndk?.subManager.seenEvent(this.id, relay));
    return relays;
  }
  /**
   * Generates tags for users, notes, and other events tagged in content.
   * Will also generate random "d" tag for parameterized replaceable events where needed.
   * @returns {ContentTag} The tags and content of the event.
   */
  async generateTags() {
    let tags = [];
    const g = await generateContentTags(this.content, this.tags);
    const content = g.content;
    tags = g.tags;
    if (this.kind && this.isParamReplaceable()) {
      const dTag = this.getMatchingTags("d")[0];
      if (!dTag) {
        const title = this.tagValue("title");
        const randLength = title ? 6 : 16;
        let str = [...Array(randLength)].map(() => Math.random().toString(36)[2]).join("");
        if (title && title.length > 0) {
          str = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") + "-" + str;
        }
        tags.push(["d", str]);
      }
    }
    if (this.shouldAddClientTag) {
      const clientTag = ["client", this.ndk.clientName ?? ""];
      if (this.ndk.clientNip89) clientTag.push(this.ndk.clientNip89);
      tags.push(clientTag);
    } else {
      tags = tags.filter((tag) => tag[0] !== "client");
    }
    return { content: content || "", tags };
  }
  get shouldAddClientTag() {
    if (!this.ndk?.clientName && !this.ndk?.clientNip89) return false;
    if (skipClientTagOnKinds.includes(this.kind)) return false;
    if (this.isEphemeral()) return false;
    if (this.hasTag("client")) return false;
    return true;
  }
  muted() {
    const authorMutedEntry = this.ndk?.mutedIds.get(this.pubkey);
    if (authorMutedEntry && authorMutedEntry === "p") return "author";
    const eventTagReference = this.tagReference();
    const eventMutedEntry = this.ndk?.mutedIds.get(eventTagReference[1]);
    if (eventMutedEntry && eventMutedEntry === eventTagReference[0]) return "event";
    return null;
  }
  /**
   * Returns the "d" tag of a parameterized replaceable event or throws an error if the event isn't
   * a parameterized replaceable event.
   * @returns {string} the "d" tag of the event.
   */
  replaceableDTag() {
    if (this.kind && this.kind >= 3e4 && this.kind <= 4e4) {
      const dTag = this.getMatchingTags("d")[0];
      const dTagId = dTag ? dTag[1] : "";
      return dTagId;
    }
    throw new Error("Event is not a parameterized replaceable event");
  }
  /**
   * Provides a deduplication key for the event.
   *
   * For kinds 0, 3, 10k-20k this will be the event <kind>:<pubkey>
   * For kinds 30k-40k this will be the event <kind>:<pubkey>:<d-tag>
   * For all other kinds this will be the event id
   */
  deduplicationKey() {
    if (this.kind === 0 || this.kind === 3 || this.kind && this.kind >= 1e4 && this.kind < 2e4) {
      return `${this.kind}:${this.pubkey}`;
    } else {
      return this.tagId();
    }
  }
  /**
   * Returns the id of the event or, if it's a parameterized event, the generated id of the event using "d" tag, pubkey, and kind.
   * @returns {string} The id
   */
  tagId() {
    if (this.isParamReplaceable()) {
      return this.tagAddress();
    }
    return this.id;
  }
  /**
   * Returns the "reference" value ("<kind>:<author-pubkey>:<d-tag>") for this replaceable event.
   * @returns {string} The id
   */
  tagAddress() {
    if (!this.isParamReplaceable()) {
      throw new Error("This must only be called on replaceable events");
    }
    const dTagId = this.replaceableDTag();
    return `${this.kind}:${this.pubkey}:${dTagId}`;
  }
  /**
   * Determines the type of tag that can be used to reference this event from another event.
   * @returns {string} The tag type
   * @example
   * event = new NDKEvent(ndk, { kind: 30000, pubkey: 'pubkey', tags: [ ["d", "d-code"] ] });
   * event.tagType(); // "a"
   */
  tagType() {
    return this.isParamReplaceable() ? "a" : "e";
  }
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
  tagReference(marker) {
    let tag;
    if (this.isParamReplaceable()) {
      tag = ["a", this.tagAddress()];
    } else {
      tag = ["e", this.tagId()];
    }
    if (this.relay) {
      tag.push(this.relay.url);
    } else {
      tag.push("");
    }
    tag.push(marker ?? "");
    if (!this.isParamReplaceable()) {
      tag.push(this.pubkey);
    }
    return tag;
  }
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
  referenceTags(marker, skipAuthorTag, forceTag) {
    let tags = [];
    if (this.isParamReplaceable()) {
      tags = [
        [forceTag ?? "a", this.tagAddress()],
        [forceTag ?? "e", this.id]
      ];
    } else {
      tags = [[forceTag ?? "e", this.id]];
    }
    tags = tags.map((tag) => {
      if (tag[0] === "e" || marker) {
        tag.push(this.relay?.url ?? "");
      } else if (this.relay?.url) {
        tag.push(this.relay?.url);
      }
      return tag;
    });
    tags.forEach((tag) => {
      if (tag[0] === "e") {
        tag.push(marker ?? "");
        tag.push(this.pubkey);
      } else if (marker) {
        tag.push(marker);
      }
    });
    tags = [...tags, ...this.getMatchingTags("h")];
    if (!skipAuthorTag) tags.push(...this.author.referenceTags());
    return tags;
  }
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
  filter() {
    if (this.isParamReplaceable()) {
      return { "#a": [this.tagId()] };
    } else {
      return { "#e": [this.tagId()] };
    }
  }
  /**
   * Generates a deletion event of the current event
   *
   * @param reason The reason for the deletion
   * @param publish Whether to publish the deletion event automatically
   * @returns The deletion event
   */
  async delete(reason, publish = true) {
    if (!this.ndk) throw new Error("No NDK instance found");
    this.ndk.assertSigner();
    const e = new _NDKEvent(this.ndk, {
      kind: 5 /* EventDeletion */,
      content: reason || ""
    });
    e.tag(this, void 0, true);
    e.tags.push(["k", this.kind.toString()]);
    if (publish) {
      this.emit("deleted");
      await e.publish();
    }
    return e;
  }
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
  fetchTaggedEvent = fetchTaggedEvent.bind(this);
  /**
   * Fetch the root event of the current event.
   * @returns The fetched root event or null if no event was found
   * @example
   * const replyEvent = await ndk.fetchEvent("nevent1qqs8x8vnycyha73grv380gmvlury4wtmx0nr9a5ds2dngqwgu87wn6gpzemhxue69uhhyetvv9ujuurjd9kkzmpwdejhgq3ql2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqz4cwjd")
   * const rootEvent = await replyEvent.fetchRootEvent();
   * console.log(replyEvent.encode() + " is a reply in the thread " + rootEvent?.encode());
   */
  fetchRootEvent = fetchRootEvent.bind(this);
  /**
   * Fetch the event the current event is replying to.
   * @returns The fetched reply event or null if no event was found
   */
  fetchReplyEvent = fetchReplyEvent.bind(this);
  /**
   * NIP-18 reposting event.
   *
   * @param publish Whether to publish the reposted event automatically @default true
   * @param signer The signer to use for signing the reposted event
   * @returns The reposted event
   *
   * @function
   */
  repost = repost.bind(this);
  /**
   * React to an existing event
   *
   * @param content The content of the reaction
   */
  async react(content, publish = true) {
    if (!this.ndk) throw new Error("No NDK instance found");
    this.ndk.assertSigner();
    const e = new _NDKEvent(this.ndk, {
      kind: 7 /* Reaction */,
      content
    });
    e.tag(this);
    if (publish) {
      await e.publish();
    } else {
      await e.sign();
    }
    return e;
  }
  /**
   * Checks whether the event is valid per underlying NIPs.
   *
   * This method is meant to be overridden by subclasses that implement specific NIPs
   * to allow the enforcement of NIP-specific validation rules.
   *
   * Otherwise, it will only check for basic event properties.
   *
   */
  get isValid() {
    return this.validate();
  }
  /**
   * Creates a reply event for the current event.
   * 
   * This function will use NIP-22 when appropriate (i.e. replies to non-kind:1 events).
   * This function does not have side-effects; it will just return an event with the appropriate tags
   * to generate the reply event; the caller is responsible for publishing the event.
   */
  reply() {
    const reply = new _NDKEvent(this.ndk);
    if (this.kind === 1) {
      reply.kind = 1;
      const opHasETag = this.hasTag("e");
      if (opHasETag) {
        reply.tags = [
          ...reply.tags,
          ...this.getMatchingTags("e"),
          ...this.getMatchingTags("p"),
          ...this.getMatchingTags("a"),
          ...this.referenceTags("reply")
        ];
      } else {
        reply.tag(this, "root");
      }
    } else {
      reply.kind = 1111 /* GenericReply */;
      const carryOverTags = ["A", "E", "I", "P"];
      const rootTags = this.tags.filter((tag) => carryOverTags.includes(tag[0]));
      if (rootTags.length > 0) {
        const rootKind = this.tagValue("K");
        reply.tags.push(...rootTags);
        if (rootKind) reply.tags.push(["K", rootKind]);
        const [type, id, _, ...extra] = this.tagReference();
        const tag = [type, id, ...extra];
        reply.tags.push(tag);
      } else {
        const [type, id, _, relayHint] = this.tagReference();
        const tag = [type, id, relayHint ?? ""];
        if (type === "e") tag.push(this.pubkey);
        reply.tags.push(tag);
        const uppercaseTag = [...tag];
        uppercaseTag[0] = uppercaseTag[0].toUpperCase();
        reply.tags.push(uppercaseTag);
        reply.tags.push(["K", this.kind.toString()]);
        reply.tags.push(["P", this.pubkey]);
      }
      reply.tags.push(["k", this.kind.toString()]);
      reply.tags.push(...this.getMatchingTags("p"));
      reply.tags.push(["p", this.pubkey]);
    }
    return reply;
  }
};

// src/relay/connectivity.ts
var MAX_RECONNECT_ATTEMPTS = 5;
var FLAPPING_THRESHOLD_MS = 1e3;
var NDKRelayConnectivity = class {
  ndkRelay;
  ws;
  _status;
  timeoutMs;
  connectedAt;
  _connectionStats = {
    attempts: 0,
    success: 0,
    durations: []
  };
  debug;
  netDebug;
  connectTimeout;
  reconnectTimeout;
  ndk;
  openSubs = /* @__PURE__ */ new Map();
  openCountRequests = /* @__PURE__ */ new Map();
  openEventPublishes = /* @__PURE__ */ new Map();
  serial = 0;
  baseEoseTimeout = 4400;
  constructor(ndkRelay, ndk) {
    this.ndkRelay = ndkRelay;
    this._status = 1 /* DISCONNECTED */;
    const rand = Math.floor(Math.random() * 1e3);
    this.debug = this.ndkRelay.debug.extend("connectivity" + rand);
    this.ndk = ndk;
  }
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
  async connect(timeoutMs, reconnect = true) {
    if (this._status !== 2 /* RECONNECTING */ && this._status !== 1 /* DISCONNECTED */ || this.reconnectTimeout) {
      this.debug(
        "Relay requested to be connected but was in state %s or it had a reconnect timeout",
        this._status
      );
      return;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = void 0;
    }
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = void 0;
    }
    timeoutMs ??= this.timeoutMs;
    if (!this.timeoutMs && timeoutMs) this.timeoutMs = timeoutMs;
    if (this.timeoutMs)
      this.connectTimeout = setTimeout(
        () => this.onConnectionError(reconnect),
        this.timeoutMs
      );
    try {
      this.updateConnectionStats.attempt();
      if (this._status === 1 /* DISCONNECTED */)
        this._status = 4 /* CONNECTING */;
      else this._status = 2 /* RECONNECTING */;
      this.ws = new WebSocket(this.ndkRelay.url);
      this.ws.onopen = this.onConnect.bind(this);
      this.ws.onclose = this.onDisconnect.bind(this);
      this.ws.onmessage = this.onMessage.bind(this);
      this.ws.onerror = this.onError.bind(this);
    } catch (e) {
      this.debug(`Failed to connect to ${this.ndkRelay.url}`, e);
      this._status = 1 /* DISCONNECTED */;
      if (reconnect) this.handleReconnection();
      else this.ndkRelay.emit("delayed-connect", 2 * 24 * 60 * 60 * 1e3);
      throw e;
    }
  }
  /**
   * Disconnects the WebSocket connection to the NDK relay.
   * This method sets the connection status to `NDKRelayStatus.DISCONNECTING`,
   * attempts to close the WebSocket connection, and sets the status to
   * `NDKRelayStatus.DISCONNECTED` if the disconnect operation fails.
   */
  disconnect() {
    this._status = 0 /* DISCONNECTING */;
    try {
      this.ws?.close();
    } catch (e) {
      this.debug("Failed to disconnect", e);
      this._status = 1 /* DISCONNECTED */;
    }
  }
  /**
   * Handles the error that occurred when attempting to connect to the NDK relay.
   * If `reconnect` is `true`, this method will initiate a reconnection attempt.
   * Otherwise, it will emit a `delayed-connect` event on the `ndkRelay` object,
   * indicating that a reconnection should be attempted after a delay.
   *
   * @param reconnect - Indicates whether a reconnection should be attempted.
   */
  onConnectionError(reconnect) {
    this.debug(`Error connecting to ${this.ndkRelay.url}`, this.timeoutMs);
    if (reconnect && !this.reconnectTimeout) {
      this.handleReconnection();
    }
  }
  /**
   * Handles the connection event when the WebSocket connection is established.
   * This method is called when the WebSocket connection is successfully opened.
   * It clears any existing connection and reconnection timeouts, updates the connection statistics,
   * sets the connection status to `CONNECTED`, and emits `connect` and `ready` events on the `ndkRelay` object.
   */
  onConnect() {
    this.netDebug?.("connected", this.ndkRelay);
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = void 0;
    }
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = void 0;
    }
    this.updateConnectionStats.connected();
    this._status = 5 /* CONNECTED */;
    this.ndkRelay.emit("connect");
    this.ndkRelay.emit("ready");
  }
  /**
   * Handles the disconnection event when the WebSocket connection is closed.
   * This method is called when the WebSocket connection is successfully closed.
   * It updates the connection statistics, sets the connection status to `DISCONNECTED`,
   * initiates a reconnection attempt if we didn't disconnect ourselves,
   * and emits a `disconnect` event on the `ndkRelay` object.
   */
  onDisconnect() {
    this.netDebug?.("disconnected", this.ndkRelay);
    this.updateConnectionStats.disconnected();
    if (this._status === 5 /* CONNECTED */) {
      this.handleReconnection();
    }
    this._status = 1 /* DISCONNECTED */;
    this.ndkRelay.emit("disconnect");
  }
  /**
   * Handles incoming messages from the NDK relay WebSocket connection.
   * This method is called whenever a message is received from the relay.
   * It parses the message data and dispatches the appropriate handling logic based on the message type.
   *
   * @param event - The MessageEvent containing the received message data.
   */
  onMessage(event) {
    this.netDebug?.(event.data, this.ndkRelay, "recv");
    try {
      const data = JSON.parse(event.data);
      const [cmd, id, ...rest] = data;
      switch (cmd) {
        case "EVENT": {
          const so = this.openSubs.get(id);
          const event2 = data[2];
          if (!so) {
            this.debug(`Received event for unknown subscription ${id}`);
            return;
          }
          so.onevent(event2);
          return;
        }
        case "COUNT": {
          const payload = data[2];
          const cr = this.openCountRequests.get(id);
          if (cr) {
            cr.resolve(payload.count);
            this.openCountRequests.delete(id);
          }
          return;
        }
        case "EOSE": {
          const so = this.openSubs.get(id);
          if (!so) return;
          so.oneose(id);
          return;
        }
        case "OK": {
          const ok = data[2];
          const reason = data[3];
          const ep = this.openEventPublishes.get(id);
          const firstEp = ep?.pop();
          if (!ep || !firstEp) {
            this.debug("Received OK for unknown event publish", id);
            return;
          }
          if (ok) firstEp.resolve(reason);
          else firstEp.reject(new Error(reason));
          if (ep.length === 0) {
            this.openEventPublishes.delete(id);
          } else {
            this.openEventPublishes.set(id, ep);
          }
          return;
        }
        case "CLOSED": {
          const so = this.openSubs.get(id);
          if (!so) return;
          so.onclosed(data[2]);
          return;
        }
        case "NOTICE":
          this.onNotice(data[1]);
          return;
        case "AUTH": {
          this.onAuthRequested(data[1]);
          return;
        }
      }
    } catch (error) {
      this.debug(
        `Error parsing message from ${this.ndkRelay.url}: ${error.message}`,
        error?.stack
      );
      return;
    }
  }
  /**
   * Handles an authentication request from the NDK relay.
   *
   * If an authentication policy is configured, it will be used to authenticate the connection.
   * Otherwise, the `auth` event will be emitted to allow the application to handle the authentication.
   *
   * @param challenge - The authentication challenge provided by the NDK relay.
   */
  async onAuthRequested(challenge) {
    const authPolicy = this.ndkRelay.authPolicy ?? this.ndk?.relayAuthDefaultPolicy;
    this.debug("Relay requested authentication", {
      havePolicy: !!authPolicy
    });
    if (this._status === 7 /* AUTHENTICATING */) {
      this.debug("Already authenticating, ignoring");
      return;
    }
    this._status = 6 /* AUTH_REQUESTED */;
    if (authPolicy) {
      if (this._status >= 5 /* CONNECTED */) {
        this._status = 7 /* AUTHENTICATING */;
        let res;
        try {
          res = await authPolicy(this.ndkRelay, challenge);
        } catch (e) {
          this.debug("Authentication policy threw an error", e);
          res = false;
        }
        this.debug("Authentication policy returned", !!res);
        if (res instanceof NDKEvent || res === true) {
          if (res instanceof NDKEvent) {
            await this.auth(res);
          }
          const authenticate = async () => {
            if (this._status >= 5 /* CONNECTED */ && this._status < 8 /* AUTHENTICATED */) {
              const event = new NDKEvent(this.ndk);
              event.kind = 22242 /* ClientAuth */;
              event.tags = [
                ["relay", this.ndkRelay.url],
                ["challenge", challenge]
              ];
              await event.sign();
              this.auth(event).then(() => {
                this._status = 8 /* AUTHENTICATED */;
                this.ndkRelay.emit("authed");
                this.debug("Authentication successful");
              }).catch((e) => {
                this._status = 6 /* AUTH_REQUESTED */;
                this.ndkRelay.emit("auth:failed", e);
                this.debug("Authentication failed", e);
              });
            } else {
              this.debug(
                "Authentication failed, it changed status, status is %d",
                this._status
              );
            }
          };
          if (res === true) {
            if (!this.ndk?.signer) {
              this.debug("No signer available for authentication localhost");
              this.ndk?.once("signer:ready", authenticate);
            } else {
              authenticate().catch((e) => {
                console.error("Error authenticating", e);
              });
            }
          }
          this._status = 5 /* CONNECTED */;
          this.ndkRelay.emit("authed");
        }
      }
    } else {
      this.ndkRelay.emit("auth", challenge);
    }
  }
  /**
   * Handles errors that occur on the WebSocket connection to the relay.
   * @param error - The error or event that occurred.
   */
  onError(error) {
    this.debug(`WebSocket error on ${this.ndkRelay.url}:`, error);
  }
  /**
   * Gets the current status of the NDK relay connection.
   * @returns {NDKRelayStatus} The current status of the NDK relay connection.
   */
  get status() {
    return this._status;
  }
  /**
   * Checks if the NDK relay connection is currently available.
   * @returns {boolean} `true` if the relay connection is in the `CONNECTED` status, `false` otherwise.
   */
  isAvailable() {
    return this._status === 5 /* CONNECTED */;
  }
  /**
   * Checks if the NDK relay connection is flapping, which means the connection is rapidly
   * disconnecting and reconnecting. This is determined by analyzing the durations of the
   * last three connection attempts. If the standard deviation of the durations is less
   * than 1000 milliseconds, the connection is considered to be flapping.
   *
   * @returns {boolean} `true` if the connection is flapping, `false` otherwise.
   */
  isFlapping() {
    const durations = this._connectionStats.durations;
    if (durations.length % 3 !== 0) return false;
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const variance = durations.map((x) => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    const isFlapping = stdDev < FLAPPING_THRESHOLD_MS;
    return isFlapping;
  }
  /**
   * Handles a notice received from the NDK relay.
   * If the notice indicates the relay is complaining (e.g. "too many" or "maximum"),
   * the method disconnects from the relay and attempts to reconnect after a 2-second delay.
   * A debug message is logged with the relay URL and the notice text.
   * The "notice" event is emitted on the ndkRelay instance with the notice text.
   *
   * @param notice - The notice text received from the NDK relay.
   */
  async onNotice(notice) {
    this.ndkRelay.emit("notice", notice);
  }
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
  handleReconnection(attempt = 0) {
    if (this.reconnectTimeout) return;
    if (this.isFlapping()) {
      this.ndkRelay.emit("flapping", this._connectionStats);
      this._status = 3 /* FLAPPING */;
      return;
    }
    const reconnectDelay = this.connectedAt ? Math.max(0, 6e4 - (Date.now() - this.connectedAt)) : 5e3 * (this._connectionStats.attempts + 1);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = void 0;
      this._status = 2 /* RECONNECTING */;
      this.connect().catch((err) => {
        if (attempt < MAX_RECONNECT_ATTEMPTS) {
          setTimeout(
            () => {
              this.handleReconnection(attempt + 1);
            },
            1e3 * (attempt + 1) ^ 4
          );
        } else {
          this.debug("Reconnect failed");
        }
      });
    }, reconnectDelay);
    this.ndkRelay.emit("delayed-connect", reconnectDelay);
    this.debug("Reconnecting in", reconnectDelay);
    this._connectionStats.nextReconnectAt = Date.now() + reconnectDelay;
  }
  /**
   * Sends a message to the NDK relay if the connection is in the CONNECTED state and the WebSocket is open.
   * If the connection is not in the CONNECTED state or the WebSocket is not open, logs a debug message and throws an error.
   *
   * @param message - The message to send to the NDK relay.
   * @throws {Error} If attempting to send on a closed relay connection.
   */
  async send(message) {
    if (this._status >= 5 /* CONNECTED */ && this.ws?.readyState === WebSocket.OPEN) {
      this.ws?.send(message);
      this.netDebug?.(message, this.ndkRelay, "send");
    } else {
      this.debug(
        `Not connected to ${this.ndkRelay.url} (%d), not sending message ${message}`,
        this._status
      );
    }
  }
  /**
   * Authenticates the NDK event by sending it to the NDK relay and returning a promise that resolves with the result.
   *
   * @param event - The NDK event to authenticate.
   * @returns A promise that resolves with the authentication result.
   */
  async auth(event) {
    const ret = new Promise((resolve, reject) => {
      const val = this.openEventPublishes.get(event.id) ?? [];
      val.push({ resolve, reject });
      this.openEventPublishes.set(event.id, val);
    });
    this.send('["AUTH",' + JSON.stringify(event.rawEvent()) + "]");
    return ret;
  }
  /**
   * Publishes an NDK event to the relay and returns a promise that resolves with the result.
   *
   * @param event - The NDK event to publish.
   * @returns A promise that resolves with the result of the event publication.
   * @throws {Error} If attempting to publish on a closed relay connection.
   */
  async publish(event) {
    const ret = new Promise((resolve, reject) => {
      const val = this.openEventPublishes.get(event.id) ?? [];
      if (val.length > 0) {
        console.warn(
          "Duplicate event publishing detected, you are publishing event " + event.id + " twice"
        );
      }
      val.push({ resolve, reject });
      this.openEventPublishes.set(event.id, val);
    });
    this.send('["EVENT",' + JSON.stringify(event) + "]");
    return ret;
  }
  /**
   * Counts the number of events that match the provided filters.
   *
   * @param filters - The filters to apply to the count request.
   * @param params - An optional object containing a custom id for the count request.
   * @returns A promise that resolves with the number of matching events.
   * @throws {Error} If attempting to send the count request on a closed relay connection.
   */
  async count(filters, params) {
    this.serial++;
    const id = params?.id || "count:" + this.serial;
    const ret = new Promise((resolve, reject) => {
      this.openCountRequests.set(id, { resolve, reject });
    });
    this.send('["COUNT","' + id + '",' + JSON.stringify(filters).substring(1));
    return ret;
  }
  close(subId, reason) {
    this.send('["CLOSE","' + subId + '"]');
    const sub = this.openSubs.get(subId);
    this.openSubs.delete(subId);
    if (sub) sub.onclose(reason);
  }
  /**
   * Subscribes to the NDK relay with the provided filters and parameters.
   *
   * @param filters - The filters to apply to the subscription.
   * @param params - The subscription parameters, including an optional custom id.
   * @returns A new NDKRelaySubscription instance.
   */
  req(relaySub) {
    this.send(
      '["REQ","' + relaySub.subId + '",' + JSON.stringify(relaySub.executeFilters).substring(1)
    ) + "]";
    this.openSubs.set(relaySub.subId, relaySub);
  }
  /**
   * Utility functions to update the connection stats.
   */
  updateConnectionStats = {
    connected: () => {
      this._connectionStats.success++;
      this._connectionStats.connectedAt = Date.now();
    },
    disconnected: () => {
      if (this._connectionStats.connectedAt) {
        this._connectionStats.durations.push(
          Date.now() - this._connectionStats.connectedAt
        );
        if (this._connectionStats.durations.length > 100) {
          this._connectionStats.durations.shift();
        }
      }
      this._connectionStats.connectedAt = void 0;
    },
    attempt: () => {
      this._connectionStats.attempts++;
      this._connectionStats.connectedAt = Date.now();
    }
  };
  /** Returns the connection stats. */
  get connectionStats() {
    return this._connectionStats;
  }
  /** Returns the relay URL */
  get url() {
    return this.ndkRelay.url;
  }
  get connected() {
    return this._status >= 5 /* CONNECTED */ && this.ws?.readyState === WebSocket.OPEN;
  }
};

// src/relay/publisher.ts
var NDKRelayPublisher = class {
  ndkRelay;
  debug;
  constructor(ndkRelay) {
    this.ndkRelay = ndkRelay;
    this.debug = ndkRelay.debug.extend("publisher");
  }
  /**
   * Published an event to the relay; if the relay is not connected, it will
   * wait for the relay to connect before publishing the event.
   *
   * If the relay does not connect within the timeout, the publish operation
   * will fail.
   * @param event  The event to publish
   * @param timeoutMs  The timeout for the publish operation in milliseconds
   * @returns A promise that resolves when the event has been published or rejects if the operation times out
   */
  async publish(event, timeoutMs = 2500) {
    let timeout;
    const publishConnected = () => {
      return new Promise((resolve, reject) => {
        try {
          this.publishEvent(event).then((result) => {
            this.ndkRelay.emit("published", event);
            event.emit("relay:published", this.ndkRelay);
            resolve(true);
          }).catch(reject);
        } catch (err) {
          reject(err);
        }
      });
    };
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        timeout = void 0;
        reject(new Error("Timeout: " + timeoutMs + "ms"));
      }, timeoutMs);
    });
    const onConnectHandler = () => {
      publishConnected().then((result) => connectResolve(result)).catch((err) => connectReject(err));
    };
    let connectResolve;
    let connectReject;
    const onError = (err) => {
      this.ndkRelay.debug("Publish failed", err, event.id);
      this.ndkRelay.emit("publish:failed", event, err);
      event.emit("relay:publish:failed", this.ndkRelay, err);
      throw err;
    };
    const onFinally = () => {
      if (timeout) clearTimeout(timeout);
      this.ndkRelay.removeListener("connect", onConnectHandler);
    };
    if (this.ndkRelay.status >= 5 /* CONNECTED */) {
      return Promise.race([publishConnected(), timeoutPromise]).catch(onError).finally(onFinally);
    } else {
      if (this.ndkRelay.status <= 1 /* DISCONNECTED */) {
        console.warn(
          "Relay is disconnected, trying to connect to publish an event",
          this.ndkRelay.url
        );
        this.ndkRelay.connect();
      } else {
        console.warn(
          "Relay not connected, waiting for connection to publish an event",
          this.ndkRelay.url
        );
      }
      return Promise.race([
        new Promise((resolve, reject) => {
          connectResolve = resolve;
          connectReject = reject;
          this.ndkRelay.once("connect", onConnectHandler);
        }),
        timeoutPromise
      ]).catch(onError).finally(onFinally);
    }
  }
  async publishEvent(event) {
    return this.ndkRelay.connectivity.publish(event.rawEvent());
  }
};

// src/subscription/grouping.ts
function filterFingerprint(filters, closeOnEose) {
  const elements = [];
  for (const filter of filters) {
    const keys = Object.entries(filter || {}).map(([key, values]) => {
      if (["since", "until"].includes(key)) {
        return key + ":" + values;
      } else {
        return key;
      }
    }).sort().join("-");
    elements.push(keys);
  }
  let id = closeOnEose ? "+" : "";
  id += elements.join("|");
  return id;
}
function mergeFilters(filters) {
  const result = [];
  const lastResult = {};
  filters.filter((f) => !!f.limit).forEach((filterWithLimit) => result.push(filterWithLimit));
  filters = filters.filter((f) => !f.limit);
  if (filters.length === 0) return result;
  filters.forEach((filter) => {
    Object.entries(filter).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (lastResult[key] === void 0) {
          lastResult[key] = [...value];
        } else {
          lastResult[key] = Array.from(/* @__PURE__ */ new Set([...lastResult[key], ...value]));
        }
      } else {
        lastResult[key] = value;
      }
    });
  });
  return [...result, lastResult];
}

// src/relay/subscription.ts
var NDKRelaySubscription = class {
  fingerprint;
  items = /* @__PURE__ */ new Map();
  topSubManager;
  debug;
  /**
   * Tracks the status of this REQ.
   */
  status = 0 /* INITIAL */;
  onClose;
  relay;
  /**
   * Whether this subscription has reached EOSE.
   */
  eosed = false;
  /**
   * Timeout at which this subscription will
   * start executing.
   */
  executionTimer;
  /**
   * Track the time at which this subscription will fire.
   */
  fireTime;
  /**
   * The delay type that the current fireTime was calculated with.
   */
  delayType;
  /**
   * The filters that have been executed.
   */
  executeFilters;
  id = Math.random().toString(36).substring(7);
  /**
   *
   * @param fingerprint The fingerprint of this subscription.
   */
  constructor(relay, fingerprint, topSubManager) {
    this.relay = relay;
    this.topSubManager = topSubManager;
    this.debug = relay.debug.extend("subscription-" + this.id);
    this.fingerprint = fingerprint || Math.random().toString(36).substring(7);
  }
  _subId;
  get subId() {
    if (this._subId) return this._subId;
    this._subId = this.fingerprint.slice(0, 15);
    return this._subId;
  }
  subIdParts = /* @__PURE__ */ new Set();
  addSubIdPart(part) {
    this.subIdParts.add(part);
  }
  addItem(subscription, filters) {
    this.debug("Adding item", { filters, internalId: subscription.internalId, status: this.status, fingerprint: this.fingerprint, id: this.subId, items: this.items, itemsSize: this.items.size });
    if (this.items.has(subscription.internalId)) return;
    subscription.on("close", this.removeItem.bind(this, subscription));
    this.items.set(subscription.internalId, { subscription, filters });
    if (this.status !== 3 /* RUNNING */) {
      if (subscription.subId && (!this._subId || this._subId.length < 48)) {
        if (this.status === 0 /* INITIAL */ || this.status === 1 /* PENDING */) {
          this.addSubIdPart(subscription.subId);
        }
      }
    }
    switch (this.status) {
      case 0 /* INITIAL */:
        this.evaluateExecutionPlan(subscription);
        break;
      case 3 /* RUNNING */:
        console.log(
          "BUG: This should not happen: This subscription needs to catch up with a subscription that was already running",
          filters
        );
        break;
      case 1 /* PENDING */:
        this.evaluateExecutionPlan(subscription);
        break;
      case 4 /* CLOSED */:
        this.debug(
          "Subscription is closed, cannot add new items %o (%o)",
          subscription,
          filters
        );
        throw new Error("Cannot add new items to a closed subscription");
    }
  }
  /**
   * A subscription has been closed, remove it from the list of items.
   * @param subscription
   */
  removeItem(subscription) {
    this.items.delete(subscription.internalId);
    if (this.items.size === 0) {
      if (!this.eosed) return;
      this.close();
      this.cleanup();
    }
  }
  close() {
    if (this.status === 4 /* CLOSED */) return;
    const prevStatus = this.status;
    this.status = 4 /* CLOSED */;
    if (prevStatus === 3 /* RUNNING */) {
      try {
        this.relay.close(this.subId);
      } catch (e) {
        this.debug("Error closing subscription", e, this);
      }
    } else {
      this.debug("Subscription wanted to close but it wasn't running, this is probably ok", {
        subId: this.subId,
        prevStatus,
        sub: this
      });
    }
    this.cleanup();
  }
  cleanup() {
    if (this.executionTimer) clearTimeout(this.executionTimer);
    this.relay.off("ready", this.executeOnRelayReady);
    this.relay.off("authed", this.reExecuteAfterAuth);
    if (this.onClose) this.onClose(this);
  }
  evaluateExecutionPlan(subscription) {
    if (!subscription.isGroupable()) {
      this.status = 1 /* PENDING */;
      this.execute();
      return;
    }
    if (subscription.filters.find((filter) => !!filter.limit)) {
      this.executeFilters = this.compileFilters();
      if (this.executeFilters.length >= 10) {
        this.status = 1 /* PENDING */;
        this.execute();
        return;
      }
    }
    const delay = subscription.groupableDelay;
    const delayType = subscription.groupableDelayType;
    if (!delay) throw new Error("Cannot group a subscription without a delay");
    if (this.status === 0 /* INITIAL */) {
      this.schedule(delay, delayType);
    } else {
      const existingDelayType = this.delayType;
      const timeUntilFire = this.fireTime - Date.now();
      if (existingDelayType === "at-least" && delayType === "at-least") {
        if (timeUntilFire < delay) {
          if (this.executionTimer) clearTimeout(this.executionTimer);
          this.schedule(delay, delayType);
        }
      } else if (existingDelayType === "at-least" && delayType === "at-most") {
        if (timeUntilFire > delay) {
          if (this.executionTimer) clearTimeout(this.executionTimer);
          this.schedule(delay, delayType);
        }
      } else if (existingDelayType === "at-most" && delayType === "at-most") {
        if (timeUntilFire > delay) {
          if (this.executionTimer) clearTimeout(this.executionTimer);
          this.schedule(delay, delayType);
        }
      } else if (existingDelayType === "at-most" && delayType === "at-least") {
        if (timeUntilFire > delay) {
          if (this.executionTimer) clearTimeout(this.executionTimer);
          this.schedule(delay, delayType);
        }
      } else {
        throw new Error(
          "Unknown delay type combination " + existingDelayType + " " + delayType
        );
      }
    }
  }
  schedule(delay, delayType) {
    this.status = 1 /* PENDING */;
    const currentTime = Date.now();
    this.fireTime = currentTime + delay;
    this.delayType = delayType;
    const timer = setTimeout(this.execute.bind(this), delay);
    if (delayType === "at-least") {
      this.executionTimer = timer;
    }
  }
  executeOnRelayReady = () => {
    if (this.status !== 2 /* WAITING */) return;
    if (this.items.size === 0) {
      this.debug("No items to execute; this relay was probably too slow to respond and the caller gave up", { status: this.status, fingerprint: this.fingerprint, items: this.items, itemsSize: this.items.size, id: this.id, subId: this.subId });
      this.cleanup();
      return;
    }
    this.debug("Executing on relay ready", { status: this.status, fingerprint: this.fingerprint, items: this.items, itemsSize: this.items.size });
    this.status = 1 /* PENDING */;
    this.execute();
  };
  finalizeSubId() {
    if (this.subIdParts.size > 0) {
      this._subId = Array.from(this.subIdParts).join("-");
    } else {
      this._subId = this.fingerprint.slice(0, 15);
    }
    this._subId += "-" + Math.random().toString(36).substring(2, 7);
  }
  // we do it this way so that we can remove the listener
  reExecuteAfterAuth = (() => {
    const oldSubId = this.subId;
    this.debug("Re-executing after auth", this.items.size);
    if (this.eosed) {
      this.relay.close(this.subId);
    } else {
      this.debug(
        "We are abandoning an opened subscription, once it EOSE's, the handler will close it",
        { oldSubId }
      );
    }
    this._subId = void 0;
    this.status = 1 /* PENDING */;
    this.execute();
    this.debug("Re-executed after auth %s \u{1F449} %s", oldSubId, this.subId);
  }).bind(this);
  execute() {
    if (this.status !== 1 /* PENDING */) {
      return;
    }
    if (!this.relay.connected) {
      this.status = 2 /* WAITING */;
      this.debug("Waiting for relay to be ready", { status: this.status, id: this.subId, fingerprint: this.fingerprint, items: this.items, itemsSize: this.items.size });
      this.relay.once("ready", this.executeOnRelayReady);
      return;
    } else if (this.relay.status < 8 /* AUTHENTICATED */) {
      this.relay.once("authed", this.reExecuteAfterAuth);
    }
    this.status = 3 /* RUNNING */;
    this.finalizeSubId();
    this.executeFilters = this.compileFilters();
    this.relay.req(this);
  }
  onstart() {
  }
  onevent(event) {
    this.topSubManager.dispatchEvent(event, this.relay);
  }
  oneose(subId) {
    this.eosed = true;
    if (subId !== this.subId) {
      this.debug("Received EOSE for an abandoned subscription", subId, this.subId);
      this.relay.close(subId);
      return;
    }
    if (this.items.size === 0) {
      this.close();
    }
    for (const { subscription } of this.items.values()) {
      subscription.eoseReceived(this.relay);
      if (subscription.closeOnEose) {
        this.debug("Removing item because of EOSE", { filters: subscription.filters, internalId: subscription.internalId, status: this.status, fingerprint: this.fingerprint, items: this.items, itemsSize: this.items.size });
        this.removeItem(subscription);
      }
    }
  }
  onclose(reason) {
    this.status = 4 /* CLOSED */;
  }
  onclosed(reason) {
    if (!reason) return;
    for (const { subscription } of this.items.values()) {
      subscription.closedReceived(this.relay, reason);
    }
  }
  /**
   * Grabs the filters from all the subscriptions
   * and merges them into a single filter.
   */
  compileFilters() {
    const mergedFilters = [];
    const filters = Array.from(this.items.values()).map((item) => item.filters);
    if (!filters[0]) {
      this.debug("\u{1F440} No filters to merge", this.items);
      console.error("BUG: No filters to merge!", this.items);
      return [];
    }
    const filterCount = filters[0].length;
    for (let i = 0; i < filterCount; i++) {
      const allFiltersAtIndex = filters.map((filter) => filter[i]);
      mergedFilters.push(...mergeFilters(allFiltersAtIndex));
    }
    return mergedFilters;
  }
};

// src/relay/sub-manager.ts
var NDKRelaySubscriptionManager = class {
  relay;
  subscriptions;
  generalSubManager;
  /**
   * @param relay - The relay instance.
   * @param generalSubManager - The subscription manager instance.
   */
  constructor(relay, generalSubManager) {
    this.relay = relay;
    this.subscriptions = /* @__PURE__ */ new Map();
    this.generalSubManager = generalSubManager;
  }
  /**
   * Adds a subscription to the manager.
   */
  addSubscription(sub, filters) {
    let relaySub;
    if (!sub.isGroupable()) {
      relaySub = this.createSubscription(sub, filters);
    } else {
      const filterFp = filterFingerprint(filters, sub.closeOnEose);
      if (filterFp) {
        const existingSubs = this.subscriptions.get(filterFp);
        relaySub = (existingSubs || []).find(
          (sub2) => sub2.status < 3 /* RUNNING */
        );
      }
      relaySub ??= this.createSubscription(sub, filters, filterFp);
    }
    relaySub.addItem(sub, filters);
  }
  createSubscription(sub, filters, fingerprint) {
    const relaySub = new NDKRelaySubscription(this.relay, fingerprint || null, this.generalSubManager);
    relaySub.onClose = this.onRelaySubscriptionClose.bind(this);
    const currentVal = this.subscriptions.get(relaySub.fingerprint) ?? [];
    this.subscriptions.set(relaySub.fingerprint, [...currentVal, relaySub]);
    return relaySub;
  }
  onRelaySubscriptionClose(sub) {
    let currentVal = this.subscriptions.get(sub.fingerprint) ?? [];
    if (!currentVal) {
      console.warn(
        "Unexpectedly did not find a subscription with fingerprint",
        sub.fingerprint
      );
    } else if (currentVal.length === 1) {
      this.subscriptions.delete(sub.fingerprint);
    } else {
      currentVal = currentVal.filter((s) => s.id !== sub.id);
      this.subscriptions.set(sub.fingerprint, currentVal);
    }
  }
};

// src/relay/index.ts
var NDKRelayStatus = /* @__PURE__ */ ((NDKRelayStatus2) => {
  NDKRelayStatus2[NDKRelayStatus2["DISCONNECTING"] = 0] = "DISCONNECTING";
  NDKRelayStatus2[NDKRelayStatus2["DISCONNECTED"] = 1] = "DISCONNECTED";
  NDKRelayStatus2[NDKRelayStatus2["RECONNECTING"] = 2] = "RECONNECTING";
  NDKRelayStatus2[NDKRelayStatus2["FLAPPING"] = 3] = "FLAPPING";
  NDKRelayStatus2[NDKRelayStatus2["CONNECTING"] = 4] = "CONNECTING";
  NDKRelayStatus2[NDKRelayStatus2["CONNECTED"] = 5] = "CONNECTED";
  NDKRelayStatus2[NDKRelayStatus2["AUTH_REQUESTED"] = 6] = "AUTH_REQUESTED";
  NDKRelayStatus2[NDKRelayStatus2["AUTHENTICATING"] = 7] = "AUTHENTICATING";
  NDKRelayStatus2[NDKRelayStatus2["AUTHENTICATED"] = 8] = "AUTHENTICATED";
  return NDKRelayStatus2;
})(NDKRelayStatus || {});
var NDKRelay = class _NDKRelay extends EventEmitter2 {
  url;
  scores;
  connectivity;
  subs;
  publisher;
  authPolicy;
  /**
   * The lowest validation ratio this relay can reach.
   */
  lowestValidationRatio;
  /**
   * Current validation ratio this relay is targeting.
   */
  targetValidationRatio;
  validationRatioFn;
  /**
   * This tracks events that have been seen by this relay
   * with a valid signature.
   */
  validatedEventCount = 0;
  /**
   * This tracks events that have been seen by this relay
   * but have not been validated.
   */
  nonValidatedEventCount = 0;
  /**
   * Whether this relay is trusted.
   *
   * Trusted relay's events do not get their signature verified.
   */
  trusted = false;
  complaining = false;
  debug;
  static defaultValidationRatioUpdateFn = (relay, validatedCount, nonValidatedCount) => {
    if (relay.lowestValidationRatio === void 0 || relay.targetValidationRatio === void 0)
      return 1;
    let newRatio = relay.validationRatio;
    if (relay.validationRatio > relay.targetValidationRatio) {
      const factor = validatedCount / 100;
      newRatio = Math.max(relay.lowestValidationRatio, relay.validationRatio - factor);
    }
    if (newRatio < relay.validationRatio) {
      return newRatio;
    }
    return relay.validationRatio;
  };
  constructor(url, authPolicy, ndk) {
    super();
    this.url = normalizeRelayUrl(url);
    this.scores = /* @__PURE__ */ new Map();
    this.debug = debug(`ndk:relay:${url}`);
    this.connectivity = new NDKRelayConnectivity(this, ndk);
    this.connectivity.netDebug = ndk?.netDebug;
    this.req = this.connectivity.req.bind(this.connectivity);
    this.close = this.connectivity.close.bind(this.connectivity);
    this.subs = new NDKRelaySubscriptionManager(this, ndk.subManager);
    this.publisher = new NDKRelayPublisher(this);
    this.authPolicy = authPolicy;
    this.targetValidationRatio = ndk?.initialValidationRatio;
    this.lowestValidationRatio = ndk?.lowestValidationRatio;
    this.validationRatioFn = (ndk?.validationRatioFn ?? _NDKRelay.defaultValidationRatioUpdateFn).bind(this);
    this.updateValidationRatio();
    if (!ndk) {
      console.trace("relay created without ndk");
    }
  }
  updateValidationRatio() {
    setTimeout(() => {
      this.updateValidationRatio();
    }, 3e4);
  }
  get status() {
    return this.connectivity.status;
  }
  get connectionStats() {
    return this.connectivity.connectionStats;
  }
  /**
   * Connects to the relay.
   */
  async connect(timeoutMs, reconnect = true) {
    return this.connectivity.connect(timeoutMs, reconnect);
  }
  /**
   * Disconnects from the relay.
   */
  disconnect() {
    if (this.status === 1 /* DISCONNECTED */) {
      return;
    }
    this.connectivity.disconnect();
  }
  /**
   * Queues or executes the subscription of a specific set of filters
   * within this relay.
   *
   * @param subscription NDKSubscription this filters belong to.
   * @param filters Filters to execute
   */
  subscribe(subscription, filters) {
    this.subs.addSubscription(subscription, filters);
  }
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
  async publish(event, timeoutMs = 2500) {
    return this.publisher.publish(event, timeoutMs);
  }
  referenceTags() {
    return [["r", this.url]];
  }
  addValidatedEvent() {
    this.validatedEventCount++;
  }
  addNonValidatedEvent() {
    this.nonValidatedEventCount++;
  }
  /**
   * The current validation ratio this relay has achieved.
   */
  get validationRatio() {
    if (this.nonValidatedEventCount === 0) {
      return 1;
    }
    return this.validatedEventCount / (this.validatedEventCount + this.nonValidatedEventCount);
  }
  shouldValidateEvent() {
    if (this.trusted) {
      return false;
    }
    if (this.targetValidationRatio === void 0) {
      return true;
    }
    return this.validationRatio < this.targetValidationRatio;
  }
  get connected() {
    return this.connectivity.connected;
  }
  req;
  close;
};

// src/relay/pool/index.ts
var NDKPool = class extends EventEmitter3 {
  // TODO: This should probably be an LRU cache
  _relays = /* @__PURE__ */ new Map();
  autoConnectRelays = /* @__PURE__ */ new Set();
  blacklistRelayUrls;
  debug;
  temporaryRelayTimers = /* @__PURE__ */ new Map();
  flappingRelays = /* @__PURE__ */ new Set();
  // A map to store timeouts for each flapping relay.
  backoffTimes = /* @__PURE__ */ new Map();
  ndk;
  constructor(relayUrls = [], blacklistedRelayUrls = [], ndk, debug8) {
    super();
    this.debug = debug8 ?? ndk.debug.extend("pool");
    this.ndk = ndk;
    this.relayUrls = relayUrls;
    this.blacklistRelayUrls = new Set(blacklistedRelayUrls);
  }
  get relays() {
    return this._relays;
  }
  set relayUrls(urls) {
    this._relays.clear();
    for (const relayUrl of urls) {
      const relay = new NDKRelay(relayUrl, void 0, this.ndk);
      relay.connectivity.netDebug = this.ndk.netDebug;
      this.addRelay(relay, false);
    }
  }
  set name(name) {
    this.debug = this.debug.extend(name);
  }
  /**
   * Adds a relay to the pool, and sets a timer to remove it if it is not used within the specified time.
   * @param relay - The relay to add to the pool.
   * @param removeIfUnusedAfter - The time in milliseconds to wait before removing the relay from the pool after it is no longer used.
   */
  useTemporaryRelay(relay, removeIfUnusedAfter = 3e4, filters) {
    const relayAlreadyInPool = this.relays.has(relay.url);
    if (!relayAlreadyInPool) {
      this.addRelay(relay);
      this.debug("Adding temporary relay %s for filters %o", relay.url, filters);
    }
    const existingTimer = this.temporaryRelayTimers.get(relay.url);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    if (!relayAlreadyInPool || existingTimer) {
      const timer = setTimeout(() => {
        if (this.ndk.explicitRelayUrls?.includes(relay.url)) return;
        this.removeRelay(relay.url);
      }, removeIfUnusedAfter);
      this.temporaryRelayTimers.set(relay.url, timer);
    }
  }
  /**
   * Adds a relay to the pool.
   *
   * @param relay - The relay to add to the pool.
   * @param connect - Whether or not to connect to the relay.
   */
  addRelay(relay, connect = true) {
    const isAlreadyInPool = this.relays.has(relay.url);
    const isBlacklisted = this.blacklistRelayUrls?.has(relay.url);
    const isCustomRelayUrl = relay.url.includes("/npub1");
    let reconnect = true;
    const relayUrl = relay.url;
    if (isAlreadyInPool) return;
    if (isBlacklisted) {
      this.debug(`Refusing to add relay ${relayUrl}: blacklisted`);
      return;
    }
    if (isCustomRelayUrl) {
      this.debug(`Refusing to add relay ${relayUrl}: is a filter relay`);
      return;
    }
    if (this.ndk.cacheAdapter?.getRelayStatus) {
      const info = this.ndk.cacheAdapter.getRelayStatus(relayUrl);
      if (info && info.dontConnectBefore) {
        if (info.dontConnectBefore > Date.now()) {
          const delay = info.dontConnectBefore - Date.now();
          this.debug(`Refusing to add relay ${relayUrl}: delayed connect for ${delay}ms`);
          setTimeout(() => {
            this.addRelay(relay, connect);
          }, delay);
          return;
        } else {
          reconnect = false;
        }
      }
    }
    const noticeHandler = (notice) => this.emit("notice", relay, notice);
    const connectHandler = () => this.handleRelayConnect(relayUrl);
    const readyHandler = () => this.handleRelayReady(relay);
    const disconnectHandler = () => this.emit("relay:disconnect", relay);
    const flappingHandler = () => this.handleFlapping(relay);
    const authHandler = (challenge) => this.emit("relay:auth", relay, challenge);
    const authedHandler = () => this.emit("relay:authed", relay);
    relay.off("notice", noticeHandler);
    relay.off("connect", connectHandler);
    relay.off("ready", readyHandler);
    relay.off("disconnect", disconnectHandler);
    relay.off("flapping", flappingHandler);
    relay.off("auth", authHandler);
    relay.off("authed", authedHandler);
    relay.on("notice", noticeHandler);
    relay.on("connect", connectHandler);
    relay.on("ready", readyHandler);
    relay.on("disconnect", disconnectHandler);
    relay.on("flapping", flappingHandler);
    relay.on("auth", authHandler);
    relay.on("authed", authedHandler);
    relay.on("delayed-connect", (delay) => {
      if (this.ndk.cacheAdapter?.updateRelayStatus) {
        this.ndk.cacheAdapter.updateRelayStatus(relay.url, {
          dontConnectBefore: Date.now() + delay
        });
      }
    });
    this.relays.set(relayUrl, relay);
    if (connect) this.autoConnectRelays.add(relayUrl);
    if (connect) {
      this.emit("relay:connecting", relay);
      relay.connect(void 0, reconnect).catch((e) => {
        this.debug(`Failed to connect to relay ${relayUrl}`, e);
      });
    }
  }
  /**
   * Removes a relay from the pool.
   * @param relayUrl - The URL of the relay to remove.
   * @returns {boolean} True if the relay was removed, false if it was not found.
   */
  removeRelay(relayUrl) {
    const relay = this.relays.get(relayUrl);
    if (relay) {
      relay.disconnect();
      this.relays.delete(relayUrl);
      this.autoConnectRelays.delete(relayUrl);
      this.emit("relay:disconnect", relay);
      return true;
    }
    const existingTimer = this.temporaryRelayTimers.get(relayUrl);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.temporaryRelayTimers.delete(relayUrl);
    }
    return false;
  }
  /**
   * Checks whether a relay is already connected in the pool.
   */
  isRelayConnected(url) {
    const normalizedUrl = normalizeRelayUrl(url);
    const relay = this.relays.get(normalizedUrl);
    if (!relay) return false;
    return relay.status === 5 /* CONNECTED */;
  }
  /**
   * Fetches a relay from the pool, or creates a new one if it does not exist.
   *
   * New relays will be attempted to be connected.
   */
  getRelay(url, connect = true, temporary = false, filters) {
    let relay = this.relays.get(normalizeRelayUrl(url));
    if (!relay) {
      relay = new NDKRelay(url, void 0, this.ndk);
      relay.connectivity.netDebug = this.ndk.netDebug;
      if (temporary) {
        this.useTemporaryRelay(relay, 3e4, filters);
      } else {
        this.addRelay(relay, connect);
      }
    }
    return relay;
  }
  handleRelayConnect(relayUrl) {
    const relay = this.relays.get(relayUrl);
    if (!relay) {
      console.error("NDK BUG: relay not found in pool", { relayUrl });
      return;
    }
    this.emit("relay:connect", relay);
    if (this.stats().connected === this.relays.size) {
      this.emit("connect");
    }
  }
  handleRelayReady(relay) {
    this.emit("relay:ready", relay);
  }
  /**
   * Attempts to establish a connection to each relay in the pool.
   *
   * @async
   * @param {number} [timeoutMs] - Optional timeout in milliseconds for each connection attempt.
   * @returns {Promise<void>} A promise that resolves when all connection attempts have completed.
   * @throws {Error} If any of the connection attempts result in an error or timeout.
   */
  async connect(timeoutMs) {
    const promises = [];
    this.debug(
      `Connecting to ${this.relays.size} relays${timeoutMs ? `, timeout ${timeoutMs}...` : ""}`
    );
    const relaysToConnect = new Set(this.autoConnectRelays.keys());
    this.ndk.explicitRelayUrls?.forEach((url) => {
      const normalizedUrl = normalizeRelayUrl(url);
      relaysToConnect.add(normalizedUrl);
    });
    for (const relayUrl of relaysToConnect) {
      const relay = this.relays.get(relayUrl);
      if (!relay) continue;
      const connectPromise = new Promise((resolve, reject) => {
        this.emit("relay:connecting", relay);
        return relay.connect(timeoutMs).then(resolve).catch(reject);
      });
      if (timeoutMs) {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(`Timed out after ${timeoutMs}ms`), timeoutMs);
        });
        promises.push(
          Promise.race([connectPromise, timeoutPromise]).catch((e) => {
            this.debug(
              `Failed to connect to relay ${relay.url}: ${e ?? "No reason specified"}`
            );
          })
        );
      } else {
        promises.push(connectPromise);
      }
    }
    if (timeoutMs) {
      setTimeout(() => {
        const allConnected = this.stats().connected === this.relays.size;
        const someConnected = this.stats().connected > 0;
        if (!allConnected && someConnected) {
          this.emit("connect");
        }
      }, timeoutMs);
    }
    await Promise.all(promises);
  }
  checkOnFlappingRelays() {
    const flappingRelaysCount = this.flappingRelays.size;
    const totalRelays = this.relays.size;
    if (flappingRelaysCount / totalRelays >= 0.8) {
      for (const relayUrl of this.flappingRelays) {
        this.backoffTimes.set(relayUrl, 0);
      }
    }
  }
  handleFlapping(relay) {
    this.debug(`Relay ${relay.url} is flapping`);
    let currentBackoff = this.backoffTimes.get(relay.url) || 5e3;
    currentBackoff = currentBackoff * 2;
    this.backoffTimes.set(relay.url, currentBackoff);
    this.debug(`Backoff time for ${relay.url} is ${currentBackoff}ms`);
    setTimeout(() => {
      this.debug(`Attempting to reconnect to ${relay.url}`);
      this.emit("relay:connecting", relay);
      relay.connect();
      this.checkOnFlappingRelays();
    }, currentBackoff);
    relay.disconnect();
    this.emit("flapping", relay);
  }
  size() {
    return this.relays.size;
  }
  /**
   * Returns the status of each relay in the pool.
   * @returns {NDKPoolStats} An object containing the number of relays in each status.
   */
  stats() {
    const stats = {
      total: 0,
      connected: 0,
      disconnected: 0,
      connecting: 0
    };
    for (const relay of this.relays.values()) {
      stats.total++;
      if (relay.status === 5 /* CONNECTED */) {
        stats.connected++;
      } else if (relay.status === 1 /* DISCONNECTED */) {
        stats.disconnected++;
      } else if (relay.status === 4 /* CONNECTING */) {
        stats.connecting++;
      }
    }
    return stats;
  }
  connectedRelays() {
    return Array.from(this.relays.values()).filter(
      (relay) => relay.status >= 5 /* CONNECTED */
    );
  }
  permanentAndConnectedRelays() {
    return Array.from(this.relays.values()).filter(
      (relay) => relay.status >= 5 /* CONNECTED */ && !this.temporaryRelayTimers.has(relay.url)
    );
  }
  /**
   * Get a list of all relay urls in the pool.
   */
  urls() {
    return Array.from(this.relays.keys());
  }
};

// src/user/index.ts
import { nip19 as nip194 } from "nostr-tools";

// src/subscription/index.ts
import { EventEmitter as EventEmitter4 } from "tseep";

// src/subscription/utils.ts
import { nip19 as nip193 } from "nostr-tools";
var MAX_SUBID_LENGTH = 20;
function queryFullyFilled(subscription) {
  if (filterIncludesIds(subscription.filter)) {
    if (resultHasAllRequestedIds(subscription)) {
      return true;
    }
  }
  return false;
}
function compareFilter(filter1, filter2) {
  if (Object.keys(filter1).length !== Object.keys(filter2).length) return false;
  for (const [key, value] of Object.entries(filter1)) {
    const valuesInFilter2 = filter2[key];
    if (!valuesInFilter2) return false;
    if (Array.isArray(value) && Array.isArray(valuesInFilter2)) {
      const v = value;
      for (const valueInFilter2 of valuesInFilter2) {
        const val = valueInFilter2;
        if (!v.includes(val)) {
          return false;
        }
      }
    } else {
      if (valuesInFilter2 !== value) return false;
    }
  }
  return true;
}
function filterIncludesIds(filter) {
  return !!filter["ids"];
}
function resultHasAllRequestedIds(subscription) {
  const ids = subscription.filter["ids"];
  return !!ids && ids.length === subscription.eventFirstSeen.size;
}
function generateSubId(subscriptions, filters) {
  const subIds = subscriptions.map((sub) => sub.subId).filter(Boolean);
  const subIdParts = [];
  const filterNonKindKeys = /* @__PURE__ */ new Set();
  const filterKinds = /* @__PURE__ */ new Set();
  if (subIds.length > 0) {
    subIdParts.push(Array.from(new Set(subIds)).join(","));
  } else {
    for (const filter of filters) {
      for (const key of Object.keys(filter)) {
        if (key === "kinds") {
          filter.kinds?.forEach((k) => filterKinds.add(k));
        } else {
          filterNonKindKeys.add(key);
        }
      }
    }
    if (filterKinds.size > 0) {
      subIdParts.push("kinds:" + Array.from(filterKinds).join(","));
    }
    if (filterNonKindKeys.size > 0) {
      subIdParts.push(Array.from(filterNonKindKeys).join(","));
    }
  }
  let subId = subIdParts.join("-");
  if (subId.length > MAX_SUBID_LENGTH) subId = subId.substring(0, MAX_SUBID_LENGTH);
  subId += "-" + Math.floor(Math.random() * 999).toString();
  return subId;
}
function filterForEventsTaggingId(id) {
  try {
    const decoded = nip193.decode(id);
    switch (decoded.type) {
      case "naddr":
        return {
          "#a": [
            `${decoded.data.kind}:${decoded.data.pubkey}:${decoded.data.identifier}`
          ]
        };
      case "nevent":
        return { "#e": [decoded.data.id] };
      case "note":
        return { "#e": [decoded.data] };
      case "nprofile":
        return { "#p": [decoded.data.pubkey] };
      case "npub":
        return { "#p": [decoded.data] };
    }
  } catch {
  }
}
function filterAndRelaySetFromBech32(beche2, ndk) {
  const filter = filterFromId(beche2);
  const relays = relaysFromBech32(beche2, ndk);
  if (relays.length === 0) return { filter };
  return {
    filter,
    relaySet: new NDKRelaySet(new Set(relays), ndk)
  };
}
function filterFromId(id) {
  let decoded;
  if (id.match(NIP33_A_REGEX)) {
    const [kind, pubkey, identifier] = id.split(":");
    const filter = {
      authors: [pubkey],
      kinds: [parseInt(kind)]
    };
    if (identifier) {
      filter["#d"] = [identifier];
    }
    return filter;
  }
  if (id.match(BECH32_REGEX)) {
    try {
      decoded = nip193.decode(id);
      switch (decoded.type) {
        case "nevent": {
          const filter2 = { ids: [decoded.data.id] };
          if (decoded.data.author) filter2.authors = [decoded.data.author];
          if (decoded.data.kind) filter2.kinds = [decoded.data.kind];
          return filter2;
        }
        case "note":
          return { ids: [decoded.data] };
        case "naddr":
          const filter = {
            authors: [decoded.data.pubkey],
            kinds: [decoded.data.kind]
          };
          if (decoded.data.identifier) filter["#d"] = [decoded.data.identifier];
          return filter;
      }
    } catch (e) {
      console.error("Error decoding", id, e);
    }
  }
  return { ids: [id] };
}
function isNip33AValue(value) {
  return value.match(NIP33_A_REGEX) !== null;
}
var NIP33_A_REGEX = /^(\d+):([0-9A-Fa-f]+)(?::(.*))?$/;
var BECH32_REGEX = /^n(event|ote|profile|pub|addr)1[\d\w]+$/;
function relaysFromBech32(bech322, ndk) {
  try {
    const decoded = nip193.decode(bech322);
    if (["naddr", "nevent"].includes(decoded?.type)) {
      const data = decoded.data;
      if (data?.relays) {
        return data.relays.map(
          (r) => new NDKRelay(r, ndk.relayAuthDefaultPolicy, ndk)
        );
      }
    }
  } catch (e) {
  }
  return [];
}

// src/subscription/index.ts
var NDKSubscriptionCacheUsage = /* @__PURE__ */ ((NDKSubscriptionCacheUsage2) => {
  NDKSubscriptionCacheUsage2["ONLY_CACHE"] = "ONLY_CACHE";
  NDKSubscriptionCacheUsage2["CACHE_FIRST"] = "CACHE_FIRST";
  NDKSubscriptionCacheUsage2["PARALLEL"] = "PARALLEL";
  NDKSubscriptionCacheUsage2["ONLY_RELAY"] = "ONLY_RELAY";
  return NDKSubscriptionCacheUsage2;
})(NDKSubscriptionCacheUsage || {});
var defaultOpts = {
  closeOnEose: false,
  cacheUsage: "CACHE_FIRST" /* CACHE_FIRST */,
  groupable: true,
  groupableDelay: 100,
  groupableDelayType: "at-most"
};
var NDKSubscription = class extends EventEmitter4 {
  subId;
  filters;
  opts;
  pool;
  skipVerification = false;
  skipValidation = false;
  /**
   * Tracks the filters as they are executed on each relay
   */
  relayFilters;
  relaySet;
  ndk;
  debug;
  /**
   * Events that have been seen by the subscription, with the time they were first seen.
   */
  eventFirstSeen = /* @__PURE__ */ new Map();
  /**
   * Relays that have sent an EOSE.
   */
  eosesSeen = /* @__PURE__ */ new Set();
  /**
   * The time the last event was received by the subscription.
   * This is used to calculate when EOSE should be emitted.
   */
  lastEventReceivedAt;
  internalId;
  /**
   * Whether the subscription should close when all relays have reached the end of the event stream.
   */
  closeOnEose;
  /**
   * Pool monitor callback
   */
  poolMonitor;
  skipOptimisticPublishEvent = false;
  constructor(ndk, filters, opts, relaySet, subId) {
    super();
    this.ndk = ndk;
    this.pool = opts?.pool || ndk.pool;
    this.opts = { ...defaultOpts, ...opts || {} };
    this.filters = filters instanceof Array ? filters : [filters];
    this.subId = subId || opts?.subId;
    this.internalId = Math.random().toString(36).substring(7);
    this.relaySet = relaySet;
    this.debug = ndk.debug.extend(`subscription[${opts?.subId ?? this.internalId}]`);
    this.skipVerification = opts?.skipVerification || false;
    this.skipValidation = opts?.skipValidation || false;
    this.closeOnEose = opts?.closeOnEose || false;
    this.skipOptimisticPublishEvent = opts?.skipOptimisticPublishEvent || false;
    if (this.opts.cacheUsage === "ONLY_CACHE" /* ONLY_CACHE */ && !this.opts.closeOnEose) {
      throw new Error("Cannot use cache-only options with a persistent subscription");
    }
  }
  /**
   * Returns the relays that have not yet sent an EOSE.
   */
  relaysMissingEose() {
    if (!this.relayFilters) return [];
    const relaysMissingEose = Array.from(this.relayFilters.keys()).filter(
      (url) => !this.eosesSeen.has(this.pool.getRelay(url, false, false))
    );
    return relaysMissingEose;
  }
  /**
   * Provides access to the first filter of the subscription for
   * backwards compatibility.
   */
  get filter() {
    return this.filters[0];
  }
  get groupableDelay() {
    if (!this.isGroupable()) return void 0;
    return this.opts?.groupableDelay;
  }
  get groupableDelayType() {
    return this.opts?.groupableDelayType || "at-most";
  }
  isGroupable() {
    return this.opts?.groupable || false;
  }
  shouldQueryCache() {
    return this.opts?.cacheUsage !== "ONLY_RELAY" /* ONLY_RELAY */;
  }
  shouldQueryRelays() {
    return this.opts?.cacheUsage !== "ONLY_CACHE" /* ONLY_CACHE */;
  }
  shouldWaitForCache() {
    return (
      // Must want to close on EOSE; subscriptions
      // that want to receive further updates must
      // always hit the relay
      this.opts.closeOnEose && // Cache adapter must claim to be fast
      !!this.ndk.cacheAdapter?.locking && // If explicitly told to run in parallel, then
      // we should not wait for the cache
      this.opts.cacheUsage !== "PARALLEL" /* PARALLEL */
    );
  }
  /**
   * Start the subscription. This is the main method that should be called
   * after creating a subscription.
   */
  async start() {
    let cachePromise;
    if (this.shouldQueryCache()) {
      cachePromise = this.startWithCache();
      cachePromise.then(() => this.emit("cacheEose"));
      if (this.shouldWaitForCache()) {
        await cachePromise;
        if (queryFullyFilled(this)) {
          this.emit("eose", this);
          return;
        }
      }
    }
    if (this.shouldQueryRelays()) {
      this.startWithRelays();
      this.startPoolMonitor();
    } else {
      this.emit("eose", this);
    }
    return;
  }
  /**
   * We want to monitor for new relays that are coming online, in case
   * they should be part of this subscription.
   */
  startPoolMonitor() {
    const d4 = this.debug.extend("pool-monitor");
    this.poolMonitor = (relay) => {
      if (this.relayFilters?.has(relay.url)) return;
      const calc = calculateRelaySetsFromFilters(this.ndk, this.filters, this.pool);
      if (calc.get(relay.url)) {
        this.relayFilters?.set(relay.url, this.filters);
        relay.subscribe(this, this.filters);
      }
    };
    this.pool.on("relay:connect", this.poolMonitor);
  }
  onStopped;
  stop() {
    this.emit("close", this);
    this.poolMonitor && this.pool.off("relay:connect", this.poolMonitor);
    this.removeAllListeners();
    this.onStopped?.();
  }
  /**
   * @returns Whether the subscription has an authors filter.
   */
  hasAuthorsFilter() {
    return this.filters.some((f) => f.authors?.length);
  }
  async startWithCache() {
    if (this.ndk.cacheAdapter?.query) {
      const promise = this.ndk.cacheAdapter.query(this);
      if (this.ndk.cacheAdapter.locking) {
        await promise;
      }
    }
  }
  /**
   * Send REQ to relays
   */
  startWithRelays() {
    if (!this.relaySet || this.relaySet.relays.size === 0) {
      this.relayFilters = calculateRelaySetsFromFilters(this.ndk, this.filters, this.pool);
    } else {
      this.relayFilters = /* @__PURE__ */ new Map();
      for (const relay of this.relaySet.relays) {
        this.relayFilters.set(relay.url, this.filters);
      }
    }
    if (!this.relayFilters || this.relayFilters.size === 0) return;
    for (const [relayUrl, filters] of this.relayFilters) {
      const relay = this.pool.getRelay(relayUrl, true, true, filters);
      relay.subscribe(this, filters);
    }
  }
  // EVENT handling
  /**
   * Called when an event is received from a relay or the cache
   * @param event
   * @param relay
   * @param fromCache Whether the event was received from the cache
   * @param optimisticPublish Whether this event is coming from an optimistic publish
   */
  eventReceived(event, relay, fromCache = false, optimisticPublish = false) {
    const eventId = event.id;
    const eventAlreadySeen = this.eventFirstSeen.has(eventId);
    let ndkEvent;
    if (event instanceof NDKEvent) ndkEvent = event;
    if (!eventAlreadySeen) {
      ndkEvent ??= new NDKEvent(this.ndk, event);
      ndkEvent.ndk = this.ndk;
      ndkEvent.relay = relay;
      if (!fromCache && !optimisticPublish) {
        if (!this.skipValidation) {
          if (!ndkEvent.isValid) {
            this.debug(`Event failed validation %s from relay %s`, eventId, relay?.url);
            return;
          }
        }
        if (relay) {
          if (relay?.shouldValidateEvent() !== false) {
            if (!this.skipVerification) {
              if (!ndkEvent.verifySignature(true) && !this.ndk.asyncSigVerification) {
                this.debug(`Event failed signature validation`, event);
                return;
              } else if (relay) {
                relay.addValidatedEvent();
              }
            }
          } else {
            relay.addNonValidatedEvent();
          }
        }
        if (this.ndk.cacheAdapter) {
          this.ndk.cacheAdapter.setEvent(ndkEvent, this.filters, relay);
        }
      }
      if (!fromCache && relay) {
        this.ndk.emit("event", ndkEvent, relay);
      }
      if (!optimisticPublish || this.skipOptimisticPublishEvent !== true) {
        this.emit("event", ndkEvent, relay, this);
        this.eventFirstSeen.set(eventId, Date.now());
      }
    } else {
      const timeSinceFirstSeen = Date.now() - (this.eventFirstSeen.get(eventId) || 0);
      this.emit("event:dup", eventId, relay, timeSinceFirstSeen, this);
      if (relay) {
        const signature = verifiedSignatures.get(eventId);
        if (signature && typeof signature === "string") {
          if (event.sig === signature) {
            relay.addValidatedEvent();
          }
        }
      }
    }
    this.lastEventReceivedAt = Date.now();
  }
  closedReceived(relay, reason) {
    this.emit("closed", relay, reason);
  }
  // EOSE handling
  eoseTimeout;
  eosed = false;
  eoseReceived(relay) {
    this.debug("EOSE received from %s", relay.url);
    this.eosesSeen.add(relay);
    let lastEventSeen = this.lastEventReceivedAt ? Date.now() - this.lastEventReceivedAt : void 0;
    const hasSeenAllEoses = this.eosesSeen.size === this.relayFilters?.size;
    const queryFilled = queryFullyFilled(this);
    const performEose = (reason) => {
      this.debug("Performing EOSE: %s %d", reason, this.eosed);
      if (this.eosed) return;
      if (this.eoseTimeout) clearTimeout(this.eoseTimeout);
      this.emit("eose", this);
      this.eosed = true;
    };
    if (queryFilled || hasSeenAllEoses) {
      performEose("query filled or seen all");
    } else if (this.relayFilters) {
      let timeToWaitForNextEose = 1e3;
      const connectedRelays = new Set(this.pool.connectedRelays().map((r) => r.url));
      const connectedRelaysWithFilters = Array.from(this.relayFilters.keys()).filter(
        (url) => connectedRelays.has(url)
      );
      if (connectedRelaysWithFilters.length === 0) {
        return;
      }
      const percentageOfRelaysThatHaveSentEose = this.eosesSeen.size / connectedRelaysWithFilters.length;
      this.debug("Percentage of relays that have sent EOSE", { subId: this.subId, percentageOfRelaysThatHaveSentEose, seen: this.eosesSeen.size, total: connectedRelaysWithFilters.length });
      if (this.eosesSeen.size >= 2 && percentageOfRelaysThatHaveSentEose >= 0.5) {
        timeToWaitForNextEose = timeToWaitForNextEose * (1 - percentageOfRelaysThatHaveSentEose);
        if (timeToWaitForNextEose === 0) {
          performEose("time to wait was 0");
          return;
        }
        if (this.eoseTimeout) clearTimeout(this.eoseTimeout);
        const sendEoseTimeout = () => {
          lastEventSeen = this.lastEventReceivedAt ? Date.now() - this.lastEventReceivedAt : void 0;
          if (lastEventSeen !== void 0 && lastEventSeen < 20) {
            this.eoseTimeout = setTimeout(sendEoseTimeout, timeToWaitForNextEose);
          } else {
            performEose("send eose timeout: " + timeToWaitForNextEose);
          }
        };
        this.eoseTimeout = setTimeout(sendEoseTimeout, timeToWaitForNextEose);
      }
    }
  }
};

// src/user/follows.ts
async function follows(opts, outbox, kind = 3 /* Contacts */) {
  if (!this.ndk) throw new Error("NDK not set");
  const contactListEvent = await this.ndk.fetchEvent(
    { kinds: [kind], authors: [this.pubkey] },
    opts || { groupable: false }
  );
  if (contactListEvent) {
    const pubkeys = /* @__PURE__ */ new Set();
    contactListEvent.tags.forEach((tag) => {
      if (tag[0] === "p") pubkeys.add(tag[1]);
    });
    if (outbox) {
      this.ndk?.outboxTracker?.trackUsers(Array.from(pubkeys));
    }
    return [...pubkeys].reduce((acc, pubkey) => {
      const user = new NDKUser({ pubkey });
      user.ndk = this.ndk;
      acc.add(user);
      return acc;
    }, /* @__PURE__ */ new Set());
  }
  return /* @__PURE__ */ new Set();
}

// src/user/profile.ts
function profileFromEvent(event) {
  const profile = {};
  let payload;
  try {
    payload = JSON.parse(event.content);
  } catch (error) {
    throw new Error(`Failed to parse profile event: ${error}`);
  }
  profile.created_at = event.created_at;
  profile.profileEvent = JSON.stringify(event.rawEvent());
  Object.keys(payload).forEach((key) => {
    switch (key) {
      case "name":
        profile.name = payload.name;
        break;
      case "display_name":
        profile.displayName = payload.display_name;
        break;
      case "image":
      case "picture":
        profile.image = payload.picture || payload.image;
        break;
      case "banner":
        profile.banner = payload.banner;
        break;
      case "bio":
        profile.bio = payload.bio;
        break;
      case "nip05":
        profile.nip05 = payload.nip05;
        break;
      case "lud06":
        profile.lud06 = payload.lud06;
        break;
      case "lud16":
        profile.lud16 = payload.lud16;
        break;
      case "about":
        profile.about = payload.about;
        break;
      case "zapService":
        profile.zapService = payload.zapService;
        break;
      case "website":
        profile.website = payload.website;
        break;
      default:
        profile[key] = payload[key];
        break;
    }
  });
  return profile;
}
function serializeProfile(profile) {
  const payload = {};
  for (const [key, val] of Object.entries(profile)) {
    switch (key) {
      case "username":
      case "name":
        payload.name = val;
        break;
      case "displayName":
        payload.display_name = val;
        break;
      case "image":
      case "picture":
        payload.picture = val;
        break;
      case "bio":
      case "about":
        payload.about = val;
        break;
      default:
        payload[key] = val;
        break;
    }
  }
  return JSON.stringify(payload);
}

// src/user/nip05.ts
var NIP05_REGEX = /^(?:([\w.+-]+)@)?([\w.-]+)$/;
async function getNip05For(ndk, fullname, _fetch = fetch, fetchOpts = {}) {
  return await ndk.queuesNip05.add({
    id: fullname,
    func: async () => {
      if (ndk.cacheAdapter && ndk.cacheAdapter.loadNip05) {
        const profile = await ndk.cacheAdapter.loadNip05(fullname);
        if (profile !== "missing") {
          if (profile) {
            const user = new NDKUser({
              pubkey: profile.pubkey,
              relayUrls: profile.relays,
              nip46Urls: profile.nip46
            });
            user.ndk = ndk;
            return user;
          } else if (fetchOpts.cache !== "no-cache") {
            return null;
          }
        }
      }
      const match = fullname.match(NIP05_REGEX);
      if (!match) return null;
      const [_, name = "_", domain] = match;
      try {
        const res = await _fetch(
          `https://${domain}/.well-known/nostr.json?name=${name}`,
          fetchOpts
        );
        const { names, relays, nip46 } = parseNIP05Result(await res.json());
        const pubkey = names[name.toLowerCase()];
        let profile = null;
        if (pubkey) {
          profile = { pubkey, relays: relays?.[pubkey], nip46: nip46?.[pubkey] };
        }
        if (ndk?.cacheAdapter && ndk.cacheAdapter.saveNip05) {
          ndk.cacheAdapter.saveNip05(fullname, profile);
        }
        return profile;
      } catch (_e) {
        if (ndk?.cacheAdapter && ndk.cacheAdapter.saveNip05) {
          ndk?.cacheAdapter.saveNip05(fullname, null);
        }
        console.error("Failed to fetch NIP05 for", fullname, _e);
        return null;
      }
    }
  });
}
function parseNIP05Result(json) {
  const result = {
    names: {}
  };
  for (const [name, pubkey] of Object.entries(json.names)) {
    if (typeof name === "string" && typeof pubkey === "string") {
      result.names[name.toLowerCase()] = pubkey;
    }
  }
  if (json.relays) {
    result.relays = {};
    for (const [pubkey, relays] of Object.entries(json.relays)) {
      if (typeof pubkey === "string" && Array.isArray(relays)) {
        result.relays[pubkey] = relays.filter(
          (relay) => typeof relay === "string"
        );
      }
    }
  }
  if (json.nip46) {
    result.nip46 = {};
    for (const [pubkey, nip46] of Object.entries(json.nip46)) {
      if (typeof pubkey === "string" && Array.isArray(nip46)) {
        result.nip46[pubkey] = nip46.filter((relay) => typeof relay === "string");
      }
    }
  }
  return result;
}

// src/events/kinds/nutzap/mint-list.ts
var NDKCashuMintList = class _NDKCashuMintList extends NDKEvent {
  static kind = 10019 /* CashuMintList */;
  static kinds = [10019 /* CashuMintList */];
  _p2pk;
  constructor(ndk, event) {
    super(ndk, event);
    this.kind ??= 10019 /* CashuMintList */;
  }
  static from(event) {
    return new _NDKCashuMintList(event.ndk, event);
  }
  set relays(urls) {
    this.tags = this.tags.filter((t) => t[0] !== "relay");
    for (const url of urls) {
      this.tags.push(["relay", url]);
    }
  }
  get relays() {
    const r = [];
    for (const tag of this.tags) {
      if (tag[0] === "relay") {
        r.push(tag[1]);
      }
    }
    return r;
  }
  set mints(urls) {
    this.tags = this.tags.filter((t) => t[0] !== "mint");
    for (const url of urls) {
      this.tags.push(["mint", url]);
    }
  }
  get mints() {
    const r = [];
    for (const tag of this.tags) {
      if (tag[0] === "mint") {
        r.push(tag[1]);
      }
    }
    return Array.from(new Set(r));
  }
  get p2pk() {
    if (this._p2pk) {
      return this._p2pk;
    }
    this._p2pk = this.tagValue("pubkey") ?? this.pubkey;
    return this._p2pk;
  }
  set p2pk(pubkey) {
    this._p2pk = pubkey;
    this.removeTag("pubkey");
    if (pubkey) {
      this.tags.push(["pubkey", pubkey]);
    }
  }
  get relaySet() {
    return NDKRelaySet.fromRelayUrls(this.relays, this.ndk);
  }
};

// src/zapper/ln.ts
import { bech32 } from "@scure/base";
import createDebug2 from "debug";
var d2 = createDebug2("ndk:zapper:ln");
async function getNip57ZapSpecFromLud({ lud06, lud16 }, ndk) {
  let zapEndpoint;
  if (lud16 && !lud16.startsWith("LNURL")) {
    const [name, domain] = lud16.split("@");
    zapEndpoint = `https://${domain}/.well-known/lnurlp/${name}`;
  } else if (lud06) {
    const { words } = bech32.decode(lud06, 1e3);
    const data = bech32.fromWords(words);
    const utf8Decoder = new TextDecoder("utf-8");
    zapEndpoint = utf8Decoder.decode(data);
  }
  if (!zapEndpoint) {
    d2("No zap endpoint found %o", { lud06, lud16 });
    throw new Error("No zap endpoint found");
  }
  try {
    const _fetch = ndk.httpFetch || fetch;
    const response = await _fetch(zapEndpoint);
    if (response.status !== 200) {
      const text = await response.text();
      throw new Error(`Unable to fetch zap endpoint ${zapEndpoint}: ${text}`);
    }
    return await response.json();
  } catch (e) {
    throw new Error(`Unable to fetch zap endpoint ${zapEndpoint}: ${e}`);
  }
}

// src/user/index.ts
var NDKUser = class _NDKUser {
  ndk;
  profile;
  _npub;
  _pubkey;
  relayUrls = [];
  nip46Urls = [];
  constructor(opts) {
    if (opts.npub) this._npub = opts.npub;
    if (opts.hexpubkey) this._pubkey = opts.hexpubkey;
    if (opts.pubkey) this._pubkey = opts.pubkey;
    if (opts.relayUrls) this.relayUrls = opts.relayUrls;
    if (opts.nip46Urls) this.nip46Urls = opts.nip46Urls;
  }
  get npub() {
    if (!this._npub) {
      if (!this._pubkey) throw new Error("pubkey not set");
      this._npub = nip194.npubEncode(this.pubkey);
    }
    return this._npub;
  }
  get nprofile() {
    console.log("encoding with pubkey", this.pubkey);
    return nip194.nprofileEncode({
      pubkey: this.pubkey
    });
  }
  set npub(npub) {
    this._npub = npub;
  }
  /**
   * Get the user's hexpubkey
   * @returns {Hexpubkey} The user's hexpubkey
   *
   * @deprecated Use `pubkey` instead
   */
  get hexpubkey() {
    return this.pubkey;
  }
  /**
   * Set the user's hexpubkey
   * @param pubkey {Hexpubkey} The user's hexpubkey
   * @deprecated Use `pubkey` instead
   */
  set hexpubkey(pubkey) {
    this._pubkey = pubkey;
  }
  /**
   * Get the user's pubkey
   * @returns {string} The user's pubkey
   */
  get pubkey() {
    if (!this._pubkey) {
      if (!this._npub) throw new Error("npub not set");
      this._pubkey = nip194.decode(this.npub).data;
    }
    return this._pubkey;
  }
  /**
   * Set the user's pubkey
   * @param pubkey {string} The user's pubkey
   */
  set pubkey(pubkey) {
    this._pubkey = pubkey;
  }
  /**
   * Gets NIP-57 and NIP-61 information that this user has signaled
   *
   * @param getAll {boolean} Whether to get all zap info or just the first one
   */
  async getZapInfo(getAll = true, methods = ["nip61", "nip57"]) {
    if (!this.ndk) throw new Error("No NDK instance found");
    const kinds = [];
    if (methods.includes("nip61")) kinds.push(10019 /* CashuMintList */);
    if (methods.includes("nip57")) kinds.push(0 /* Metadata */);
    if (kinds.length === 0) return [];
    let events = await this.ndk.fetchEvents(
      { kinds, authors: [this.pubkey] },
      {
        cacheUsage: "ONLY_CACHE" /* ONLY_CACHE */,
        groupable: false
      }
    );
    if (events.size < methods.length) {
      events = await this.ndk.fetchEvents(
        { kinds, authors: [this.pubkey] },
        {
          cacheUsage: "ONLY_RELAY" /* ONLY_RELAY */
        }
      );
    }
    const res = [];
    const nip61 = Array.from(events).find((e) => e.kind === 10019 /* CashuMintList */);
    const nip572 = Array.from(events).find((e) => e.kind === 0 /* Metadata */);
    if (nip61) {
      const mintList = NDKCashuMintList.from(nip61);
      if (mintList.mints.length > 0) {
        res.push({
          type: "nip61",
          data: {
            mints: mintList.mints,
            relays: mintList.relays,
            p2pk: mintList.p2pk
          }
        });
      }
      if (!getAll) return res;
    }
    if (nip572) {
      const profile = profileFromEvent(nip572);
      const { lud06, lud16 } = profile;
      try {
        const zapSpec = await getNip57ZapSpecFromLud({ lud06, lud16 }, this.ndk);
        if (zapSpec) {
          res.push({ type: "nip57", data: zapSpec });
        }
      } catch (e) {
        console.error("Error getting NIP-57 zap spec", e);
      }
    }
    return res;
  }
  /**
   * Determines whether this user
   * has signaled support for NIP-60 zaps
   **/
  // export type UserZapConfiguration = {
  // }
  // async getRecipientZapConfig(): Promise<> {
  // }
  /**
   * Retrieves the zapper this pubkey has designated as an issuer of zap receipts
   */
  async getZapConfiguration(ndk) {
    ndk ??= this.ndk;
    if (!ndk) throw new Error("No NDK instance found");
    const process = async () => {
      if (this.ndk?.cacheAdapter?.loadUsersLNURLDoc) {
        const doc = await this.ndk.cacheAdapter.loadUsersLNURLDoc(this.pubkey);
        if (doc !== "missing") {
          if (doc === null) return;
          if (doc) return doc;
        }
      }
      let lnurlspec;
      try {
        await this.fetchProfile({ groupable: false });
        if (this.profile) {
          const { lud06, lud16 } = this.profile;
          lnurlspec = await getNip57ZapSpecFromLud({ lud06, lud16 }, ndk);
        }
      } catch {
      }
      if (this.ndk?.cacheAdapter?.saveUsersLNURLDoc) {
        this.ndk.cacheAdapter.saveUsersLNURLDoc(this.pubkey, lnurlspec || null);
      }
      if (!lnurlspec) return;
      return lnurlspec;
    };
    return await ndk.queuesZapConfig.add({
      id: this.pubkey,
      func: process
    });
  }
  /**
   * Fetches the zapper's pubkey for the zapped user
   * @returns The zapper's pubkey if one can be found
   */
  async getZapperPubkey() {
    const zapConfig = await this.getZapConfiguration();
    return zapConfig?.nostrPubkey;
  }
  /**
   * Instantiate an NDKUser from a NIP-05 string
   * @param nip05Id {string} The user's NIP-05
   * @param ndk {NDK} An NDK instance
   * @param skipCache {boolean} Whether to skip the cache or not
   * @returns {NDKUser | undefined} An NDKUser if one is found for the given NIP-05, undefined otherwise.
   */
  static async fromNip05(nip05Id, ndk, skipCache = false) {
    if (!ndk) throw new Error("No NDK instance found");
    const opts = {};
    if (skipCache) opts.cache = "no-cache";
    const profile = await getNip05For(ndk, nip05Id, ndk?.httpFetch, opts);
    if (profile) {
      const user = new _NDKUser({
        pubkey: profile.pubkey,
        relayUrls: profile.relays,
        nip46Urls: profile.nip46
      });
      user.ndk = ndk;
      return user;
    }
  }
  /**
   * Fetch a user's profile
   * @param opts {NDKSubscriptionOptions} A set of NDKSubscriptionOptions
   * @param storeProfileEvent {boolean} Whether to store the profile event or not
   * @returns User Profile
   */
  async fetchProfile(opts, storeProfileEvent = false) {
    if (!this.ndk) throw new Error("NDK not set");
    if (!this.profile) this.profile = {};
    let setMetadataEvents = null;
    if (this.ndk.cacheAdapter && this.ndk.cacheAdapter.fetchProfile && opts?.cacheUsage !== "ONLY_RELAY" /* ONLY_RELAY */) {
      const profile = await this.ndk.cacheAdapter.fetchProfile(this.pubkey);
      if (profile) {
        this.profile = profile;
        return profile;
      }
    }
    if (!opts && // if no options have been set
    this.ndk.cacheAdapter && // and we have a cache
    this.ndk.cacheAdapter.locking) {
      setMetadataEvents = await this.ndk.fetchEvents(
        {
          kinds: [0],
          authors: [this.pubkey]
        },
        {
          cacheUsage: "ONLY_CACHE" /* ONLY_CACHE */,
          closeOnEose: true,
          groupable: false
        }
      );
      opts = {
        cacheUsage: "ONLY_RELAY" /* ONLY_RELAY */,
        closeOnEose: true,
        groupable: true,
        groupableDelay: 250
      };
    }
    if (!setMetadataEvents || setMetadataEvents.size === 0) {
      setMetadataEvents = await this.ndk.fetchEvents(
        {
          kinds: [0],
          authors: [this.pubkey]
        },
        opts
      );
    }
    const sortedSetMetadataEvents = Array.from(setMetadataEvents).sort(
      (a, b) => a.created_at - b.created_at
    );
    if (sortedSetMetadataEvents.length === 0) return null;
    const event = sortedSetMetadataEvents[0];
    this.profile = profileFromEvent(event);
    if (storeProfileEvent) {
      this.profile.profileEvent = JSON.stringify(event);
    }
    if (this.profile && this.ndk.cacheAdapter && this.ndk.cacheAdapter.saveProfile) {
      this.ndk.cacheAdapter.saveProfile(this.pubkey, this.profile);
    }
    return this.profile;
  }
  /**
   * Returns a set of users that this user follows.
   * 
   * @deprecated Use followSet instead
   */
  follows = follows.bind(this);
  /**
   * Returns a set of pubkeys that this user follows.
   * 
   * @param opts - NDKSubscriptionOptions
   * @param outbox - boolean
   * @param kind - number
   */
  async followSet(opts, outbox, kind = 3 /* Contacts */) {
    const follows2 = await this.follows(opts, outbox, kind);
    return new Set(Array.from(follows2).map((f) => f.pubkey));
  }
  /** @deprecated Use referenceTags instead. */
  /**
   * Get the tag that can be used to reference this user in an event
   * @returns {NDKTag} an NDKTag
   */
  tagReference() {
    return ["p", this.pubkey];
  }
  /**
   * Get the tags that can be used to reference this user in an event
   * @returns {NDKTag[]} an array of NDKTag
   */
  referenceTags(marker) {
    const tag = [["p", this.pubkey]];
    if (!marker) return tag;
    tag[0].push("", marker);
    return tag;
  }
  /**
   * Publishes the current profile.
   */
  async publish() {
    if (!this.ndk) throw new Error("No NDK instance found");
    if (!this.profile) throw new Error("No profile available");
    this.ndk.assertSigner();
    const event = new NDKEvent(this.ndk, {
      kind: 0,
      content: serializeProfile(this.profile)
    });
    await event.publish();
  }
  /**
   * Add a follow to this user's contact list
   *
   * @param newFollow {NDKUser} The user to follow
   * @param currentFollowList {Set<NDKUser>} The current follow list
   * @param kind {NDKKind} The kind to use for this contact list (defaults to `3`)
   * @returns {Promise<boolean>} True if the follow was added, false if the follow already exists
   */
  async follow(newFollow, currentFollowList, kind = 3 /* Contacts */) {
    if (!this.ndk) throw new Error("No NDK instance found");
    this.ndk.assertSigner();
    if (!currentFollowList) {
      currentFollowList = await this.follows(void 0, void 0, kind);
    }
    if (currentFollowList.has(newFollow)) {
      return false;
    }
    currentFollowList.add(newFollow);
    const event = new NDKEvent(this.ndk, { kind });
    for (const follow of currentFollowList) {
      event.tag(follow);
    }
    await event.publish();
    return true;
  }
  /**
   * Remove a follow from this user's contact list
   *
   * @param user {NDKUser} The user to unfollow
   * @param currentFollowList {Set<NDKUser>} The current follow list
   * @param kind {NDKKind} The kind to use for this contact list (defaults to `3`)
   * @returns The relays were the follow list was published or false if the user wasn't found
   */
  async unfollow(user, currentFollowList, kind = 3 /* Contacts */) {
    if (!this.ndk) throw new Error("No NDK instance found");
    this.ndk.assertSigner();
    if (!currentFollowList) {
      currentFollowList = await this.follows(void 0, void 0, kind);
    }
    const newUserFollowList = /* @__PURE__ */ new Set();
    let foundUser = false;
    for (const follow of currentFollowList) {
      if (follow.pubkey !== user.pubkey) {
        newUserFollowList.add(follow);
      } else {
        foundUser = true;
      }
    }
    if (!foundUser) return false;
    const event = new NDKEvent(this.ndk, { kind });
    for (const follow of newUserFollowList) {
      event.tag(follow);
    }
    return await event.publish();
  }
  /**
   * Validate a user's NIP-05 identifier (usually fetched from their kind:0 profile data)
   *
   * @param nip05Id The NIP-05 string to validate
   * @returns {Promise<boolean | null>} True if the NIP-05 is found and matches this user's pubkey,
   * False if the NIP-05 is found but doesn't match this user's pubkey,
   * null if the NIP-05 isn't found on the domain or we're unable to verify (because of network issues, etc.)
   */
  async validateNip05(nip05Id) {
    if (!this.ndk) throw new Error("No NDK instance found");
    const profilePointer = await getNip05For(this.ndk, nip05Id);
    if (profilePointer === null) return null;
    return profilePointer.pubkey === this.pubkey;
  }
};

// src/events/kinds/lists/index.ts
var NDKList = class _NDKList extends NDKEvent {
  _encryptedTags;
  /**
   * Stores the number of bytes the content was before decryption
   * to expire the cache when the content changes.
   */
  encryptedTagsLength;
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 30001 /* CategorizedBookmarkList */;
  }
  /**
   * Wrap a NDKEvent into a NDKList
   */
  static from(ndkEvent) {
    return new _NDKList(ndkEvent.ndk, ndkEvent);
  }
  /**
   * Returns the title of the list. Falls back on fetching the name tag value.
   */
  get title() {
    const titleTag = this.tagValue("title") || this.tagValue("name");
    if (titleTag) return titleTag;
    if (this.kind === 3 /* Contacts */) {
      return "Contacts";
    } else if (this.kind === 1e4 /* MuteList */) {
      return "Mute";
    } else if (this.kind === 10001 /* PinList */) {
      return "Pinned Notes";
    } else if (this.kind === 10002 /* RelayList */) {
      return "Relay Metadata";
    } else if (this.kind === 10003 /* BookmarkList */) {
      return "Bookmarks";
    } else if (this.kind === 10004 /* CommunityList */) {
      return "Communities";
    } else if (this.kind === 10005 /* PublicChatList */) {
      return "Public Chats";
    } else if (this.kind === 10006 /* BlockRelayList */) {
      return "Blocked Relays";
    } else if (this.kind === 10007 /* SearchRelayList */) {
      return "Search Relays";
    } else if (this.kind === 10050 /* DirectMessageReceiveRelayList */) {
      return "Direct Message Receive Relays";
    } else if (this.kind === 10015 /* InterestList */) {
      return "Interests";
    } else if (this.kind === 10030 /* EmojiList */) {
      return "Emojis";
    } else {
      return this.tagValue("d");
    }
  }
  /**
   * Sets the title of the list.
   */
  set title(title) {
    this.removeTag(["title", "name"]);
    if (title) this.tags.push(["title", title]);
  }
  /**
   * Returns the name of the list.
   * @deprecated Please use "title" instead.
   */
  get name() {
    return this.title;
  }
  /**
   * Sets the name of the list.
   * @deprecated Please use "title" instead. This method will use the `title` tag instead.
   */
  set name(name) {
    this.title = name;
  }
  /**
   * Returns the description of the list.
   */
  get description() {
    return this.tagValue("description");
  }
  /**
   * Sets the description of the list.
   */
  set description(name) {
    this.removeTag("description");
    if (name) this.tags.push(["description", name]);
  }
  /**
   * Returns the image of the list.
   */
  get image() {
    return this.tagValue("image");
  }
  /**
   * Sets the image of the list.
   */
  set image(name) {
    this.removeTag("image");
    if (name) this.tags.push(["image", name]);
  }
  isEncryptedTagsCacheValid() {
    return !!(this._encryptedTags && this.encryptedTagsLength === this.content.length);
  }
  /**
   * Returns the decrypted content of the list.
   */
  async encryptedTags(useCache = true) {
    if (useCache && this.isEncryptedTagsCacheValid()) return this._encryptedTags;
    if (!this.ndk) throw new Error("NDK instance not set");
    if (!this.ndk.signer) throw new Error("NDK signer not set");
    const user = await this.ndk.signer.user();
    try {
      if (this.content.length > 0) {
        try {
          const decryptedContent = await this.ndk.signer.decrypt(user, this.content);
          const a = JSON.parse(decryptedContent);
          if (a && a[0]) {
            this.encryptedTagsLength = this.content.length;
            return this._encryptedTags = a;
          }
          this.encryptedTagsLength = this.content.length;
          return this._encryptedTags = [];
        } catch (e) {
          console.log(`error decrypting ${this.content}`);
        }
      }
    } catch (e) {
    }
    return [];
  }
  /**
   * This method can be overriden to validate that a tag is valid for this list.
   *
   * (i.e. the NDKPersonList can validate that items are NDKUser instances)
   */
  validateTag(tagValue) {
    return true;
  }
  getItems(type) {
    return this.tags.filter((tag) => tag[0] === type);
  }
  /**
   * Returns the unecrypted items in this list.
   */
  get items() {
    return this.tags.filter((t) => {
      return ![
        "d",
        "L",
        "l",
        "title",
        "name",
        "description",
        "published_at",
        "summary",
        "image",
        "thumb",
        "alt",
        "expiration",
        "subject",
        "client"
      ].includes(t[0]);
    });
  }
  /**
   * Adds a new item to the list.
   * @param relay Relay to add
   * @param mark Optional mark to add to the item
   * @param encrypted Whether to encrypt the item
   * @param position Where to add the item in the list (top or bottom)
   */
  async addItem(item, mark = void 0, encrypted = false, position = "bottom") {
    if (!this.ndk) throw new Error("NDK instance not set");
    if (!this.ndk.signer) throw new Error("NDK signer not set");
    let tags;
    if (item instanceof NDKEvent) {
      tags = [item.tagReference(mark)];
    } else if (item instanceof NDKUser) {
      tags = item.referenceTags();
    } else if (item instanceof NDKRelay) {
      tags = item.referenceTags();
    } else if (Array.isArray(item)) {
      tags = [item];
    } else {
      throw new Error("Invalid object type");
    }
    if (mark) tags[0].push(mark);
    if (encrypted) {
      const user = await this.ndk.signer.user();
      const currentList = await this.encryptedTags();
      if (position === "top") currentList.unshift(...tags);
      else currentList.push(...tags);
      this._encryptedTags = currentList;
      this.encryptedTagsLength = this.content.length;
      this.content = JSON.stringify(currentList);
      await this.encrypt(user);
    } else {
      if (position === "top") this.tags.unshift(...tags);
      else this.tags.push(...tags);
    }
    this.created_at = Math.floor(Date.now() / 1e3);
    this.emit("change");
  }
  /**
   * Removes an item from the list from both the encrypted and unencrypted lists.
   * @param value value of item to remove from the list
   * @param publish whether to publish the change
   * @returns
   */
  async removeItemByValue(value, publish = true) {
    if (!this.ndk) throw new Error("NDK instance not set");
    if (!this.ndk.signer) throw new Error("NDK signer not set");
    const index = this.tags.findIndex((tag) => tag[1] === value);
    if (index >= 0) {
      this.tags.splice(index, 1);
    }
    const user = await this.ndk.signer.user();
    const encryptedTags = await this.encryptedTags();
    const encryptedIndex = encryptedTags.findIndex((tag) => tag[1] === value);
    if (encryptedIndex >= 0) {
      encryptedTags.splice(encryptedIndex, 1);
      this._encryptedTags = encryptedTags;
      this.encryptedTagsLength = this.content.length;
      this.content = JSON.stringify(encryptedTags);
      await this.encrypt(user);
    }
    if (publish) {
      return this.publishReplaceable();
    } else {
      this.created_at = Math.floor(Date.now() / 1e3);
    }
    this.emit("change");
  }
  /**
   * Removes an item from the list.
   *
   * @param index The index of the item to remove.
   * @param encrypted Whether to remove from the encrypted list or not.
   */
  async removeItem(index, encrypted) {
    if (!this.ndk) throw new Error("NDK instance not set");
    if (!this.ndk.signer) throw new Error("NDK signer not set");
    if (encrypted) {
      const user = await this.ndk.signer.user();
      const currentList = await this.encryptedTags();
      currentList.splice(index, 1);
      this._encryptedTags = currentList;
      this.encryptedTagsLength = this.content.length;
      this.content = JSON.stringify(currentList);
      await this.encrypt(user);
    } else {
      this.tags.splice(index, 1);
    }
    this.created_at = Math.floor(Date.now() / 1e3);
    this.emit("change");
    return this;
  }
  has(item) {
    return this.items.some((tag) => tag[1] === item);
  }
  /**
   * Creates a filter that will result in fetching
   * the items of this list
   * @example
   * const list = new NDKList(...);
   * const filters = list.filterForItems();
   * const events = await ndk.fetchEvents(filters);
   */
  filterForItems() {
    const ids = /* @__PURE__ */ new Set();
    const nip33Queries = /* @__PURE__ */ new Map();
    const filters = [];
    for (const tag of this.items) {
      if (tag[0] === "e" && tag[1]) {
        ids.add(tag[1]);
      } else if (tag[0] === "a" && tag[1]) {
        const [kind, pubkey, dTag] = tag[1].split(":");
        if (!kind || !pubkey) continue;
        const key = `${kind}:${pubkey}`;
        const item = nip33Queries.get(key) || [];
        item.push(dTag || "");
        nip33Queries.set(key, item);
      }
    }
    if (ids.size > 0) {
      filters.push({ ids: Array.from(ids) });
    }
    if (nip33Queries.size > 0) {
      for (const [key, values] of nip33Queries.entries()) {
        const [kind, pubkey] = key.split(":");
        filters.push({
          kinds: [parseInt(kind)],
          authors: [pubkey],
          "#d": values
        });
      }
    }
    return filters;
  }
};
var lists_default = NDKList;

// src/user/pin.ts
async function pinEvent(user, event, pinEvent2, publish) {
  const kind = 10001 /* PinList */;
  if (!user.ndk) throw new Error("No NDK instance found");
  user.ndk.assertSigner();
  if (!pinEvent2) {
    const events = await user.ndk.fetchEvents(
      { kinds: [kind], authors: [user.pubkey] },
      { cacheUsage: "ONLY_RELAY" /* ONLY_RELAY */ }
    );
    if (events.size > 0) {
      pinEvent2 = lists_default.from(Array.from(events)[0]);
    } else {
      pinEvent2 = new NDKEvent(user.ndk, {
        kind
      });
    }
  }
  pinEvent2.tag(event);
  if (publish) {
    await pinEvent2.publish();
  }
  return pinEvent2;
}

// src/events/kinds/article.ts
var NDKArticle = class _NDKArticle extends NDKEvent {
  static kind = 30023 /* Article */;
  static kinds = [30023 /* Article */];
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 30023 /* Article */;
  }
  /**
   * Creates a NDKArticle from an existing NDKEvent.
   *
   * @param event NDKEvent to create the NDKArticle from.
   * @returns NDKArticle
   */
  static from(event) {
    return new _NDKArticle(event.ndk, event);
  }
  /**
   * Getter for the article title.
   *
   * @returns {string | undefined} - The article title if available, otherwise undefined.
   */
  get title() {
    return this.tagValue("title");
  }
  /**
   * Setter for the article title.
   *
   * @param {string | undefined} title - The title to set for the article.
   */
  set title(title) {
    this.removeTag("title");
    if (title) this.tags.push(["title", title]);
  }
  /**
   * Getter for the article image.
   *
   * @returns {string | undefined} - The article image if available, otherwise undefined.
   */
  get image() {
    return this.tagValue("image");
  }
  /**
   * Setter for the article image.
   *
   * @param {string | undefined} image - The image to set for the article.
   */
  set image(image) {
    this.removeTag("image");
    if (image) this.tags.push(["image", image]);
  }
  get summary() {
    return this.tagValue("summary");
  }
  set summary(summary) {
    this.removeTag("summary");
    if (summary) this.tags.push(["summary", summary]);
  }
  /**
   * Getter for the article's publication timestamp.
   *
   * @returns {number | undefined} - The Unix timestamp of when the article was published or undefined.
   */
  get published_at() {
    const tag = this.tagValue("published_at");
    if (tag) {
      let val = parseInt(tag);
      if (val > 1e12) {
        val = Math.floor(val / 1e3);
      }
      return val;
    }
    return void 0;
  }
  /**
   * Setter for the article's publication timestamp.
   *
   * @param {number | undefined} timestamp - The Unix timestamp to set for the article's publication date.
   */
  set published_at(timestamp) {
    this.removeTag("published_at");
    if (timestamp !== void 0) {
      this.tags.push(["published_at", timestamp.toString()]);
    }
  }
  /**
   * Generates content tags for the article.
   *
   * This method first checks and sets the publication date if not available,
   * and then generates content tags based on the base NDKEvent class.
   *
   * @returns {ContentTag} - The generated content tags.
   */
  async generateTags() {
    super.generateTags();
    if (!this.published_at) {
      this.published_at = this.created_at;
    }
    return super.generateTags();
  }
  /**
   * Getter for the article's URL.
   *
   * @returns {string | undefined} - The article's URL if available, otherwise undefined.
   */
  get url() {
    return this.tagValue("url");
  }
  /**
   * Setter for the article's URL.
   *
   * @param {string | undefined} url - The URL to set for the article.
   */
  set url(url) {
    if (url) {
      this.tags.push(["url", url]);
    } else {
      this.removeTag("url");
    }
  }
};

// src/events/kinds/classified.ts
var NDKClassified = class _NDKClassified extends NDKEvent {
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 30402 /* Classified */;
  }
  /**
   * Creates a NDKClassified from an existing NDKEvent.
   *
   * @param event NDKEvent to create the NDKClassified from.
   * @returns NDKClassified
   */
  static from(event) {
    return new _NDKClassified(event.ndk, event);
  }
  /**
   * Getter for the classified title.
   *
   * @returns {string | undefined} - The classified title if available, otherwise undefined.
   */
  get title() {
    return this.tagValue("title");
  }
  /**
   * Setter for the classified title.
   *
   * @param {string | undefined} title - The title to set for the classified.
   */
  set title(title) {
    this.removeTag("title");
    if (title) this.tags.push(["title", title]);
  }
  /**
   * Getter for the classified summary.
   *
   * @returns {string | undefined} - The classified summary if available, otherwise undefined.
   */
  get summary() {
    return this.tagValue("summary");
  }
  /**
   * Setter for the classified summary.
   *
   * @param {string | undefined} summary - The summary to set for the classified.
   */
  set summary(summary) {
    this.removeTag("summary");
    if (summary) this.tags.push(["summary", summary]);
  }
  /**
   * Getter for the classified's publication timestamp.
   *
   * @returns {number | undefined} - The Unix timestamp of when the classified was published or undefined.
   */
  get published_at() {
    const tag = this.tagValue("published_at");
    if (tag) {
      return parseInt(tag);
    }
    return void 0;
  }
  /**
   * Setter for the classified's publication timestamp.
   *
   * @param {number | undefined} timestamp - The Unix timestamp to set for the classified's publication date.
   */
  set published_at(timestamp) {
    this.removeTag("published_at");
    if (timestamp !== void 0) {
      this.tags.push(["published_at", timestamp.toString()]);
    }
  }
  /**
   * Getter for the classified location.
   *
   * @returns {string | undefined} - The classified location if available, otherwise undefined.
   */
  get location() {
    return this.tagValue("location");
  }
  /**
   * Setter for the classified location.
   *
   * @param {string | undefined} location - The location to set for the classified.
   */
  set location(location) {
    this.removeTag("location");
    if (location) this.tags.push(["location", location]);
  }
  /**
   * Getter for the classified price.
   *
   * @returns {NDKClassifiedPriceTag | undefined} - The classified price if available, otherwise undefined.
   */
  get price() {
    const priceTag = this.tags.find((tag) => tag[0] === "price");
    if (priceTag) {
      return {
        amount: parseFloat(priceTag[1]),
        currency: priceTag[2],
        frequency: priceTag[3]
      };
    } else {
      return void 0;
    }
  }
  /**
   * Setter for the classified price.
   *
   * @param price - The price to set for the classified.
   */
  set price(priceTag) {
    if (typeof priceTag === "string") {
      priceTag = {
        amount: parseFloat(priceTag)
      };
    }
    if (priceTag?.amount) {
      const tag = ["price", priceTag.amount.toString()];
      if (priceTag.currency) tag.push(priceTag.currency);
      if (priceTag.frequency) tag.push(priceTag.frequency);
      this.tags.push(tag);
    } else {
      this.removeTag("price");
    }
  }
  /**
   * Generates content tags for the classified.
   *
   * This method first checks and sets the publication date if not available,
   * and then generates content tags based on the base NDKEvent class.
   *
   * @returns {ContentTag} - The generated content tags.
   */
  async generateTags() {
    super.generateTags();
    if (!this.published_at) {
      this.published_at = this.created_at;
    }
    return super.generateTags();
  }
};

// src/events/kinds/drafts.ts
var NDKDraft = class _NDKDraft extends NDKEvent {
  _event;
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 31234 /* Draft */;
  }
  static from(event) {
    return new _NDKDraft(event.ndk, event);
  }
  /**
   * Sets an identifier (i.e. d-tag)
   */
  set identifier(id) {
    this.removeTag("d");
    this.tags.push(["d", id]);
  }
  get identifier() {
    return this.dTag;
  }
  /**
   * Event that is to be saved.
   */
  set event(e) {
    if (e instanceof NDKEvent) this._event = e.rawEvent();
    else this._event = e;
    this.prepareEvent();
  }
  /**
   * Gets the event.
   * @param param0
   * @returns NDKEvent of the draft event or null if the draft event has been deleted (emptied).
   */
  async getEvent(signer) {
    if (this._event) return new NDKEvent(this.ndk, this._event);
    signer ??= this.ndk?.signer;
    if (!signer) throw new Error("No signer available");
    const user = await signer.user();
    if (this.content && this.content.length > 0) {
      try {
        await this.decrypt(user, signer);
        const payload = JSON.parse(this.content);
        this._event = payload;
        return new NDKEvent(this.ndk, payload);
      } catch (e) {
        console.error(e);
        return void 0;
      }
    } else {
      return null;
    }
  }
  prepareEvent() {
    if (!this._event) throw new Error("No event has been provided");
    this.removeTag("k");
    if (this._event.kind) this.tags.push(["k", this._event.kind.toString()]);
    this.content = JSON.stringify(this._event);
  }
  /**
   * Generates draft event.
   *
   * @param signer: Optional signer to encrypt with
   * @param publish: Whether to publish, optionally specifying relaySet to publish to
   */
  async save({
    signer,
    publish,
    relaySet
  }) {
    signer ??= this.ndk?.signer;
    if (!signer) throw new Error("No signer available");
    const user = await signer.user();
    await this.encrypt(user, signer);
    if (publish === false) return;
    return this.publish(relaySet);
  }
};

// src/events/kinds/dvm/feedback.ts
var NDKDvmJobFeedbackStatus = /* @__PURE__ */ ((NDKDvmJobFeedbackStatus2) => {
  NDKDvmJobFeedbackStatus2["Processing"] = "processing";
  NDKDvmJobFeedbackStatus2["Success"] = "success";
  NDKDvmJobFeedbackStatus2["Scheduled"] = "scheduled";
  NDKDvmJobFeedbackStatus2["PayReq"] = "payment_required";
  return NDKDvmJobFeedbackStatus2;
})(NDKDvmJobFeedbackStatus || {});
var NDKDVMJobFeedback = class _NDKDVMJobFeedback extends NDKEvent {
  constructor(ndk, event) {
    super(ndk, event);
    this.kind ??= 7e3 /* DVMJobFeedback */;
  }
  static async from(event) {
    const e = new _NDKDVMJobFeedback(event.ndk, event.rawEvent());
    if (e.encrypted) await e.dvmDecrypt();
    return e;
  }
  get status() {
    return this.tagValue("status");
  }
  set status(status) {
    this.removeTag("status");
    if (status !== void 0) {
      this.tags.push(["status", status]);
    }
  }
  get encrypted() {
    return !!this.getMatchingTags("encrypted")[0];
  }
  async dvmDecrypt() {
    await this.decrypt();
    const decryptedContent = JSON.parse(this.content);
    this.tags.push(...decryptedContent);
  }
};

// src/events/kinds/dvm/request.ts
var NDKDVMRequest = class _NDKDVMRequest extends NDKEvent {
  constructor(ndk, event) {
    super(ndk, event);
  }
  static from(event) {
    return new _NDKDVMRequest(event.ndk, event.rawEvent());
  }
  set bid(msatAmount) {
    if (msatAmount === void 0) {
      this.removeTag("bid");
    } else {
      this.tags.push(["bid", msatAmount.toString()]);
    }
  }
  get bid() {
    const v = this.tagValue("bid");
    if (v === void 0) return void 0;
    return parseInt(v);
  }
  /**
   * Adds a new input to the job
   * @param args The arguments to the input
   */
  addInput(...args) {
    this.tags.push(["i", ...args]);
  }
  /**
   * Adds a new parameter to the job
   */
  addParam(...args) {
    this.tags.push(["param", ...args]);
  }
  set output(output) {
    if (output === void 0) {
      this.removeTag("output");
    } else {
      if (typeof output === "string") output = [output];
      this.tags.push(["output", ...output]);
    }
  }
  get output() {
    const outputTag = this.getMatchingTags("output")[0];
    return outputTag ? outputTag.slice(1) : void 0;
  }
  get params() {
    const paramTags = this.getMatchingTags("param");
    return paramTags.map((t) => t.slice(1));
  }
  getParam(name) {
    const paramTag = this.getMatchingTags("param").find((t) => t[1] === name);
    return paramTag ? paramTag[2] : void 0;
  }
  createFeedback(status) {
    const feedback = new NDKDVMJobFeedback(this.ndk);
    feedback.tag(this, "job");
    feedback.status = status;
    return feedback;
  }
  /**
   * Enables job encryption for this event
   * @param dvm DVM that will receive the event
   * @param signer Signer to use for encryption
   */
  async encryption(dvm, signer) {
    const dvmTags = ["i", "param", "output", "relays", "bid"];
    const tags = this.tags.filter((t) => dvmTags.includes(t[0]));
    this.tags = this.tags.filter((t) => !dvmTags.includes(t[0]));
    this.content = JSON.stringify(tags);
    this.tag(dvm);
    this.tags.push(["encrypted"]);
    await this.encrypt(dvm, signer);
  }
  /**
   * Sets the DVM that will receive the event
   */
  set dvm(dvm) {
    this.removeTag("p");
    if (dvm) this.tag(dvm);
  }
};

// src/events/kinds/dvm/NDKTranscriptionDVM.ts
var NDKTranscriptionDVM = class _NDKTranscriptionDVM extends NDKDVMRequest {
  constructor(ndk, event) {
    super(ndk, event);
    this.kind = 5e3 /* DVMReqTextExtraction */;
  }
  static from(event) {
    return new _NDKTranscriptionDVM(event.ndk, event.rawEvent());
  }
  /**
   * Returns the original source of the transcription
   */
  get url() {
    const inputTags = this.getMatchingTags("i");
    if (inputTags.length !== 1) {
      return void 0;
    }
    return inputTags[0][1];
  }
  /**
   * Getter for the title tag
   */
  get title() {
    return this.tagValue("title");
  }
  /**
   * Setter for the title tag
   */
  set title(value) {
    this.removeTag("title");
    if (value) {
      this.tags.push(["title", value]);
    }
  }
  /**
   * Getter for the image tag
   */
  get image() {
    return this.tagValue("image");
  }
  /**
   * Setter for the image tag
   */
  set image(value) {
    this.removeTag("image");
    if (value) {
      this.tags.push(["image", value]);
    }
  }
};

// src/events/kinds/dvm/result.ts
var NDKDVMJobResult = class _NDKDVMJobResult extends NDKEvent {
  constructor(ndk, event) {
    super(ndk, event);
  }
  static from(event) {
    return new _NDKDVMJobResult(event.ndk, event.rawEvent());
  }
  setAmount(msat, invoice) {
    this.removeTag("amount");
    const tag = ["amount", msat.toString()];
    if (invoice) tag.push(invoice);
    this.tags.push(tag);
  }
  set result(result) {
    if (result === void 0) {
      this.content = "";
    } else {
      this.content = result;
    }
  }
  get result() {
    if (this.content === "") {
      return void 0;
    }
    return this.content;
  }
  set status(status) {
    this.removeTag("status");
    if (status !== void 0) {
      this.tags.push(["status", status]);
    }
  }
  get status() {
    return this.tagValue("status");
  }
  get jobRequestId() {
    for (const eTag of this.getMatchingTags("e")) {
      if (eTag[2] === "job") return eTag[1];
    }
    if (this.jobRequest) return this.jobRequest.id;
    return this.tagValue("e");
  }
  set jobRequest(event) {
    this.removeTag("request");
    if (event) {
      this.kind = event.kind + 1e3;
      this.tags.push(["request", JSON.stringify(event.rawEvent())]);
      this.tag(event);
    }
  }
  get jobRequest() {
    const tag = this.tagValue("request");
    if (tag === void 0) {
      return void 0;
    }
    return new NDKEvent(this.ndk, JSON.parse(tag));
  }
};

// src/events/kinds/highlight.ts
import { nip19 as nip195 } from "nostr-tools";
var NDKHighlight = class _NDKHighlight extends NDKEvent {
  _article;
  static kind = 9802 /* Highlight */;
  static kinds = [9802 /* Highlight */];
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 9802 /* Highlight */;
  }
  static from(event) {
    return new _NDKHighlight(event.ndk, event);
  }
  get url() {
    return this.tagValue("r");
  }
  /**
   * Context tag.
   */
  set context(context) {
    if (context === void 0) {
      this.tags = this.tags.filter(([tag, value]) => tag !== "context");
    } else {
      this.tags = this.tags.filter(([tag, value]) => tag !== "context");
      this.tags.push(["context", context]);
    }
  }
  get context() {
    return this.tags.find(([tag, value]) => tag === "context")?.[1] ?? void 0;
  }
  /**
   * Will return the article URL or NDKEvent if they have already been
   * set (it won't attempt to load remote events)
   */
  get article() {
    return this._article;
  }
  /**
   * Article the highlight is coming from.
   *
   * @param article Article URL or NDKEvent.
   */
  set article(article) {
    this._article = article;
    if (typeof article === "string") {
      this.tags.push(["r", article]);
    } else {
      this.tag(article);
    }
  }
  getArticleTag() {
    return this.getMatchingTags("a")[0] || this.getMatchingTags("e")[0] || this.getMatchingTags("r")[0];
  }
  async getArticle() {
    if (this._article !== void 0) return this._article;
    let taggedBech32;
    const articleTag = this.getArticleTag();
    if (!articleTag) return void 0;
    switch (articleTag[0]) {
      case "a":
        const [kind, pubkey, identifier] = articleTag[1].split(":");
        taggedBech32 = nip195.naddrEncode({ kind: parseInt(kind), pubkey, identifier });
        break;
      case "e":
        taggedBech32 = nip195.noteEncode(articleTag[1]);
        break;
      case "r":
        this._article = articleTag[1];
        break;
    }
    if (taggedBech32) {
      let a = await this.ndk?.fetchEvent(taggedBech32);
      if (a) {
        if (a.kind === 30023 /* Article */) {
          a = NDKArticle.from(a);
        }
        this._article = a;
      }
    }
    return this._article;
  }
};

// src/utils/imeta.ts
function mapImetaTag(tag) {
  const data = {};
  if (tag.length === 2) {
    const parts = tag[1].split(" ");
    for (let i = 0; i < parts.length; i += 2) {
      const key = parts[i];
      const value = parts[i + 1];
      if (key === "fallback") {
        if (!data.fallback) data.fallback = [];
        data.fallback.push(value);
      } else {
        data[key] = value;
      }
    }
  }
  for (const val of tag) {
    const parts = val.split(" ");
    const key = parts[0];
    const value = parts.slice(1).join(" ");
    if (key === "fallback") {
      if (!data.fallback) data.fallback = [];
      data.fallback.push(value);
    } else {
      data[key] = value;
    }
  }
  return data;
}
function imetaTagToTag(imeta) {
  const tag = ["imeta"];
  for (const [key, value] of Object.entries(imeta)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        tag.push(key, v);
      }
    } else if (value) {
      tag.push(key, value);
    }
  }
  return tag;
}

// src/events/kinds/image.ts
var NDKImage = class _NDKImage extends NDKEvent {
  static kind = 20 /* Image */;
  static kinds = [20 /* Image */];
  _imetas;
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 20 /* Image */;
  }
  /**
   * Creates a NDKImage from an existing NDKEvent.
   *
   * @param event NDKEvent to create the NDKImage from.
   * @returns NDKImage
   */
  static from(event) {
    return new _NDKImage(event.ndk, event.rawEvent());
  }
  get isValid() {
    console.log("NDKImage isValid running", this.imetas.length > 0);
    return this.imetas.length > 0;
  }
  get imetas() {
    if (this._imetas) return this._imetas;
    this._imetas = this.tags.filter((tag) => tag[0] === "imeta").map(mapImetaTag);
    return this._imetas;
  }
  set imetas(tags) {
    this._imetas = tags;
    this.tags = this.tags.filter((tag) => tag[0] !== "imeta");
    this.tags.push(...tags.map(imetaTagToTag));
  }
};

// src/events/kinds/NDKRelayList.ts
var READ_MARKER = "read";
var WRITE_MARKER = "write";
var NDKRelayList = class _NDKRelayList extends NDKEvent {
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 10002 /* RelayList */;
  }
  static from(ndkEvent) {
    return new _NDKRelayList(ndkEvent.ndk, ndkEvent.rawEvent());
  }
  get readRelayUrls() {
    return this.tags.filter((tag) => tag[0] === "r" || tag[0] === "relay").filter((tag) => !tag[2] || tag[2] && tag[2] === READ_MARKER).map((tag) => tryNormalizeRelayUrl(tag[1])).filter((url) => !!url);
  }
  set readRelayUrls(relays) {
    for (const relay of relays) {
      this.tags.push(["r", relay, READ_MARKER]);
    }
  }
  get writeRelayUrls() {
    return this.tags.filter((tag) => tag[0] === "r" || tag[0] === "relay").filter((tag) => !tag[2] || tag[2] && tag[2] === WRITE_MARKER).map((tag) => tryNormalizeRelayUrl(tag[1])).filter((url) => !!url);
  }
  set writeRelayUrls(relays) {
    for (const relay of relays) {
      this.tags.push(["r", relay, WRITE_MARKER]);
    }
  }
  get bothRelayUrls() {
    return this.tags.filter((tag) => tag[0] === "r" || tag[0] === "relay").filter((tag) => !tag[2]).map((tag) => tag[1]);
  }
  set bothRelayUrls(relays) {
    for (const relay of relays) {
      this.tags.push(["r", relay]);
    }
  }
  get relays() {
    return this.tags.filter((tag) => tag[0] === "r" || tag[0] === "relay").map((tag) => tag[1]);
  }
  /**
   * Provides a relaySet for the relays in this list.
   */
  get relaySet() {
    if (!this.ndk) throw new Error("NDKRelayList has no NDK instance");
    return new NDKRelaySet(
      new Set(this.relays.map((u) => this.ndk.pool.getRelay(u))),
      this.ndk
    );
  }
};
function relayListFromKind3(ndk, contactList) {
  try {
    const content = JSON.parse(contactList.content);
    const relayList = new NDKRelayList(ndk);
    const readRelays = /* @__PURE__ */ new Set();
    const writeRelays = /* @__PURE__ */ new Set();
    for (let [key, config] of Object.entries(content)) {
      try {
        key = normalizeRelayUrl(key);
      } catch {
        continue;
      }
      if (!config) {
        readRelays.add(key);
        writeRelays.add(key);
      } else {
        const relayConfig = config;
        if (relayConfig.write) writeRelays.add(key);
        if (relayConfig.read) readRelays.add(key);
      }
    }
    relayList.readRelayUrls = Array.from(readRelays);
    relayList.writeRelayUrls = Array.from(writeRelays);
    return relayList;
  } catch {
  }
  return void 0;
}

// src/events/kinds/nip89/NDKAppHandler.ts
var NDKAppHandlerEvent = class _NDKAppHandlerEvent extends NDKEvent {
  profile;
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 31990 /* AppHandler */;
  }
  static from(ndkEvent) {
    return new _NDKAppHandlerEvent(ndkEvent.ndk, ndkEvent.rawEvent());
  }
  /**
   * Fetches app handler information
   * If no app information is available on the kind:31990,
   * we fetch the event's author's profile and return that instead.
   */
  async fetchProfile() {
    if (this.profile === void 0 && this.content.length > 0) {
      try {
        const profile = JSON.parse(this.content);
        if (profile && profile.name) {
          return profile;
        } else {
          this.profile = null;
        }
      } catch (e) {
        this.profile = null;
      }
    }
    return new Promise((resolve, reject) => {
      const author = this.author;
      author.fetchProfile().then(() => {
        resolve(author.profile);
      }).catch(reject);
    });
  }
};

// src/events/kinds/nutzap/index.ts
import debug2 from "debug";
var NDKNutzap = class _NDKNutzap extends NDKEvent {
  debug;
  _proofs = [];
  static kind = 9321 /* Nutzap */;
  static kinds = [_NDKNutzap.kind];
  constructor(ndk, event) {
    super(ndk, event);
    this.kind ??= 9321 /* Nutzap */;
    this.debug = ndk?.debug.extend("nutzap") ?? debug2("ndk:nutzap");
    if (!this.alt) this.alt = "This is a nutzap";
  }
  static from(event) {
    const e = new this(event.ndk, event);
    try {
      const proofTags = e.getMatchingTags("proof");
      if (proofTags.length) {
        e._proofs = proofTags.map((tag) => JSON.parse(tag[1]));
      } else {
        e._proofs = JSON.parse(e.content);
      }
    } catch {
      return;
    }
    if (!e._proofs || !e._proofs.length) return;
    return e;
  }
  set comment(comment) {
    this.content = comment ?? "";
  }
  get comment() {
    const c = this.tagValue("comment");
    if (c) return c;
    return this.content;
  }
  set proofs(proofs) {
    this._proofs = proofs;
    this.tags = this.tags.filter((tag) => tag[0] !== "proof");
    for (const proof of proofs) {
      this.tags.push(["proof", JSON.stringify(proof)]);
    }
    this.removeTag("amount");
    this.tags.push(["amount", this.amount.toString()]);
  }
  get proofs() {
    return this._proofs;
  }
  /**
   * Gets the p2pk pubkey that is embedded in the first proof
   */
  get p2pk() {
    const firstProof = this.proofs[0];
    try {
      const secret = JSON.parse(firstProof.secret);
      let payload = {};
      if (typeof secret === "string") {
        payload = JSON.parse(secret);
        this.debug("stringified payload", firstProof.secret);
      } else if (typeof secret === "object") {
        payload = secret;
      }
      const isP2PKLocked = payload[0] === "P2PK" && payload[1]?.data;
      if (isP2PKLocked) {
        const paddedp2pk = payload[1].data;
        const p2pk = paddedp2pk.slice(2, -1);
        if (p2pk) return p2pk;
      }
    } catch (e) {
      this.debug("error parsing p2pk pubkey", e, this.proofs[0]);
    }
  }
  /**
   * Get the mint where this nutzap proofs exist
   */
  get mint() {
    return this.tagValue("u");
  }
  set mint(value) {
    this.removeTag("u");
    this.tag(["u", value]);
  }
  get unit() {
    return this.tagValue("unit") ?? "msat";
  }
  set unit(value) {
    this.removeTag("unit");
    if (value) this.tag(["unit", value]);
  }
  get amount() {
    const count = this.proofs.reduce((total, proof) => total + proof.amount, 0);
    return count * 1e3;
  }
  sender = this.author;
  /**
   * Set the target of the nutzap
   * @param target The target of the nutzap (a user or an event)
   */
  set target(target) {
    this.tags = this.tags.filter((t) => t[0] !== "p");
    if (target instanceof NDKEvent) {
      this.tags.push(target.tagReference());
    }
  }
  set recipientPubkey(pubkey) {
    this.removeTag("p");
    this.tag(["p", pubkey]);
  }
  get recipientPubkey() {
    return this.tagValue("p");
  }
  get recipient() {
    const pubkey = this.recipientPubkey;
    if (this.ndk) return this.ndk.getUser({ pubkey });
    return new NDKUser({ pubkey });
  }
  /**
   * Validates that the nutzap conforms to NIP-61
   */
  get isValid() {
    let pTagCount = 0;
    let mintTagCount = 0;
    for (const tag of this.tags) {
      if (tag[0] === "p") pTagCount++;
      if (tag[0] === "u") mintTagCount++;
    }
    return (
      // exactly one recipient and mint
      pTagCount === 1 && mintTagCount === 1 && // must have at least one proof
      this.proofs.length > 0
    );
  }
};

// src/events/kinds/repost.ts
var NDKRepost = class _NDKRepost extends NDKEvent {
  _repostedEvents;
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
  }
  static from(event) {
    return new _NDKRepost(event.ndk, event.rawEvent());
  }
  /**
   * Returns all reposted events by the current event.
   *
   * @param klass Optional class to convert the events to.
   * @returns
   */
  async repostedEvents(klass, opts) {
    const items = [];
    if (!this.ndk) throw new Error("NDK instance not set");
    if (this._repostedEvents !== void 0) return this._repostedEvents;
    for (const eventId of this.repostedEventIds()) {
      const filter = filterForId(eventId);
      const event = await this.ndk.fetchEvent(filter, opts);
      if (event) {
        items.push(klass ? klass.from(event) : event);
      }
    }
    return items;
  }
  /**
   * Returns the reposted event IDs.
   */
  repostedEventIds() {
    return this.tags.filter((t) => t[0] === "e" || t[0] === "a").map((t) => t[1]);
  }
};
function filterForId(id) {
  if (id.match(/:/)) {
    const [kind, pubkey, identifier] = id.split(":");
    return {
      kinds: [parseInt(kind)],
      authors: [pubkey],
      "#d": [identifier]
    };
  } else {
    return { ids: [id] };
  }
}

// src/events/kinds/subscriptions/amount.ts
var possibleIntervalFrequencies = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly"
];
function calculateTermDurationInSeconds(term) {
  switch (term) {
    case "daily":
      return 24 * 60 * 60;
    case "weekly":
      return 7 * 24 * 60 * 60;
    case "monthly":
      return 30 * 24 * 60 * 60;
    case "quarterly":
      return 3 * 30 * 24 * 60 * 60;
    case "yearly":
      return 365 * 24 * 60 * 60;
  }
}
function newAmount(amount, currency, term) {
  return ["amount", amount.toString(), currency, term];
}
function parseTagToSubscriptionAmount(tag) {
  const amount = parseInt(tag[1]);
  if (isNaN(amount) || amount === void 0 || amount === null || amount <= 0) return void 0;
  const currency = tag[2];
  if (currency === void 0 || currency === "") return void 0;
  const term = tag[3];
  if (term === void 0) return void 0;
  if (!possibleIntervalFrequencies.includes(term)) return void 0;
  return {
    amount,
    currency,
    term
  };
}

// src/events/kinds/subscriptions/receipt.ts
import debug3 from "debug";
var NDKSubscriptionReceipt = class _NDKSubscriptionReceipt extends NDKEvent {
  debug;
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 7003 /* SubscriptionReceipt */;
    this.debug = ndk?.debug.extend("subscription-start") ?? debug3("ndk:subscription-start");
  }
  static from(event) {
    return new _NDKSubscriptionReceipt(event.ndk, event.rawEvent());
  }
  /**
   * This is the person being subscribed to
   */
  get recipient() {
    const pTag = this.getMatchingTags("p")?.[0];
    if (!pTag) return void 0;
    const user = new NDKUser({ pubkey: pTag[1] });
    return user;
  }
  set recipient(user) {
    this.removeTag("p");
    if (!user) return;
    this.tags.push(["p", user.pubkey]);
  }
  /**
   * This is the person subscribing
   */
  get subscriber() {
    const PTag = this.getMatchingTags("P")?.[0];
    if (!PTag) return void 0;
    const user = new NDKUser({ pubkey: PTag[1] });
    return user;
  }
  set subscriber(user) {
    this.removeTag("P");
    if (!user) return;
    this.tags.push(["P", user.pubkey]);
  }
  set subscriptionStart(event) {
    this.debug(`before setting subscription start: ${this.rawEvent}`);
    this.removeTag("e");
    this.tag(event, "subscription", true);
    this.debug(`after setting subscription start: ${this.rawEvent}`);
  }
  get tierName() {
    const tag = this.getMatchingTags("tier")?.[0];
    return tag?.[1];
  }
  get isValid() {
    const period = this.validPeriod;
    if (!period) {
      return false;
    }
    if (period.start > period.end) {
      return false;
    }
    const pTags = this.getMatchingTags("p");
    const PTags = this.getMatchingTags("P");
    if (pTags.length !== 1 || PTags.length !== 1) {
      return false;
    }
    return true;
  }
  get validPeriod() {
    const tag = this.getMatchingTags("valid")?.[0];
    if (!tag) return void 0;
    try {
      return {
        start: new Date(parseInt(tag[1]) * 1e3),
        end: new Date(parseInt(tag[2]) * 1e3)
      };
    } catch {
      return void 0;
    }
  }
  set validPeriod(period) {
    this.removeTag("valid");
    if (!period) return;
    this.tags.push([
      "valid",
      Math.floor(period.start.getTime() / 1e3).toString(),
      Math.floor(period.end.getTime() / 1e3).toString()
    ]);
  }
  get startPeriod() {
    return this.validPeriod?.start;
  }
  get endPeriod() {
    return this.validPeriod?.end;
  }
  /**
   * Whether the subscription is currently active
   */
  isActive(time) {
    time ??= /* @__PURE__ */ new Date();
    const period = this.validPeriod;
    if (!period) return false;
    if (time < period.start) return false;
    if (time > period.end) return false;
    return true;
  }
};

// src/events/kinds/subscriptions/subscription-start.ts
import debug4 from "debug";

// src/events/kinds/subscriptions/tier.ts
var NDKSubscriptionTier = class _NDKSubscriptionTier extends NDKArticle {
  static kind = 37001 /* SubscriptionTier */;
  static kinds = [37001 /* SubscriptionTier */];
  constructor(ndk, rawEvent) {
    const k = rawEvent?.kind ?? 37001 /* SubscriptionTier */;
    super(ndk, rawEvent);
    this.kind = k;
  }
  /**
   * Creates a new NDKSubscriptionTier from an event
   * @param event
   * @returns NDKSubscriptionTier
   */
  static from(event) {
    return new _NDKSubscriptionTier(event.ndk, event);
  }
  /**
   * Returns perks for this tier
   */
  get perks() {
    return this.getMatchingTags("perk").map((tag) => tag[1]).filter((perk) => perk !== void 0);
  }
  /**
   * Adds a perk to this tier
   */
  addPerk(perk) {
    this.tags.push(["perk", perk]);
  }
  /**
   * Returns the amount for this tier
   */
  get amounts() {
    return this.getMatchingTags("amount").map((tag) => parseTagToSubscriptionAmount(tag)).filter((a) => a !== void 0);
  }
  /**
   * Adds an amount to this tier
   * @param amount Amount in the smallest unit of the currency (e.g. cents, msats)
   * @param currency Currency code. Use msat for millisatoshis
   * @param term One of daily, weekly, monthly, quarterly, yearly
   */
  addAmount(amount, currency, term) {
    this.tags.push(newAmount(amount, currency, term));
  }
  /**
   * Sets a relay where content related to this tier can be found
   * @param relayUrl URL of the relay
   */
  set relayUrl(relayUrl) {
    this.tags.push(["r", relayUrl]);
  }
  /**
   * Returns the relay URLs for this tier
   */
  get relayUrls() {
    return this.getMatchingTags("r").map((tag) => tag[1]).filter((relay) => relay !== void 0);
  }
  /**
   * Gets the verifier pubkey for this tier. This is the pubkey that will generate
   * subscription payment receipts
   */
  get verifierPubkey() {
    return this.tagValue("p");
  }
  /**
   * Sets the verifier pubkey for this tier.
   */
  set verifierPubkey(pubkey) {
    this.removeTag("p");
    if (pubkey) this.tags.push(["p", pubkey]);
  }
  /**
   * Checks if this tier is valid
   */
  get isValid() {
    return this.title !== void 0 && // Must have a title
    this.amounts.length > 0;
  }
};

// src/events/kinds/subscriptions/subscription-start.ts
var NDKSubscriptionStart = class _NDKSubscriptionStart extends NDKEvent {
  debug;
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 7001 /* Subscribe */;
    this.debug = ndk?.debug.extend("subscription-start") ?? debug4("ndk:subscription-start");
  }
  static from(event) {
    return new _NDKSubscriptionStart(event.ndk, event.rawEvent());
  }
  /**
   * Recipient of the subscription. I.e. The author of this event subscribes to this user.
   */
  get recipient() {
    const pTag = this.getMatchingTags("p")?.[0];
    if (!pTag) return void 0;
    const user = new NDKUser({ pubkey: pTag[1] });
    return user;
  }
  set recipient(user) {
    this.removeTag("p");
    if (!user) return;
    this.tags.push(["p", user.pubkey]);
  }
  /**
   * The amount of the subscription.
   */
  get amount() {
    const amountTag = this.getMatchingTags("amount")?.[0];
    if (!amountTag) return void 0;
    return parseTagToSubscriptionAmount(amountTag);
  }
  set amount(amount) {
    this.removeTag("amount");
    if (!amount) return;
    this.tags.push(newAmount(amount.amount, amount.currency, amount.term));
  }
  /**
   * The event id or NIP-33 tag id of the tier that the user is subscribing to.
   */
  get tierId() {
    const eTag = this.getMatchingTags("e")?.[0];
    const aTag = this.getMatchingTags("a")?.[0];
    if (!eTag || !aTag) return void 0;
    return eTag[1] ?? aTag[1];
  }
  set tier(tier) {
    this.removeTag("e");
    this.removeTag("a");
    this.removeTag("event");
    if (!tier) return;
    this.tag(tier);
    this.removeTag("p");
    this.tags.push(["p", tier.pubkey]);
    this.tags.push(["event", JSON.stringify(tier.rawEvent())]);
  }
  /**
   * Fetches the tier that the user is subscribing to.
   */
  async fetchTier() {
    const eventTag = this.tagValue("event");
    if (eventTag) {
      try {
        const parsedEvent = JSON.parse(eventTag);
        return new NDKSubscriptionTier(this.ndk, parsedEvent);
      } catch {
        this.debug("Failed to parse event tag");
      }
    }
    const tierId = this.tierId;
    if (!tierId) return void 0;
    const e = await this.ndk?.fetchEvent(tierId);
    if (!e) return void 0;
    return NDKSubscriptionTier.from(e);
  }
  get isValid() {
    if (this.getMatchingTags("amount").length !== 1) {
      this.debug("Invalid # of amount tag");
      return false;
    }
    if (!this.amount) {
      this.debug("Invalid amount tag");
      return false;
    }
    if (this.getMatchingTags("p").length !== 1) {
      this.debug("Invalid # of p tag");
      return false;
    }
    if (!this.recipient) {
      this.debug("Invalid p tag");
      return false;
    }
    return true;
  }
};

// src/events/kinds/video.ts
var NDKVideo = class _NDKVideo extends NDKEvent {
  static kind = 34235 /* HorizontalVideo */;
  static kinds = [34235 /* HorizontalVideo */, 34236 /* VerticalVideo */];
  _imetas = [];
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 34235 /* HorizontalVideo */;
  }
  /**
   * Creates a NDKArticle from an existing NDKEvent.
   *
   * @param event NDKEvent to create the NDKArticle from.
   * @returns NDKArticle
   */
  static from(event) {
    return new _NDKVideo(event.ndk, event.rawEvent());
  }
  /**
   * Getter for the article title.
   *
   * @returns {string | undefined} - The article title if available, otherwise undefined.
   */
  get title() {
    return this.tagValue("title");
  }
  /**
   * Setter for the article title.
   *
   * @param {string | undefined} title - The title to set for the article.
   */
  set title(title) {
    this.removeTag("title");
    if (title) this.tags.push(["title", title]);
  }
  /**
   * Getter for the article thumbnail.
   *
   * @returns {string | undefined} - The article thumbnail if available, otherwise undefined.
   */
  get thumbnail() {
    let thumbnail;
    if (this.imetas && this.imetas.length > 0) {
      thumbnail = this.imetas[0].image?.[0];
    }
    return thumbnail ?? this.tagValue("thumb");
  }
  get imetas() {
    if (this._imetas) return this._imetas;
    this._imetas = this.tags.filter((tag) => tag[0] === "imeta").map(mapImetaTag);
    return this._imetas;
  }
  set imetas(tags) {
    this._imetas = tags;
    this.tags = this.tags.filter((tag) => tag[0] !== "imeta");
    this.tags.push(...tags.map(imetaTagToTag));
  }
  get url() {
    if (this.imetas && this.imetas.length > 0) {
      return this.imetas[0].url;
    }
    return this.tagValue("url");
  }
  /**
   * Getter for the article's publication timestamp.
   *
   * @returns {number | undefined} - The Unix timestamp of when the article was published or undefined.
   */
  get published_at() {
    const tag = this.tagValue("published_at");
    if (tag) {
      return parseInt(tag);
    }
    return void 0;
  }
  /**
   * Setter for the article's publication timestamp.
   *
   * @param {number | undefined} timestamp - The Unix timestamp to set for the article's publication date.
   */
  set published_at(timestamp) {
    this.removeTag("published_at");
    if (timestamp !== void 0) {
      this.tags.push(["published_at", timestamp.toString()]);
    }
  }
  /**
   * Generates content tags for the article.
   *
   * This method first checks and sets the publication date if not available,
   * and then generates content tags based on the base NDKEvent class.
   *
   * @returns {ContentTag} - The generated content tags.
   */
  async generateTags() {
    super.generateTags();
    if (!this.published_at) {
      this.published_at = this.created_at;
    }
    return super.generateTags();
  }
  get duration() {
    const tag = this.tagValue("duration");
    if (tag) {
      return parseInt(tag);
    }
    return void 0;
  }
  /**
   * Setter for the video's duration
   *
   * @param {number | undefined} duration - The duration to set for the video (in seconds)
   */
  set duration(dur) {
    this.removeTag("duration");
    if (dur !== void 0) {
      this.tags.push(["duration", Math.floor(dur).toString()]);
    }
  }
};

// src/events/kinds/wiki.ts
var NDKWiki = class extends NDKArticle {
  static kind = 30818 /* Wiki */;
  static kinds = [30818 /* Wiki */];
};

// src/events/wrap.ts
var eventWrappingMap = /* @__PURE__ */ new Map();
[
  NDKImage,
  NDKVideo
].forEach((klass) => {
  klass.kinds.forEach((kind) => {
    eventWrappingMap.set(kind, klass);
  });
});
function wrapEvent(event) {
  const klass = eventWrappingMap.get(event.kind);
  if (klass) return klass.from(event);
  return event;
}

// src/events/kinds/simple-group/member-list.ts
var NDKSimpleGroupMemberList = class _NDKSimpleGroupMemberList extends NDKEvent {
  relaySet;
  memberSet = /* @__PURE__ */ new Set();
  static kind = 39002 /* GroupMembers */;
  static kinds = [39002 /* GroupMembers */];
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 39002 /* GroupMembers */;
    this.memberSet = new Set(this.members);
  }
  static from(event) {
    return new _NDKSimpleGroupMemberList(event.ndk, event);
  }
  get members() {
    return this.getMatchingTags("p").map((tag) => tag[1]);
  }
  hasMember(member) {
    return this.memberSet.has(member);
  }
  async publish(relaySet, timeoutMs, requiredRelayCount) {
    relaySet ??= this.relaySet;
    return super.publishReplaceable(relaySet, timeoutMs, requiredRelayCount);
  }
};

// src/events/kinds/simple-group/metadata.ts
var NDKSimpleGroupMetadata = class _NDKSimpleGroupMetadata extends NDKEvent {
  static kind = 39e3 /* GroupMetadata */;
  static kinds = [39e3 /* GroupMetadata */];
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 39e3 /* GroupMetadata */;
  }
  static from(event) {
    return new _NDKSimpleGroupMetadata(event.ndk, event);
  }
  get name() {
    return this.tagValue("name");
  }
  get picture() {
    return this.tagValue("picture");
  }
  get about() {
    return this.tagValue("about");
  }
  get scope() {
    if (this.getMatchingTags("public").length > 0) return "public";
    if (this.getMatchingTags("public").length > 0) return "private";
  }
  set scope(scope) {
    this.removeTag("public");
    this.removeTag("private");
    if (scope === "public") {
      this.tags.push(["public", ""]);
    } else if (scope === "private") {
      this.tags.push(["private", ""]);
    }
  }
  get access() {
    if (this.getMatchingTags("open").length > 0) return "open";
    if (this.getMatchingTags("closed").length > 0) return "closed";
  }
  set access(access) {
    this.removeTag("open");
    this.removeTag("closed");
    if (access === "open") {
      this.tags.push(["open", ""]);
    } else if (access === "closed") {
      this.tags.push(["closed", ""]);
    }
  }
};

// src/events/kinds/simple-group/index.ts
var NDKSimpleGroup = class _NDKSimpleGroup {
  ndk;
  groupId;
  relaySet;
  fetchingMetadata;
  metadata;
  memberList;
  adminList;
  constructor(ndk, relaySet, groupId) {
    this.ndk = ndk;
    this.groupId = groupId ?? randomId(24);
    this.relaySet = relaySet;
  }
  get id() {
    return this.groupId;
  }
  relayUrls() {
    return this.relaySet.relayUrls;
  }
  get name() {
    return this.metadata?.name;
  }
  get about() {
    return this.metadata?.about;
  }
  get picture() {
    return this.metadata?.picture;
  }
  get members() {
    return this.memberList?.members ?? [];
  }
  get admins() {
    return this.adminList?.members ?? [];
  }
  async getMetadata() {
    await this.ensureMetadataEvent();
    return this.metadata;
  }
  /**
   * Creates the group by publishing a kind:9007 event.
   * @param signer
   * @returns
   */
  async createGroup(signer) {
    signer ??= this.ndk.signer;
    if (!signer) throw new Error("No signer available");
    const user = await signer.user();
    if (!user) throw new Error("No user available");
    const event = new NDKEvent(this.ndk);
    event.kind = 9007 /* GroupAdminCreateGroup */;
    event.tags.push(["h", this.groupId]);
    await event.sign(signer);
    return event.publish(this.relaySet);
  }
  async setMetadata({
    name,
    about,
    picture
  }) {
    const event = new NDKEvent(this.ndk);
    event.kind = 9002 /* GroupAdminEditMetadata */;
    event.tags.push(["h", this.groupId]);
    if (name) event.tags.push(["name", name]);
    if (about) event.tags.push(["about", about]);
    if (picture) event.tags.push(["picture", picture]);
    await event.sign();
    return event.publish(this.relaySet);
  }
  /**
   * Adds a user to the group using a kind:9000 event
   * @param user user to add
   * @param opts options
   */
  async addUser(user) {
    const addUserEvent = _NDKSimpleGroup.generateAddUserEvent(user.pubkey, this.groupId);
    addUserEvent.ndk = this.ndk;
    return addUserEvent;
  }
  async getMemberListEvent() {
    const memberList = await this.ndk.fetchEvent(
      {
        kinds: [39002 /* GroupMembers */],
        "#d": [this.groupId]
      },
      void 0,
      this.relaySet
    );
    if (!memberList) return null;
    return NDKSimpleGroupMemberList.from(memberList);
  }
  /**
   * Gets a list of users that belong to this group
   */
  async getMembers() {
    const members = [];
    const memberPubkeys = /* @__PURE__ */ new Set();
    const memberListEvent = await this.getMemberListEvent();
    if (!memberListEvent) return [];
    for (const pTag of memberListEvent.getMatchingTags("p")) {
      const pubkey = pTag[1];
      if (memberPubkeys.has(pubkey)) continue;
      memberPubkeys.add(pubkey);
      try {
        members.push(this.ndk.getUser({ pubkey }));
      } catch {
      }
    }
    return members;
  }
  /**
   * Generates an event that lists the members of a group.
   * @param groupId
   * @returns
   */
  static generateUserListEvent(groupId) {
    const event = new NDKEvent(void 0, {
      kind: 39002 /* GroupMembers */,
      tags: [
        ["h", groupId],
        ["alt", "Group Member List"]
      ]
    });
    return event;
  }
  /**
   * Generates an event that adds a user to a group.
   * @param userPubkey pubkey of the user to add
   * @param groupId group to add the user to
   * @returns
   */
  static generateAddUserEvent(userPubkey, groupId) {
    const event = new NDKEvent(void 0, {
      kind: 9e3 /* GroupAdminAddUser */,
      tags: [["h", groupId]]
    });
    event.tags.push(["p", userPubkey]);
    return event;
  }
  async requestToJoin(pubkey, content) {
    const event = new NDKEvent(this.ndk, {
      kind: 9021 /* GroupAdminRequestJoin */,
      content: content ?? "",
      tags: [["h", this.groupId]]
    });
    return event.publish(this.relaySet);
  }
  /**
   * Makes sure that a metadata event exists locally
   */
  async ensureMetadataEvent() {
    if (this.metadata) return;
    if (this.fetchingMetadata) return this.fetchingMetadata;
    this.fetchingMetadata = this.ndk.fetchEvent(
      {
        kinds: [39e3 /* GroupMetadata */],
        "#d": [this.groupId]
      },
      void 0,
      this.relaySet
    ).then((event) => {
      if (event) {
        this.metadata = NDKSimpleGroupMetadata.from(event);
      } else {
        this.metadata = new NDKSimpleGroupMetadata(this.ndk);
        this.metadata.dTag = this.groupId;
      }
    }).finally(() => {
      this.fetchingMetadata = void 0;
    }).catch(() => {
      throw new Error("Failed to fetch metadata for group " + this.groupId);
    });
    return this.fetchingMetadata;
  }
};
function randomId(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charsLength = chars.length;
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charsLength));
  }
  return result;
}

// src/app-settings/index.ts
var NDKAppSettings = class _NDKAppSettings extends NDKEvent {
  appName;
  settings = {};
  constructor(ndk, rawEvent) {
    super(ndk, rawEvent);
    this.kind ??= 30078 /* AppSpecificData */;
    this.dTag ??= this.appName;
    if (this.content.length > 0) {
      try {
        this.settings = JSON.parse(this.content);
      } catch (error) {
        console.error("Error parsing app settings", error);
      }
    }
  }
  static from(event) {
    return new _NDKAppSettings(event.ndk, event);
  }
  /**
   * Set a value for a given key.
   *
   * @param key
   * @param value
   */
  set(key, value) {
    this.settings[key] = value;
  }
  /**
   * Get a value for a given key.
   *
   * @param key
   * @returns
   */
  get(key) {
    return this.settings[key];
  }
  async publishReplaceable(relaySet, timeoutMs, requiredRelayCount) {
    this.content = JSON.stringify(this.settings);
    return super.publishReplaceable(relaySet, timeoutMs, requiredRelayCount);
  }
};

// src/relay/auth-policies.ts
import createDebug3 from "debug";
function disconnect(pool, debug8) {
  debug8 ??= createDebug3("ndk:relay:auth-policies:disconnect");
  return async (relay) => {
    debug8(`Relay ${relay.url} requested authentication, disconnecting`);
    pool.removeRelay(relay.url);
  };
}
async function signAndAuth(event, relay, signer, debug8, resolve, reject) {
  try {
    await event.sign(signer);
    resolve(event);
  } catch (e) {
    debug8(`Failed to publish auth event to relay ${relay.url}`, e);
    reject(event);
  }
}
function signIn({ ndk, signer, debug: debug8 } = {}) {
  debug8 ??= createDebug3("ndk:auth-policies:signIn");
  return async (relay, challenge) => {
    debug8(`Relay ${relay.url} requested authentication, signing in`);
    const event = new NDKEvent(ndk);
    event.kind = 22242 /* ClientAuth */;
    event.tags = [
      ["relay", relay.url],
      ["challenge", challenge]
    ];
    signer ??= ndk?.signer;
    return new Promise(async (resolve, reject) => {
      if (signer) {
        await signAndAuth(event, relay, signer, debug8, resolve, reject);
      } else {
        ndk?.once("signer:ready", async (signer2) => {
          await signAndAuth(event, relay, signer2, debug8, resolve, reject);
        });
      }
    });
  };
}
var NDKRelayAuthPolicies = {
  disconnect,
  signIn
};

// src/signers/nip07/index.ts
import debug5 from "debug";
var NDKNip07Signer = class {
  _userPromise;
  nip04Queue = [];
  nip04Processing = false;
  debug;
  waitTimeout;
  /**
   * @param waitTimeout - The timeout in milliseconds to wait for the NIP-07 to become available
   */
  constructor(waitTimeout = 1e3) {
    this.debug = debug5("ndk:nip07");
    this.waitTimeout = waitTimeout;
  }
  async blockUntilReady() {
    await this.waitForExtension();
    const pubkey = await window.nostr.getPublicKey();
    if (!pubkey) {
      throw new Error("User rejected access");
    }
    return new NDKUser({ pubkey });
  }
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
  async relays(ndk) {
    await this.waitForExtension();
    const relays = await window.nostr.getRelays?.() || {};
    const activeRelays = [];
    for (const url of Object.keys(relays)) {
      if (relays[url].read && relays[url].write) {
        activeRelays.push(url);
      }
    }
    return activeRelays.map((url) => new NDKRelay(url, ndk?.relayAuthDefaultPolicy, ndk));
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
    const { type, counterpartyHexpubkey, value, resolve, reject } = item || this.nip04Queue.shift();
    try {
      let result;
      if (type === "encrypt") {
        result = await window.nostr.nip04.encrypt(counterpartyHexpubkey, value);
      } else {
        result = await window.nostr.nip04.decrypt(counterpartyHexpubkey, value);
      }
      resolve(result);
    } catch (error) {
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
      const intervalId = setInterval(() => {
        if (window.nostr) {
          clearTimeout(timerId);
          clearInterval(intervalId);
          resolve();
        }
      }, 100);
      timerId = setTimeout(() => {
        clearInterval(intervalId);
        reject(new Error("NIP-07 extension not available"));
      }, this.waitTimeout);
    });
  }
};

// src/signers/private-key/index.ts
import { generateSecretKey, getPublicKey, finalizeEvent, nip04, nip44 } from "nostr-tools";
import { bytesToHex as bytesToHex2, hexToBytes } from "@noble/hashes/utils";
import { nip19 as nip196 } from "nostr-tools";
var NDKPrivateKeySigner = class _NDKPrivateKeySigner {
  _user;
  _privateKey;
  constructor(privateKey) {
    if (privateKey) {
      if (typeof privateKey === "string") {
        if (privateKey.startsWith("nsec1")) {
          const { type, data } = nip196.decode(privateKey);
          if (type === "nsec") this._privateKey = data;
        } else if (privateKey.length === 64) {
          this._privateKey = hexToBytes(privateKey);
        } else {
          throw new Error("Invalid private key provided.");
        }
      } else {
        this._privateKey = privateKey;
      }
      if (this._privateKey) {
        this._user = new NDKUser({
          pubkey: getPublicKey(this._privateKey)
        });
      }
    }
  }
  get privateKey() {
    if (!this._privateKey) return void 0;
    return bytesToHex2(this._privateKey);
  }
  static generate() {
    const privateKey = generateSecretKey();
    return new _NDKPrivateKeySigner(privateKey);
  }
  async blockUntilReady() {
    if (!this._user) {
      throw new Error("NDKUser not initialized");
    }
    return this._user;
  }
  async user() {
    await this.blockUntilReady();
    return this._user;
  }
  async sign(event) {
    if (!this._privateKey) {
      throw Error("Attempted to sign without a private key");
    }
    return finalizeEvent(event, this._privateKey).sig;
  }
  getConversationKey(recipient) {
    if (!this._privateKey) {
      throw Error("Attempted to get conversation key without a private key");
    }
    const recipientHexPubKey = recipient.pubkey;
    return nip44.getConversationKey(this._privateKey, recipientHexPubKey);
  }
  async nip44Encrypt(recipient, value) {
    const conversationKey = this.getConversationKey(recipient);
    return await nip44.encrypt(value, conversationKey);
  }
  async nip44Decrypt(sender, value) {
    const conversationKey = this.getConversationKey(sender);
    return await nip44.decrypt(value, conversationKey);
  }
  /**
   * This method is deprecated and will be removed in a future release, for compatibility
   * this function calls nip04Encrypt.
   */
  async encrypt(recipient, value, type = DEFAULT_ENCRYPTION_SCHEME) {
    if (type === "nip44") {
      return this.nip44Encrypt(recipient, value);
    } else {
      return this.nip04Encrypt(recipient, value);
    }
  }
  /**
   * This method is deprecated and will be removed in a future release, for compatibility
   * this function calls nip04Decrypt.
   */
  async decrypt(sender, value, type = DEFAULT_ENCRYPTION_SCHEME) {
    if (type === "nip44") {
      return this.nip44Decrypt(sender, value);
    } else {
      return this.nip04Decrypt(sender, value);
    }
  }
  async nip04Encrypt(recipient, value) {
    if (!this._privateKey) {
      throw Error("Attempted to encrypt without a private key");
    }
    const recipientHexPubKey = recipient.pubkey;
    return await nip04.encrypt(this._privateKey, recipientHexPubKey, value);
  }
  async nip04Decrypt(sender, value) {
    if (!this._privateKey) {
      throw Error("Attempted to decrypt without a private key");
    }
    const senderHexPubKey = sender.pubkey;
    return await nip04.decrypt(this._privateKey, senderHexPubKey, value);
  }
};

// src/signers/nip46/rpc.ts
import { EventEmitter as EventEmitter5 } from "tseep";
var NDKNostrRpc = class extends EventEmitter5 {
  ndk;
  signer;
  relaySet;
  debug;
  encryptionType = "nip04";
  pool;
  constructor(ndk, signer, debug8, relayUrls) {
    super();
    this.ndk = ndk;
    this.signer = signer;
    if (relayUrls) {
      this.pool = new NDKPool(
        relayUrls,
        Array.from(ndk.pool.blacklistRelayUrls),
        ndk,
        debug8.extend("rpc-pool")
      );
      this.pool.name = "nostr-rpc";
      this.relaySet = new NDKRelaySet(/* @__PURE__ */ new Set(), ndk, this.pool);
      for (const url of relayUrls) {
        const relay = this.pool.getRelay(url, false, false);
        relay.authPolicy = NDKRelayAuthPolicies.signIn({ ndk, signer, debug: debug8 });
        this.relaySet.addRelay(relay);
        relay.connect();
      }
    }
    this.debug = debug8.extend("rpc");
  }
  /**
   * Subscribe to a filter. This function will resolve once the subscription is ready.
   */
  subscribe(filter) {
    const sub = this.ndk.subscribe(
      filter,
      {
        closeOnEose: false,
        groupable: false,
        cacheUsage: "ONLY_RELAY" /* ONLY_RELAY */,
        pool: this.pool
      },
      this.relaySet,
      false
    );
    sub.on("event", async (event) => {
      try {
        const parsedEvent = await this.parseEvent(event);
        if (parsedEvent.method) {
          this.emit("request", parsedEvent);
        } else {
          this.emit(`response-${parsedEvent.id}`, parsedEvent);
        }
      } catch (e) {
        this.debug("error parsing event", e, event.rawEvent());
      }
    });
    return new Promise((resolve) => {
      sub.on("eose", () => {
        this.debug("eosed");
        resolve(sub);
      });
      sub.start();
    });
  }
  async parseEvent(event) {
    if (this.encryptionType === "nip44" && event.content.includes("?iv=")) {
      this.encryptionType = "nip04";
    } else if (this.encryptionType === "nip04" && !event.content.includes("?iv=")) {
      this.encryptionType = "nip44";
    }
    const remoteUser = this.ndk.getUser({ pubkey: event.pubkey });
    remoteUser.ndk = this.ndk;
    let decryptedContent;
    try {
      decryptedContent = await this.signer.decrypt(
        remoteUser,
        event.content,
        this.encryptionType
      );
    } catch (e) {
      const otherEncryptionType = this.encryptionType === "nip04" ? "nip44" : "nip04";
      decryptedContent = await this.signer.decrypt(remoteUser, event.content, otherEncryptionType);
      this.encryptionType = otherEncryptionType;
    }
    const parsedContent = JSON.parse(decryptedContent);
    const { id, method, params, result, error } = parsedContent;
    if (method) {
      return { id, pubkey: event.pubkey, method, params, event };
    } else {
      return { id, result, error, event };
    }
  }
  async sendResponse(id, remotePubkey, result, kind = 24133 /* NostrConnect */, error) {
    const res = { id, result };
    if (error) {
      res.error = error;
    }
    const localUser = await this.signer.user();
    const remoteUser = this.ndk.getUser({ pubkey: remotePubkey });
    const event = new NDKEvent(this.ndk, {
      kind,
      content: JSON.stringify(res),
      tags: [["p", remotePubkey]],
      pubkey: localUser.pubkey
    });
    event.content = await this.signer.encrypt(remoteUser, event.content, this.encryptionType);
    await event.sign(this.signer);
    await event.publish(this.relaySet);
  }
  /**
   * Sends a request.
   * @param remotePubkey
   * @param method
   * @param params
   * @param kind
   * @param id
   */
  async sendRequest(remotePubkey, method, params = [], kind = 24133, cb) {
    const id = Math.random().toString(36).substring(7);
    const localUser = await this.signer.user();
    const remoteUser = this.ndk.getUser({ pubkey: remotePubkey });
    const request = { id, method, params };
    const promise = new Promise(() => {
      const responseHandler = (response) => {
        if (response.result === "auth_url") {
          this.once(`response-${id}`, responseHandler);
          this.emit("authUrl", response.error);
        } else if (cb) {
          cb(response);
        }
      };
      this.once(`response-${id}`, responseHandler);
    });
    const event = new NDKEvent(this.ndk, {
      kind,
      content: JSON.stringify(request),
      tags: [["p", remotePubkey]],
      pubkey: localUser.pubkey
    });
    event.content = await this.signer.encrypt(remoteUser, event.content, this.encryptionType);
    await event.sign(this.signer);
    await event.publish(this.relaySet);
    return promise;
  }
};

// src/signers/nip46/backend/ping.ts
var PingEventHandlingStrategy = class {
  async handle(backend, id, remotePubkey, params) {
    const debug8 = backend.debug.extend("ping");
    debug8(`ping request from ${remotePubkey}`);
    if (await backend.pubkeyAllowed({ id, pubkey: remotePubkey, method: "ping" })) {
      debug8(`connection request from ${remotePubkey} allowed`);
      return "pong";
    } else {
      debug8(`connection request from ${remotePubkey} rejected`);
    }
    return void 0;
  }
};

// src/signers/nip46/backend/connect.ts
var ConnectEventHandlingStrategy = class {
  async handle(backend, id, remotePubkey, params) {
    const [_, token] = params;
    const debug8 = backend.debug.extend("connect");
    debug8(`connection request from ${remotePubkey}`);
    if (token && backend.applyToken) {
      debug8(`applying token`);
      await backend.applyToken(remotePubkey, token);
    }
    if (await backend.pubkeyAllowed({
      id,
      pubkey: remotePubkey,
      method: "connect",
      params: token
    })) {
      debug8(`connection request from ${remotePubkey} allowed`);
      return "ack";
    } else {
      debug8(`connection request from ${remotePubkey} rejected`);
    }
    return void 0;
  }
};

// src/signers/nip46/backend/get-public-key.ts
var GetPublicKeyHandlingStrategy = class {
  async handle(backend, id, remotePubkey, params) {
    return backend.localUser?.pubkey;
  }
};

// src/signers/nip46/backend/nip04-decrypt.ts
var Nip04DecryptHandlingStrategy = class {
  async handle(backend, id, remotePubkey, params) {
    const [senderPubkey, payload] = params;
    const senderUser = new NDKUser({ pubkey: senderPubkey });
    const decryptedPayload = await decrypt2(backend, id, remotePubkey, senderUser, payload);
    return decryptedPayload;
  }
};
async function decrypt2(backend, id, remotePubkey, senderUser, payload) {
  if (!await backend.pubkeyAllowed({
    id,
    pubkey: remotePubkey,
    method: "nip04_decrypt",
    params: payload
  })) {
    backend.debug(`decrypt request from ${remotePubkey} rejected`);
    return void 0;
  }
  return await backend.signer.decrypt(senderUser, payload, "nip04");
}

// src/signers/nip46/backend/nip04-encrypt.ts
var Nip04EncryptHandlingStrategy = class {
  async handle(backend, id, remotePubkey, params) {
    const [recipientPubkey, payload] = params;
    const recipientUser = new NDKUser({ pubkey: recipientPubkey });
    const encryptedPayload = await encrypt2(backend, id, remotePubkey, recipientUser, payload);
    return encryptedPayload;
  }
};
async function encrypt2(backend, id, remotePubkey, recipientUser, payload) {
  if (!await backend.pubkeyAllowed({
    id,
    pubkey: remotePubkey,
    method: "nip04_encrypt",
    params: payload
  })) {
    backend.debug(`encrypt request from ${remotePubkey} rejected`);
    return void 0;
  }
  return await backend.signer.encrypt(recipientUser, payload, "nip04");
}

// src/signers/nip46/backend/sign-event.ts
var SignEventHandlingStrategy = class {
  async handle(backend, id, remotePubkey, params) {
    const event = await signEvent(backend, id, remotePubkey, params);
    if (!event) return void 0;
    return JSON.stringify(await event.toNostrEvent());
  }
};
async function signEvent(backend, id, remotePubkey, params) {
  const [eventString] = params;
  backend.debug(`sign event request from ${remotePubkey}`);
  const event = new NDKEvent(backend.ndk, JSON.parse(eventString));
  backend.debug("event to sign", event.rawEvent());
  if (!await backend.pubkeyAllowed({
    id,
    pubkey: remotePubkey,
    method: "sign_event",
    params: event
  })) {
    backend.debug(`sign event request from ${remotePubkey} rejected`);
    return void 0;
  }
  backend.debug(`sign event request from ${remotePubkey} allowed`);
  await event.sign(backend.signer);
  return event;
}

// src/signers/nip46/backend/nip44-encrypt.ts
var Nip04EncryptHandlingStrategy2 = class {
  async handle(backend, id, remotePubkey, params) {
    const [recipientPubkey, payload] = params;
    const recipientUser = new NDKUser({ pubkey: recipientPubkey });
    const encryptedPayload = await encrypt3(backend, id, remotePubkey, recipientUser, payload);
    return encryptedPayload;
  }
};
async function encrypt3(backend, id, remotePubkey, recipientUser, payload) {
  if (!await backend.pubkeyAllowed({
    id,
    pubkey: remotePubkey,
    method: "nip44_encrypt",
    params: payload
  })) {
    backend.debug(`encrypt request from ${remotePubkey} rejected`);
    return void 0;
  }
  return await backend.signer.encrypt(recipientUser, payload, "nip44");
}

// src/signers/nip46/backend/nip44-decrypt.ts
var Nip04DecryptHandlingStrategy2 = class {
  async handle(backend, id, remotePubkey, params) {
    const [senderPubkey, payload] = params;
    const senderUser = new NDKUser({ pubkey: senderPubkey });
    const decryptedPayload = await decrypt3(backend, id, remotePubkey, senderUser, payload);
    return decryptedPayload;
  }
};
async function decrypt3(backend, id, remotePubkey, senderUser, payload) {
  if (!await backend.pubkeyAllowed({
    id,
    pubkey: remotePubkey,
    method: "nip44_decrypt",
    params: payload
  })) {
    backend.debug(`decrypt request from ${remotePubkey} rejected`);
    return void 0;
  }
  return await backend.signer.decrypt(senderUser, payload, "nip44");
}

// src/signers/nip46/backend/index.ts
import { hexToBytes as hexToBytes2 } from "@noble/hashes/utils";
var NDKNip46Backend = class {
  ndk;
  signer;
  localUser;
  debug;
  rpc;
  permitCallback;
  relayUrls;
  /**
   * @param ndk The NDK instance to use
   * @param privateKeyOrSigner The private key or signer of the npub that wants to be published as
   * @param permitCallback Callback executed when permission is requested
   */
  constructor(ndk, privateKeyOrSigner, permitCallback, relayUrls) {
    this.ndk = ndk;
    if (privateKeyOrSigner instanceof Uint8Array) {
      this.signer = new NDKPrivateKeySigner(privateKeyOrSigner);
    } else if (privateKeyOrSigner instanceof String) {
      this.signer = new NDKPrivateKeySigner(hexToBytes2(privateKeyOrSigner));
    } else if (privateKeyOrSigner instanceof NDKPrivateKeySigner) {
      this.signer = privateKeyOrSigner;
    } else {
      throw new Error("Invalid signer");
    }
    this.debug = ndk.debug.extend("nip46:backend");
    this.relayUrls = relayUrls ?? Array.from(ndk.pool.relays.keys());
    this.rpc = new NDKNostrRpc(ndk, this.signer, this.debug, this.relayUrls);
    this.permitCallback = permitCallback;
  }
  /**
   * This method starts the backend, which will start listening for incoming
   * requests.
   */
  async start() {
    this.localUser = await this.signer.user();
    const sub = this.ndk.subscribe(
      {
        kinds: [24133],
        "#p": [this.localUser.pubkey]
      },
      { closeOnEose: false }
    );
    sub.on("event", (e) => this.handleIncomingEvent(e));
  }
  handlers = {
    connect: new ConnectEventHandlingStrategy(),
    sign_event: new SignEventHandlingStrategy(),
    nip04_encrypt: new Nip04EncryptHandlingStrategy(),
    nip04_decrypt: new Nip04DecryptHandlingStrategy(),
    nip44_encrypt: new Nip04EncryptHandlingStrategy2(),
    nip44_decrypt: new Nip04DecryptHandlingStrategy2(),
    get_public_key: new GetPublicKeyHandlingStrategy(),
    ping: new PingEventHandlingStrategy()
  };
  /**
   * Enables the user to set a custom strategy for handling incoming events.
   * @param method - The method to set the strategy for
   * @param strategy - The strategy to set
   */
  setStrategy(method, strategy) {
    this.handlers[method] = strategy;
  }
  /**
   * Overload this method to apply tokens, which can
   * wrap permission sets to be applied to a pubkey.
   * @param pubkey public key to apply token to
   * @param token token to apply
   */
  async applyToken(pubkey, token) {
    throw new Error("connection token not supported");
  }
  async handleIncomingEvent(event) {
    const { id, method, params } = await this.rpc.parseEvent(event);
    const remotePubkey = event.pubkey;
    let response;
    this.debug("incoming event", { id, method, params });
    if (!event.verifySignature(false)) {
      this.debug("invalid signature", event.rawEvent());
      return;
    }
    const strategy = this.handlers[method];
    if (strategy) {
      try {
        response = await strategy.handle(this, id, remotePubkey, params);
      } catch (e) {
        this.debug("error handling event", e, { id, method, params });
        this.rpc.sendResponse(id, remotePubkey, "error", void 0, e.message);
      }
    } else {
      this.debug("unsupported method", { method, params });
    }
    if (response) {
      this.debug(`sending response to ${remotePubkey}`, response);
      this.rpc.sendResponse(id, remotePubkey, response);
    } else {
      this.rpc.sendResponse(id, remotePubkey, "error", void 0, "Not authorized");
    }
  }
  /**
   * This method should be overriden by the user to allow or reject incoming
   * connections.
   */
  async pubkeyAllowed(params) {
    return this.permitCallback(params);
  }
};

// src/signers/nip46/index.ts
import { EventEmitter as EventEmitter6 } from "tseep";
var NDKNip46Signer = class extends EventEmitter6 {
  ndk;
  _user;
  /**
   * The pubkey of the bunker that will be providing signatures
   */
  bunkerPubkey;
  /**
   * The pubkey of the user that events will be published as
   */
  userPubkey;
  /**
   * An optional secret value provided to connect to the bunker
   */
  secret;
  localSigner;
  nip05;
  rpc;
  debug;
  relayUrls;
  subscription;
  /**
   * @param ndk - The NDK instance to use
   * @param userOrConnectionToken - The public key, or a connection token, of the npub that wants to be published as
   * @param localSigner - The signer that will be used to request events to be signed
   */
  constructor(ndk, userOrConnectionToken, localSigner) {
    super();
    this.ndk = ndk;
    this.debug = ndk.debug.extend("nip46:signer");
    if (userOrConnectionToken.startsWith("bunker://")) {
      this.connectionTokenInit(userOrConnectionToken);
    } else {
      this.nip05Init(userOrConnectionToken);
    }
    if (!localSigner) {
      this.localSigner = NDKPrivateKeySigner.generate();
    } else {
      this.localSigner = localSigner;
    }
    this.rpc = new NDKNostrRpc(this.ndk, this.localSigner, this.debug, this.relayUrls);
  }
  connectionTokenInit(connectionToken) {
    const bunkerUrl = new URL(connectionToken);
    const bunkerPubkey = bunkerUrl.hostname || bunkerUrl.pathname.replace(/^\/\//, "");
    const userPubkey = bunkerUrl.searchParams.get("pubkey");
    const relayUrls = bunkerUrl.searchParams.getAll("relay");
    const secret = bunkerUrl.searchParams.get("secret");
    this.bunkerPubkey = bunkerPubkey;
    this.userPubkey = userPubkey;
    this.relayUrls = relayUrls;
    this.secret = secret;
  }
  nip05Init(nip05) {
    this.nip05 = nip05;
  }
  /**
   * @deprecated Use userPubkey instead
   */
  get remotePubkey() {
    return this.userPubkey;
  }
  /**
   * We start listening for events from the bunker
   */
  async startListening() {
    if (this.subscription) return;
    const localUser = await this.localSigner.user();
    if (!localUser) throw new Error("Local signer not ready");
    this.subscription = await this.rpc.subscribe({
      kinds: [24133 /* NostrConnect */],
      "#p": [localUser.pubkey]
    });
  }
  /**
   * Get the user that is being published as
   */
  async user() {
    if (!this._user && !this.userPubkey) throw new Error("Remote user not ready");
    this._user ??= new NDKUser({ pubkey: this.userPubkey });
    return this._user;
  }
  async blockUntilReady() {
    if (this.nip05 && !this.userPubkey) {
      const user = await NDKUser.fromNip05(this.nip05, this.ndk);
      if (user) {
        this._user = user;
        this.userPubkey = user.pubkey;
        this.relayUrls = user.nip46Urls;
        this.rpc = new NDKNostrRpc(this.ndk, this.localSigner, this.debug, this.relayUrls);
      }
    }
    if (!this.bunkerPubkey && this.userPubkey) {
      this.bunkerPubkey = this.userPubkey;
    } else if (!this.bunkerPubkey) {
      throw new Error("Bunker pubkey not set");
    }
    await this.startListening();
    this.rpc.on("authUrl", (...props) => {
      this.emit("authUrl", ...props);
    });
    return new Promise((resolve, reject) => {
      const connectParams = [this.userPubkey ?? ""];
      if (this.secret) connectParams.push(this.secret);
      if (!this.bunkerPubkey) throw new Error("Bunker pubkey not set");
      this.rpc.sendRequest(
        this.bunkerPubkey,
        "connect",
        connectParams,
        24133,
        (response) => {
          if (response.result === "ack") {
            this.getPublicKey().then((pubkey) => {
              this.userPubkey = pubkey;
              this._user = new NDKUser({ pubkey });
              resolve(this._user);
            });
          } else {
            reject(response.error);
          }
        }
      );
    });
  }
  async getPublicKey() {
    if (this.userPubkey) return this.userPubkey;
    return new Promise((resolve, reject) => {
      if (!this.bunkerPubkey) throw new Error("Bunker pubkey not set");
      this.rpc.sendRequest(
        this.bunkerPubkey,
        "get_public_key",
        [],
        24133,
        (response) => {
          resolve(response.result);
        }
      );
    });
  }
  async encrypt(recipient, value) {
    return this.nip04Encrypt(recipient, value);
  }
  async decrypt(sender, value) {
    return this.nip04Decrypt(sender, value);
  }
  async nip04Encrypt(recipient, value) {
    return this._encrypt(recipient, value, "nip04");
  }
  async nip04Decrypt(sender, value) {
    return this._decrypt(sender, value, "nip04");
  }
  async nip44Encrypt(recipient, value) {
    return this._encrypt(recipient, value, "nip44");
  }
  async nip44Decrypt(sender, value) {
    return this._decrypt(sender, value, "nip44");
  }
  async _encrypt(recipient, value, method) {
    const promise = new Promise((resolve, reject) => {
      if (!this.bunkerPubkey) throw new Error("Bunker pubkey not set");
      this.rpc.sendRequest(
        this.bunkerPubkey,
        method + "_encrypt",
        [recipient.pubkey, value],
        24133,
        (response) => {
          if (!response.error) {
            resolve(response.result);
          } else {
            reject(response.error);
          }
        }
      );
    });
    return promise;
  }
  async _decrypt(sender, value, method) {
    const promise = new Promise((resolve, reject) => {
      if (!this.bunkerPubkey) throw new Error("Bunker pubkey not set");
      this.rpc.sendRequest(
        this.bunkerPubkey,
        method + "_decrypt",
        [sender.pubkey, value],
        24133,
        (response) => {
          if (!response.error) {
            resolve(response.result);
          } else {
            reject(response.error);
          }
        }
      );
    });
    return promise;
  }
  async sign(event) {
    const promise = new Promise((resolve, reject) => {
      if (!this.bunkerPubkey) throw new Error("Bunker pubkey not set");
      this.rpc.sendRequest(
        this.bunkerPubkey,
        "sign_event",
        [JSON.stringify(event)],
        24133,
        (response) => {
          if (!response.error) {
            const json = JSON.parse(response.result);
            resolve(json.sig);
          } else {
            reject(response.error);
          }
        }
      );
    });
    return promise;
  }
  /**
   * Allows creating a new account on the remote server.
   * @param username Desired username for the NIP-05
   * @param domain Desired domain for the NIP-05
   * @param email Email address to associate with this account -- Remote servers may use this for recovery
   * @returns The public key of the newly created account
   */
  async createAccount(username, domain, email) {
    await this.startListening();
    const req = [];
    if (username) req.push(username);
    if (domain) req.push(domain);
    if (email) req.push(email);
    return new Promise((resolve, reject) => {
      if (!this.bunkerPubkey) throw new Error("Bunker pubkey not set");
      this.rpc.sendRequest(
        this.bunkerPubkey,
        "create_account",
        req,
        24133 /* NostrConnect */,
        (response) => {
          if (!response.error) {
            const pubkey = response.result;
            resolve(pubkey);
          } else {
            reject(response.error);
          }
        }
      );
    });
  }
};

// src/dvm/schedule.ts
function addRelays(event, relays) {
  const tags = [];
  if (!relays || relays.length === 0) {
    const poolRelays = event.ndk?.pool.relays;
    relays = poolRelays ? Object.keys(poolRelays) : void 0;
  }
  if (relays && relays.length > 0) tags.push(["relays", ...relays]);
  return tags;
}
async function dvmSchedule(events, dvm, relays, encrypted = true, waitForConfirmationForMs) {
  if (!(events instanceof Array)) {
    events = [events];
  }
  const ndk = events[0].ndk;
  if (!ndk) throw new Error("NDK not set");
  for (const event of events) {
    if (!event.sig) throw new Error("Event not signed");
    if (!event.created_at) throw new Error("Event has no date");
    if (!dvm) throw new Error("No DVM specified");
    if (event.created_at <= Date.now() / 1e3)
      throw new Error("Event needs to be in the future");
  }
  const scheduleEvent = new NDKDVMRequest(ndk, {
    kind: 5905 /* DVMEventSchedule */
  });
  for (const event of events) {
    scheduleEvent.addInput(JSON.stringify(event.rawEvent()), "text");
  }
  scheduleEvent.tags.push(...addRelays(events[0], relays));
  if (encrypted) {
    await scheduleEvent.encryption(dvm);
  } else {
    scheduleEvent.dvm = dvm;
  }
  await scheduleEvent.sign();
  let res;
  if (waitForConfirmationForMs) {
    res = ndk.subscribe(
      {
        kinds: [5905 /* DVMEventSchedule */ + 1e3, 7e3 /* DVMJobFeedback */],
        ...scheduleEvent.filter()
      },
      { groupable: false, closeOnEose: false }
    );
  }
  const timeoutPromise = new Promise((reject) => {
    setTimeout(() => {
      res?.stop();
      reject("Timeout waiting for an answer from the DVM");
    }, waitForConfirmationForMs);
  });
  const schedulePromise = new Promise(
    (resolve, reject) => {
      if (waitForConfirmationForMs) {
        res?.on("event", async (e) => {
          res?.stop();
          if (e.kind === 7e3 /* DVMJobFeedback */) {
            const feedback = await NDKDVMJobFeedback.from(e);
            if (feedback.status === "error") {
              const statusTag = feedback.getMatchingTags("status");
              reject(statusTag?.[2] ?? feedback);
            } else {
              resolve(feedback);
            }
          }
          resolve(e);
        });
      }
      scheduleEvent.publish().then(() => {
        if (!waitForConfirmationForMs) resolve();
      });
    }
  );
  return new Promise((resolve, reject) => {
    if (waitForConfirmationForMs) {
      Promise.race([timeoutPromise, schedulePromise]).then((e) => {
        resolve(e);
      }).catch(reject);
    } else {
      schedulePromise.then(resolve);
    }
  });
}

// src/ndk/index.ts
import debug7 from "debug";
import { EventEmitter as EventEmitter8 } from "tseep";

// src/events/dedup.ts
function dedup(event1, event2) {
  if (event1.created_at > event2.created_at) {
    return event1;
  }
  return event2;
}

// src/outbox/tracker.ts
import { EventEmitter as EventEmitter7 } from "tseep";
import { LRUCache as LRUCache2 } from "typescript-lru-cache";

// src/utils/get-users-relay-list.ts
async function getRelayListForUser(pubkey, ndk) {
  const list = await getRelayListForUsers([pubkey], ndk);
  return list.get(pubkey);
}
async function getRelayListForUsers(pubkeys, ndk, skipCache = false) {
  const pool = ndk.outboxPool || ndk.pool;
  const set = /* @__PURE__ */ new Set();
  for (const relay of pool.relays.values()) set.add(relay);
  const relayLists = /* @__PURE__ */ new Map();
  const fromContactList = /* @__PURE__ */ new Map();
  const relaySet = new NDKRelaySet(set, ndk);
  if (ndk.cacheAdapter?.locking && !skipCache) {
    const cachedList = await ndk.fetchEvents(
      { kinds: [3, 10002], authors: pubkeys },
      { cacheUsage: "ONLY_CACHE" /* ONLY_CACHE */ }
    );
    for (const relayList of cachedList) {
      if (relayList.kind === 10002)
        relayLists.set(relayList.pubkey, NDKRelayList.from(relayList));
    }
    for (const relayList of cachedList) {
      if (relayList.kind === 3) {
        if (relayLists.has(relayList.pubkey)) continue;
        const list = relayListFromKind3(ndk, relayList);
        if (list) fromContactList.set(relayList.pubkey, list);
      }
    }
    pubkeys = pubkeys.filter(
      (pubkey) => !relayLists.has(pubkey) && !fromContactList.has(pubkey)
    );
  }
  if (pubkeys.length === 0) return relayLists;
  const relayListEvents = /* @__PURE__ */ new Map();
  const contactListEvents = /* @__PURE__ */ new Map();
  return new Promise(async (resolve) => {
    const sub = ndk.subscribe(
      { kinds: [3, 10002], authors: pubkeys },
      {
        closeOnEose: true,
        pool,
        groupable: true,
        cacheUsage: "ONLY_RELAY" /* ONLY_RELAY */,
        subId: "ndk-relay-list-fetch"
      },
      relaySet,
      false
    );
    sub.on("event", (event) => {
      if (event.kind === 10002 /* RelayList */) {
        const existingEvent = relayListEvents.get(event.pubkey);
        if (existingEvent && existingEvent.created_at > event.created_at) return;
        relayListEvents.set(event.pubkey, event);
      } else if (event.kind === 3 /* Contacts */) {
        const existingEvent = contactListEvents.get(event.pubkey);
        if (existingEvent && existingEvent.created_at > event.created_at) return;
        contactListEvents.set(event.pubkey, event);
      }
    });
    sub.on("eose", () => {
      for (const event of relayListEvents.values()) {
        relayLists.set(event.pubkey, NDKRelayList.from(event));
      }
      for (const pubkey of pubkeys) {
        if (relayLists.has(pubkey)) continue;
        const contactList = contactListEvents.get(pubkey);
        if (!contactList) continue;
        const list = relayListFromKind3(ndk, contactList);
        if (list) relayLists.set(pubkey, list);
      }
      resolve(relayLists);
    });
    sub.start();
  });
}

// src/outbox/tracker.ts
var OutboxItem = class {
  /**
   * Type of item
   */
  type;
  /**
   * The relay URLs that are of interest to this item
   */
  relayUrlScores;
  readRelays;
  writeRelays;
  constructor(type) {
    this.type = type;
    this.relayUrlScores = /* @__PURE__ */ new Map();
    this.readRelays = /* @__PURE__ */ new Set();
    this.writeRelays = /* @__PURE__ */ new Set();
  }
};
var OutboxTracker = class extends EventEmitter7 {
  data;
  ndk;
  debug;
  constructor(ndk) {
    super();
    this.ndk = ndk;
    this.debug = ndk.debug.extend("outbox-tracker");
    this.data = new LRUCache2({
      maxSize: 1e5,
      entryExpirationTimeInMS: 2 * 60 * 1e3
    });
  }
  /**
   * Adds a list of users to the tracker.
   * @param items
   * @param skipCache
   */
  async trackUsers(items, skipCache = false) {
    const promises = [];
    for (let i = 0; i < items.length; i += 400) {
      const slice = items.slice(i, i + 400);
      const pubkeys = slice.map((item) => getKeyFromItem(item)).filter((pubkey) => !this.data.has(pubkey));
      if (pubkeys.length === 0) continue;
      for (const pubkey of pubkeys) {
        this.data.set(pubkey, new OutboxItem("user"));
      }
      promises.push(
        new Promise((resolve) => {
          getRelayListForUsers(pubkeys, this.ndk, skipCache).then((relayLists) => {
            for (const [pubkey, relayList] of relayLists) {
              let outboxItem = this.data.get(pubkey);
              outboxItem ??= new OutboxItem("user");
              if (relayList) {
                outboxItem.readRelays = new Set(
                  normalize(relayList.readRelayUrls)
                );
                outboxItem.writeRelays = new Set(
                  normalize(relayList.writeRelayUrls)
                );
                for (const relayUrl of outboxItem.readRelays) {
                  if (this.ndk.pool.blacklistRelayUrls.has(relayUrl)) {
                    outboxItem.readRelays.delete(relayUrl);
                  }
                }
                for (const relayUrl of outboxItem.writeRelays) {
                  if (this.ndk.pool.blacklistRelayUrls.has(relayUrl)) {
                    outboxItem.writeRelays.delete(relayUrl);
                  }
                }
                this.data.set(pubkey, outboxItem);
              }
            }
          }).finally(resolve);
        })
      );
    }
    return Promise.all(promises);
  }
  /**
   *
   * @param key
   * @param score
   */
  track(item, type, skipCache = true) {
    const key = getKeyFromItem(item);
    type ??= getTypeFromItem(item);
    let outboxItem = this.data.get(key);
    if (!outboxItem) {
      outboxItem = new OutboxItem(type);
      if (item instanceof NDKUser) {
        this.trackUsers([item]);
      }
    }
    return outboxItem;
  }
};
function getKeyFromItem(item) {
  if (item instanceof NDKUser) {
    return item.pubkey;
  } else {
    return item;
  }
}
function getTypeFromItem(item) {
  if (item instanceof NDKUser) {
    return "user";
  } else {
    return "kind";
  }
}

// src/relay/sets/utils.ts
function correctRelaySet(relaySet, pool) {
  const connectedRelays = pool.connectedRelays();
  const includesConnectedRelay = Array.from(relaySet.relays).some((relay) => {
    return connectedRelays.map((r) => r.url).includes(relay.url);
  });
  if (!includesConnectedRelay) {
    for (const relay of connectedRelays) {
      relaySet.addRelay(relay);
    }
  }
  if (connectedRelays.length === 0) {
    for (const relay of pool.relays.values()) {
      relaySet.addRelay(relay);
    }
  }
  return relaySet;
}

// src/ndk/fetch-event-from-tag.ts
function isValidHint(hint) {
  if (!hint || hint === "") return false;
  try {
    new URL(hint);
    return true;
  } catch (e) {
    return false;
  }
}
async function fetchEventFromTag(tag, originalEvent, subOpts, fallback = {
  type: "timeout"
}) {
  const d4 = this.debug.extend("fetch-event-from-tag");
  const [_, id, hint] = tag;
  subOpts = {};
  d4("fetching event from tag", tag, subOpts, fallback);
  const authorRelays = getRelaysForSync(this, originalEvent.pubkey);
  if (authorRelays && authorRelays.size > 0) {
    d4("fetching event from author relays %o", Array.from(authorRelays));
    const relaySet2 = NDKRelaySet.fromRelayUrls(Array.from(authorRelays), this);
    const event2 = await this.fetchEvent(id, subOpts, relaySet2);
    if (event2) return event2;
  } else {
    d4("no author relays found for %s", originalEvent.pubkey, originalEvent);
  }
  const relaySet = calculateRelaySetsFromFilters(this, [{ ids: [id] }], this.pool);
  d4("fetching event without relay hint", relaySet);
  const event = await this.fetchEvent(id, subOpts);
  if (event) return event;
  if (hint && hint !== "") {
    const event2 = await this.fetchEvent(
      id,
      subOpts,
      this.pool.getRelay(hint, true, true, [{ ids: [id] }])
    );
    if (event2) return event2;
  }
  let result = void 0;
  const relay = isValidHint(hint) ? this.pool.getRelay(hint, false, true, [{ ids: [id] }]) : void 0;
  const fetchMaybeWithRelayHint = new Promise((resolve) => {
    this.fetchEvent(id, subOpts, relay).then(resolve);
  });
  if (!isValidHint(hint) || fallback.type === "none") {
    return fetchMaybeWithRelayHint;
  }
  const fallbackFetchPromise = new Promise(async (resolve) => {
    const fallbackRelaySet = fallback.relaySet;
    const timeout = fallback.timeout ?? 1500;
    const timeoutPromise = new Promise((resolve2) => setTimeout(resolve2, timeout));
    if (fallback.type === "timeout") await timeoutPromise;
    if (result) {
      resolve(result);
    } else {
      d4("fallback fetch triggered");
      const fallbackEvent = await this.fetchEvent(id, subOpts, fallbackRelaySet);
      resolve(fallbackEvent);
    }
  });
  switch (fallback.type) {
    case "timeout":
      return Promise.race([fetchMaybeWithRelayHint, fallbackFetchPromise]);
    case "eose":
      result = await fetchMaybeWithRelayHint;
      if (result) return result;
      return fallbackFetchPromise;
  }
}

// src/media/index.ts
var SPEC_PATH = "/.well-known/nostr/nip96.json";
var Nip96 = class {
  ndk;
  spec;
  url;
  nip98Required = false;
  /**
   * @param domain domain of the NIP96 service
   */
  constructor(domain, ndk) {
    this.url = `https://${domain}${SPEC_PATH}`;
    this.ndk = ndk;
  }
  async prepareUpload(blob, httpVerb = "POST") {
    this.validateHttpFetch();
    if (!this.spec) await this.fetchSpec();
    if (!this.spec) throw new Error("Failed to fetch NIP96 spec");
    let headers = {};
    if (this.nip98Required) {
      const authorizationHeader = await this.generateNip98Header(
        this.spec.api_url,
        httpVerb,
        blob
      );
      headers = { Authorization: authorizationHeader };
    }
    return {
      url: this.spec.api_url,
      headers
    };
  }
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
  async xhrUpload(xhr, blob) {
    const httpVerb = "POST";
    const { url, headers } = await this.prepareUpload(blob, httpVerb);
    xhr.open(httpVerb, url, true);
    if (headers["Authorization"]) {
      xhr.setRequestHeader("Authorization", headers["Authorization"]);
    }
    const formData = new FormData();
    formData.append("file", blob);
    return new Promise((resolve, reject) => {
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(xhr.statusText));
        }
      };
      xhr.onerror = function() {
        reject(new Error("Network Error"));
      };
      xhr.send(formData);
    });
  }
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
  async upload(blob) {
    const httpVerb = "POST";
    const { url, headers } = await this.prepareUpload(blob, httpVerb);
    const formData = new FormData();
    formData.append("file", blob);
    const res = await this.ndk.httpFetch(this.spec.api_url, {
      method: httpVerb,
      headers,
      body: formData
    });
    if (res.status !== 200) throw new Error(`Failed to upload file to ${url}`);
    const json = await res.json();
    if (json.status !== "success") throw new Error(json.message);
    return json;
  }
  validateHttpFetch() {
    if (!this.ndk) throw new Error("NDK is required to fetch NIP96 spec");
    if (!this.ndk.httpFetch)
      throw new Error("NDK must have an httpFetch method to fetch NIP96 spec");
  }
  async fetchSpec() {
    this.validateHttpFetch();
    const res = await this.ndk.httpFetch(this.url);
    if (res.status !== 200) throw new Error(`Failed to fetch NIP96 spec from ${this.url}`);
    const spec = await res.json();
    if (!spec) throw new Error(`Failed to parse NIP96 spec from ${this.url}`);
    this.spec = spec;
    this.nip98Required = this.spec.plans.free.is_nip98_required;
  }
  async generateNip98Header(requestUrl, httpMethod, blob) {
    const event = new NDKEvent(this.ndk, {
      kind: 27235 /* HttpAuth */,
      tags: [
        ["u", requestUrl],
        ["method", httpMethod]
      ]
    });
    if (["POST", "PUT", "PATCH"].includes(httpMethod)) {
      const sha256Hash = await this.calculateSha256(blob);
      event.tags.push(["payload", sha256Hash]);
    }
    await event.sign();
    const encodedEvent = btoa(JSON.stringify(event.rawEvent()));
    return `Nostr ${encodedEvent}`;
  }
  async calculateSha256(blob) {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex;
  }
};

// src/ndk/queue/index.ts
var Queue = class {
  queue = [];
  maxConcurrency;
  processing = /* @__PURE__ */ new Set();
  promises = /* @__PURE__ */ new Map();
  constructor(name, maxConcurrency) {
    this.maxConcurrency = maxConcurrency;
  }
  add(item) {
    if (this.promises.has(item.id)) {
      return this.promises.get(item.id);
    } else {
    }
    const promise = new Promise((resolve, reject) => {
      this.queue.push({
        ...item,
        func: () => item.func().then(
          (result) => {
            resolve(result);
            return result;
          },
          (error) => {
            reject(error);
            throw error;
          }
        )
      });
      this.process();
    });
    this.promises.set(item.id, promise);
    promise.finally(() => {
      this.promises.delete(item.id);
      this.processing.delete(item.id);
      this.process();
    });
    return promise;
  }
  process() {
    if (this.processing.size >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }
    const item = this.queue.shift();
    if (!item || this.processing.has(item.id)) {
      return;
    }
    this.processing.add(item.id);
    item.func();
  }
  clear() {
    this.queue = [];
  }
  clearProcessing() {
    this.processing.clear();
  }
  clearAll() {
    this.clear();
    this.clearProcessing();
  }
  length() {
    return this.queue.length;
  }
};

// src/subscription/manager.ts
import { matchFilters } from "nostr-tools";
var NDKSubscriptionManager = class {
  subscriptions;
  seenEvents = /* @__PURE__ */ new Map();
  debug;
  constructor(debug8) {
    this.subscriptions = /* @__PURE__ */ new Map();
    this.debug = debug8.extend("sub-manager");
  }
  add(sub) {
    this.subscriptions.set(sub.internalId, sub);
    if (sub.onStopped) {
      console.log("SUB-MANAGER BUG: Subscription already had onStopped! \u{1F914}", sub.internalId);
    }
    sub.onStopped = () => {
      this.subscriptions.delete(sub.internalId);
    };
    sub.on("close", () => {
      this.subscriptions.delete(sub.internalId);
    });
  }
  seenEvent(eventId, relay) {
    const current = this.seenEvents.get(eventId) || [];
    current.push(relay);
    this.seenEvents.set(eventId, current);
  }
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
  filterMatchingTime = 0;
  filterMatchingCount = 0;
  dispatchEvent(event, relay, optimisticPublish = false) {
    if (relay) this.seenEvent(event.id, relay);
    const subscriptions = this.subscriptions.values();
    const matchingSubs = [];
    const start = Date.now();
    for (const sub of subscriptions) {
      if (matchFilters(sub.filters, event)) {
        matchingSubs.push(sub);
      }
    }
    this.filterMatchingTime += Date.now() - start;
    this.filterMatchingCount += matchingSubs.length;
    for (const sub of matchingSubs) {
      sub.eventReceived(event, void 0, false, optimisticPublish);
    }
  }
};

// src/ndk/active-user.ts
import createDebug4 from "debug";
var debug6 = createDebug4("ndk:active-user");
async function getUserRelayList(user) {
  if (!this.autoConnectUserRelays) return;
  const userRelays = await getRelayListForUser(user.pubkey, this);
  if (!userRelays) return;
  for (const url of userRelays.relays) {
    let relay = this.pool.relays.get(url);
    if (!relay) {
      relay = new NDKRelay(url, this.relayAuthDefaultPolicy, this);
      this.pool.addRelay(relay);
    }
  }
  return userRelays;
}
async function setActiveUser(user) {
  const pool = this.outboxPool || this.pool;
  if (pool.connectedRelays.length > 0) {
    setActiveUserConnected.call(this, user);
  } else {
    pool.once("connect", () => {
      setActiveUserConnected.call(this, user);
    });
  }
}
async function setActiveUserConnected(user) {
  const userRelays = await getUserRelayList.call(this, user);
  const filters = [
    {
      kinds: [10006 /* BlockRelayList */],
      authors: [user.pubkey]
    }
  ];
  if (this.autoFetchUserMutelist) {
    filters[0].kinds.push(1e4 /* MuteList */);
  }
  const relaySet = userRelays ? userRelays.relaySet : void 0;
  const sub = this.subscribe(
    filters,
    { subId: "active-user-settings", closeOnEose: true },
    relaySet,
    false
  );
  const events = /* @__PURE__ */ new Map();
  sub.on("event", (event) => {
    const prevEvent = events.get(event.kind);
    if (prevEvent && prevEvent.created_at >= event.created_at) return;
    events.set(event.kind, event);
  });
  sub.on("eose", () => {
    for (const event of events.values()) {
      processEvent.call(this, event);
    }
  });
  sub.start();
}
async function processEvent(event) {
  if (event.kind === 10006 /* BlockRelayList */) {
    processBlockRelayList.call(this, event);
  } else if (event.kind === 1e4 /* MuteList */) {
    processMuteList.call(this, event);
  }
}
function processBlockRelayList(event) {
  const list = lists_default.from(event);
  for (const item of list.items) {
    this.pool.blacklistRelayUrls.add(item[0]);
  }
  debug6("Added %d relays to relay blacklist", list.items.length);
}
function processMuteList(muteList) {
  const list = lists_default.from(muteList);
  for (const item of list.items) {
    this.mutedIds.set(item[1], item[0]);
  }
  debug6("Added %d users to mute list", list.items.length);
}

// src/ndk/index.ts
var DEFAULT_OUTBOX_RELAYS = ["wss://purplepag.es/", "wss://nos.lol/"];
var DEFAULT_BLACKLISTED_RELAYS = [
  "wss://brb.io/",
  // BRB
  "wss://nostr.mutinywallet.com/"
  // Don't try to read from this relay since it's a write-only relay
  // "wss://purplepag.es/", // This is a hack, since this is a mostly read-only relay, but not fully. Once we have relay routing this can be removed so it only receives the supported kinds
];
var NDK = class extends EventEmitter8 {
  _explicitRelayUrls;
  pool;
  outboxPool;
  _signer;
  _activeUser;
  cacheAdapter;
  debug;
  devWriteRelaySet;
  outboxTracker;
  mutedIds;
  clientName;
  clientNip89;
  queuesZapConfig;
  queuesNip05;
  asyncSigVerification = false;
  initialValidationRatio = 1;
  lowestValidationRatio = 1;
  validationRatioFn;
  subManager;
  publishingFailureHandled = false;
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
  relayAuthDefaultPolicy;
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
  httpFetch;
  /**
   * Provide a caller function to receive all networking traffic from relays
   */
  netDebug;
  autoConnectUserRelays = true;
  autoFetchUserMutelist = true;
  walletConfig;
  constructor(opts = {}) {
    super();
    this.debug = opts.debug || debug7("ndk");
    this.netDebug = opts.netDebug;
    this._explicitRelayUrls = opts.explicitRelayUrls || [];
    this.subManager = new NDKSubscriptionManager(this.debug);
    this.pool = new NDKPool(
      opts.explicitRelayUrls || [],
      opts.blacklistRelayUrls || DEFAULT_BLACKLISTED_RELAYS,
      this
    );
    this.pool.name = "main";
    this.pool.on("relay:auth", async (relay, challenge) => {
      if (this.relayAuthDefaultPolicy) {
        await this.relayAuthDefaultPolicy(relay, challenge);
      }
    });
    this.autoConnectUserRelays = opts.autoConnectUserRelays ?? true;
    this.autoFetchUserMutelist = opts.autoFetchUserMutelist ?? true;
    this.clientName = opts.clientName;
    this.clientNip89 = opts.clientNip89;
    this.relayAuthDefaultPolicy = opts.relayAuthDefaultPolicy;
    if (opts.enableOutboxModel) {
      this.outboxPool = new NDKPool(
        opts.outboxRelayUrls || DEFAULT_OUTBOX_RELAYS,
        opts.blacklistRelayUrls || DEFAULT_BLACKLISTED_RELAYS,
        this,
        this.debug.extend("outbox-pool")
      );
      this.outboxPool.name = "outbox";
      this.outboxTracker = new OutboxTracker(this);
    }
    this.signer = opts.signer;
    this.cacheAdapter = opts.cacheAdapter;
    this.mutedIds = opts.mutedIds || /* @__PURE__ */ new Map();
    if (opts.devWriteRelayUrls) {
      this.devWriteRelaySet = NDKRelaySet.fromRelayUrls(opts.devWriteRelayUrls, this);
    }
    this.queuesZapConfig = new Queue("zaps", 3);
    this.queuesNip05 = new Queue("nip05", 10);
    this.signatureVerificationWorker = opts.signatureVerificationWorker;
    this.initialValidationRatio = opts.initialValidationRatio || 1;
    this.lowestValidationRatio = opts.lowestValidationRatio || 1;
    try {
      this.httpFetch = fetch;
    } catch {
    }
  }
  set explicitRelayUrls(urls) {
    this._explicitRelayUrls = urls;
    this.pool.relayUrls = urls;
  }
  get explicitRelayUrls() {
    return this._explicitRelayUrls || [];
  }
  set signatureVerificationWorker(worker2) {
    this.asyncSigVerification = !!worker2;
    if (worker2) {
      signatureVerificationInit(worker2);
    }
  }
  /**
   * Adds an explicit relay to the pool.
   * @param url
   * @param relayAuthPolicy Authentication policy to use if different from the default
   * @param connect Whether to connect to the relay automatically
   * @returns
   */
  addExplicitRelay(urlOrRelay, relayAuthPolicy, connect = true) {
    let relay;
    if (typeof urlOrRelay === "string") {
      relay = new NDKRelay(urlOrRelay, relayAuthPolicy, this);
    } else {
      relay = urlOrRelay;
    }
    this.pool.addRelay(relay, connect);
    this.explicitRelayUrls.push(relay.url);
    return relay;
  }
  toJSON() {
    return { relayCount: this.pool.relays.size }.toString();
  }
  get activeUser() {
    return this._activeUser;
  }
  /**
   * Sets the active user for this NDK instance, typically this will be
   * called when assigning a signer to the NDK instance.
   *
   * This function will automatically connect to the user's relays if
   * `autoConnectUserRelays` is set to true.
   *
   * It will also fetch the user's mutelist if `autoFetchUserMutelist` is set to true.
   */
  set activeUser(user) {
    const differentUser = this._activeUser?.pubkey !== user?.pubkey;
    this._activeUser = user;
    if (user && differentUser) {
      setActiveUser.call(this, user);
    } else if (!user) {
      this.mutedIds = /* @__PURE__ */ new Map();
    }
  }
  get signer() {
    return this._signer;
  }
  set signer(newSigner) {
    this._signer = newSigner;
    if (newSigner) this.emit("signer:ready", newSigner);
    newSigner?.user().then((user) => {
      user.ndk = this;
      this.activeUser = user;
    });
  }
  /**
   * Connect to relays with optional timeout.
   * If the timeout is reached, the connection will be continued to be established in the background.
   */
  async connect(timeoutMs) {
    if (this._signer && this.autoConnectUserRelays) {
      this.debug(
        "Attempting to connect to user relays specified by signer %o",
        await this._signer.relays?.(this)
      );
      if (this._signer.relays) {
        const relays = await this._signer.relays(this);
        relays.forEach((relay) => this.pool.addRelay(relay));
      }
    }
    const connections = [this.pool.connect(timeoutMs)];
    if (this.outboxPool) {
      connections.push(this.outboxPool.connect(timeoutMs));
    }
    this.debug("Connecting to relays %o", { timeoutMs });
    return Promise.allSettled(connections).then(() => {
    });
  }
  /**
   * Get a NDKUser object
   *
   * @param opts
   * @returns
   */
  getUser(opts) {
    const user = new NDKUser(opts);
    user.ndk = this;
    return user;
  }
  /**
   * Get a NDKUser from a NIP05
   * @param nip05 NIP-05 ID
   * @param skipCache Skip cache
   * @returns
   */
  async getUserFromNip05(nip05, skipCache = false) {
    return NDKUser.fromNip05(nip05, this, skipCache);
  }
  /**
   * Create a new subscription. Subscriptions automatically start, you can make them automatically close when all relays send back an EOSE by setting `opts.closeOnEose` to `true`)
   *
   * @param filters
   * @param opts
   * @param relaySet explicit relay set to use
   * @param autoStart automatically start the subscription
   * @returns NDKSubscription
   */
  subscribe(filters, opts, relaySet, autoStart = true) {
    const subscription = new NDKSubscription(this, filters, opts, relaySet);
    this.subManager.add(subscription);
    const pool = opts?.pool ?? this.pool;
    if (relaySet) {
      for (const relay of relaySet.relays) {
        pool.useTemporaryRelay(relay, void 0, subscription.filters);
      }
    }
    if (this.outboxPool && subscription.hasAuthorsFilter()) {
      const authors = subscription.filters.filter((filter) => filter.authors && filter.authors?.length > 0).map((filter) => filter.authors).flat();
      this.outboxTracker?.trackUsers(authors);
    }
    if (autoStart) {
      setTimeout(() => subscription.start(), 0);
    }
    return subscription;
  }
  /**
   * Publish an event to a relay
   * @param event event to publish
   * @param relaySet explicit relay set to use
   * @param timeoutMs timeout in milliseconds to wait for the event to be published
   * @returns The relays the event was published to
   *
   * @deprecated Use `event.publish()` instead
   */
  async publish(event, relaySet, timeoutMs) {
    this.debug("Deprecated: Use `event.publish()` instead");
    return event.publish(relaySet, timeoutMs);
  }
  /**
   * Attempts to fetch an event from a tag, following relay hints and
   * other best practices.
   * @param tag Tag to fetch the event from
   * @param originalEvent Event where the tag came from
   * @param subOpts Subscription options to use when fetching the event
   * @param fallback Fallback options to use when the hint relay doesn't respond
   * @returns
   */
  fetchEventFromTag = fetchEventFromTag.bind(this);
  /**
   * Fetch a single event.
   *
   * @param idOrFilter event id in bech32 format or filter
   * @param opts subscription options
   * @param relaySetOrRelay explicit relay set to use
   */
  async fetchEvent(idOrFilter, opts, relaySetOrRelay) {
    let filters;
    let relaySet;
    if (relaySetOrRelay instanceof NDKRelay) {
      relaySet = new NDKRelaySet(/* @__PURE__ */ new Set([relaySetOrRelay]), this);
    } else if (relaySetOrRelay instanceof NDKRelaySet) {
      relaySet = relaySetOrRelay;
    }
    if (!relaySetOrRelay && typeof idOrFilter === "string") {
      if (!isNip33AValue(idOrFilter)) {
        const relays = relaysFromBech32(idOrFilter, this);
        if (relays.length > 0) {
          relaySet = new NDKRelaySet(new Set(relays), this);
          relaySet = correctRelaySet(relaySet, this.pool);
        }
      }
    }
    if (typeof idOrFilter === "string") {
      filters = [filterFromId(idOrFilter)];
    } else if (Array.isArray(idOrFilter)) {
      filters = idOrFilter;
    } else {
      filters = [idOrFilter];
    }
    if (filters.length === 0) {
      throw new Error(`Invalid filter: ${JSON.stringify(idOrFilter)}`);
    }
    return new Promise((resolve) => {
      let fetchedEvent = null;
      const s = this.subscribe(
        filters,
        { ...opts || {}, closeOnEose: true },
        relaySet,
        false
      );
      const t2 = setTimeout(() => {
        s.stop();
        resolve(fetchedEvent);
      }, 1e4);
      s.on("event", (event) => {
        event.ndk = this;
        if (!event.isReplaceable()) {
          clearTimeout(t2);
          resolve(event);
        } else if (!fetchedEvent || fetchedEvent.created_at < event.created_at) {
          fetchedEvent = event;
        }
      });
      s.on("eose", () => {
        clearTimeout(t2);
        resolve(fetchedEvent);
      });
      s.start();
    });
  }
  /**
   * Fetch events
   */
  async fetchEvents(filters, opts, relaySet) {
    return new Promise((resolve) => {
      const events = /* @__PURE__ */ new Map();
      const relaySetSubscription = this.subscribe(
        filters,
        { ...opts || {}, closeOnEose: true },
        relaySet,
        false
      );
      const onEvent = (event) => {
        if (!(event instanceof NDKEvent)) event = new NDKEvent(void 0, event);
        const dedupKey = event.deduplicationKey();
        const existingEvent = events.get(dedupKey);
        if (existingEvent) {
          event = dedup(existingEvent, event);
        }
        event.ndk = this;
        events.set(dedupKey, event);
      };
      relaySetSubscription.on("event", onEvent);
      relaySetSubscription.on("eose", () => {
        resolve(new Set(events.values()));
      });
      relaySetSubscription.start();
    });
  }
  /**
   * Ensures that a signer is available to sign an event.
   */
  assertSigner() {
    if (!this.signer) {
      this.emit("signer:required");
      throw new Error("Signer required");
    }
  }
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
  getNip96(domain) {
    return new Nip96(domain, this);
  }
  set wallet(wallet) {
    console.log("setting wallet", {
      lnPay: wallet?.lnPay,
      cashuPay: wallet?.cashuPay
    });
    if (!wallet) {
      this.walletConfig = void 0;
      return;
    }
    this.walletConfig ??= {};
    this.walletConfig.lnPay = wallet?.lnPay?.bind(wallet);
    this.walletConfig.cashuPay = wallet?.cashuPay?.bind(wallet);
  }
};

// src/zap/invoice.ts
import { decode } from "light-bolt11-decoder";
function zapInvoiceFromEvent(event) {
  const description = event.getMatchingTags("description")[0];
  const bolt11 = event.getMatchingTags("bolt11")[0];
  let decodedInvoice;
  let zapRequest;
  if (!description || !bolt11 || !bolt11[1]) {
    return null;
  }
  try {
    let zapRequestPayload = description[1];
    if (zapRequestPayload.startsWith("%")) {
      zapRequestPayload = decodeURIComponent(zapRequestPayload);
    }
    if (zapRequestPayload === "") {
      return null;
    }
    zapRequest = JSON.parse(zapRequestPayload);
    decodedInvoice = decode(bolt11[1]);
  } catch (e) {
    return null;
  }
  const amountSection = decodedInvoice.sections.find((s) => s.name === "amount");
  if (!amountSection) {
    return null;
  }
  const amount = parseInt(amountSection.value);
  if (!amount) {
    return null;
  }
  const content = zapRequest.content;
  const sender = zapRequest.pubkey;
  const recipientTag = event.getMatchingTags("p")[0];
  const recipient = recipientTag[1];
  let zappedEvent = event.getMatchingTags("e")[0];
  if (!zappedEvent) {
    zappedEvent = event.getMatchingTags("a")[0];
  }
  const zappedEventId = zappedEvent ? zappedEvent[1] : void 0;
  const zapInvoice = {
    id: event.id,
    zapper: event.pubkey,
    zappee: sender,
    zapped: recipient,
    zappedEvent: zappedEventId,
    amount,
    comment: content
  };
  return zapInvoice;
}

// src/zapper/index.ts
import createDebug5 from "debug";
import { EventEmitter as EventEmitter9 } from "tseep";

// src/zapper/nip57.ts
import { nip57 } from "nostr-tools";
async function generateZapRequest(target, ndk, data, pubkey, amount, relays, comment, tags, signer) {
  const zapEndpoint = data.callback;
  const zapRequest = nip57.makeZapRequest({
    profile: pubkey,
    // set the event to null since nostr-tools doesn't support nip-33 zaps
    event: null,
    amount,
    comment: comment || "",
    relays: relays.slice(0, 4)
  });
  if (target instanceof NDKEvent) {
    const tags2 = target.referenceTags();
    const nonPTags = tags2.filter((tag) => tag[0] !== "p");
    zapRequest.tags.push(...nonPTags);
  }
  zapRequest.tags.push(["lnurl", zapEndpoint]);
  const event = new NDKEvent(ndk, zapRequest);
  if (tags) {
    event.tags = event.tags.concat(tags);
  }
  if (event.hasTag("a")) {
    event.tags = event.tags.filter((tag) => tag[0] !== "e");
  }
  event.tags = event.tags.filter((tag) => tag[0] !== "p");
  event.tags.push(["p", pubkey]);
  await event.sign(signer);
  return event;
}

// src/zapper/index.ts
var d3 = createDebug5("ndk:zapper");
var NDKZapper = class extends EventEmitter9 {
  target;
  ndk;
  comment;
  amount;
  unit;
  tags;
  signer;
  zapMethod;
  lnPay;
  /**
   * Called when a cashu payment is to be made.
   * This function should swap/mint proofs for the required amount, in the required unit,
   * in any of the provided mints and return the proofs and mint used.
   */
  cashuPay;
  onComplete;
  maxRelays = 3;
  /**
   * 
   * @param target The target of the zap
   * @param amount The amount to send indicated in the unit
   * @param unit The unit of the amount
   * @param opts Options for the zap
   */
  constructor(target, amount, unit = "msat", opts = {}) {
    super();
    this.target = target;
    this.ndk = opts.ndk || target.ndk;
    if (!this.ndk) {
      throw new Error("No NDK instance provided");
    }
    this.amount = amount;
    this.comment = opts.comment;
    this.unit = unit;
    this.tags = opts.tags;
    this.signer = opts.signer;
    this.lnPay = opts.lnPay || this.ndk.walletConfig?.lnPay;
    this.cashuPay = opts.cashuPay || this.ndk.walletConfig?.cashuPay;
    this.onComplete = opts.onComplete || this.ndk.walletConfig?.onPaymentComplete;
  }
  /**
   * Initiate zapping process
   * 
   * This function will calculate the splits for this zap and initiate each zap split.
   */
  async zap() {
    const splits = this.getZapSplits();
    const results = /* @__PURE__ */ new Map();
    await Promise.all(
      splits.map(async (split) => {
        let result;
        try {
          result = await this.zapSplit(split);
        } catch (e) {
          result = e;
        }
        this.emit("split:complete", split, result);
        results.set(split, result);
      })
    );
    this.emit("complete", results);
    if (this.onComplete) this.onComplete(results);
    return results;
  }
  async zapNip57(split, data) {
    if (!this.lnPay) throw new Error("No lnPay function available");
    const relays = await this.relays(split.pubkey);
    const zapRequest = await generateZapRequest(
      this.target,
      this.ndk,
      data,
      split.pubkey,
      split.amount,
      relays,
      this.comment,
      this.tags,
      this.signer
    );
    if (!zapRequest) {
      d3("Unable to generate zap request");
      throw new Error("Unable to generate zap request");
    }
    const pr = await this.getLnInvoice(zapRequest, split.amount, data);
    if (!pr) {
      d3("Unable to get payment request");
      throw new Error("Unable to get payment request");
    }
    return await this.lnPay(
      {
        target: this.target,
        recipientPubkey: split.pubkey,
        paymentDescription: "NIP-57 Zap",
        pr,
        amount: split.amount,
        unit: this.unit
      }
    );
  }
  /**
   * Fetches information about a NIP-61 zap and asks the caller to create cashu proofs for the zap.
   * 
   * (note that the cashuPay function can use any method to create the proofs, including using lightning
   * to mint proofs in the specified mint, the responsibility of minting the proofs is delegated to the caller (e.g. ndk-wallet))
   */
  async zapNip61(split, data) {
    if (!this.cashuPay) throw new Error("No cashuPay function available");
    let ret;
    ret = await this.cashuPay({
      target: this.target,
      recipientPubkey: split.pubkey,
      paymentDescription: "NIP-61 Zap",
      amount: split.amount,
      unit: this.unit,
      ...data
    });
    d3("NIP-61 Zap result: %o", ret);
    if (ret instanceof Error) {
      return ret;
    } else if (ret) {
      const { proofs, mint } = ret;
      if (!proofs || !mint)
        throw new Error(
          "Invalid zap confirmation: missing proofs or mint: " + ret
        );
      const relays = await this.relays(split.pubkey);
      const relaySet = NDKRelaySet.fromRelayUrls(relays, this.ndk);
      const nutzap = new NDKNutzap(this.ndk);
      nutzap.tags = [...nutzap.tags, ...this.tags || []];
      nutzap.proofs = proofs;
      nutzap.mint = mint;
      nutzap.target = this.target;
      nutzap.comment = this.comment;
      nutzap.unit = this.unit;
      nutzap.recipientPubkey = split.pubkey;
      await nutzap.sign(this.signer);
      nutzap.publish(relaySet);
      return nutzap;
    }
  }
  /**
   * Get the zap methods available for the recipient and initiates the zap
   * in the desired method.
   * @param split 
   * @returns 
   */
  async zapSplit(split) {
    const zapped = false;
    let zapMethods = await this.getZapMethods(this.ndk, split.pubkey);
    let retVal;
    if (zapMethods.length === 0) throw new Error("No zap method available for recipient");
    zapMethods = zapMethods.sort((a, b) => {
      if (a.type === "nip61") return -1;
      if (b.type === "nip61") return 1;
      return 0;
    });
    for (const zapMethod of zapMethods) {
      if (zapped) break;
      d3(
        "Zapping to %s with %d %s using %s",
        split.pubkey,
        split.amount,
        this.unit,
        zapMethod.type
      );
      try {
        if (zapMethod.type === "nip61") {
          retVal = await this.zapNip61(split, zapMethod.data);
        } else if (zapMethod.type === "nip57") {
          retVal = await this.zapNip57(split, zapMethod.data);
        }
        if (!(retVal instanceof Error)) {
          break;
        }
      } catch (e) {
        if (e instanceof Error) retVal = e;
        else retVal = new Error(e);
        d3(
          "Error zapping to %s with %d %s using %s: %o",
          split.pubkey,
          split.amount,
          this.unit,
          zapMethod.type,
          e
        );
      }
    }
    if (retVal instanceof Error) throw retVal;
    return retVal;
  }
  /**
   * Gets a bolt11 for a nip57 zap
   * @param event
   * @param amount
   * @param zapEndpoint
   * @returns
   */
  async getLnInvoice(zapRequest, amount, data) {
    const zapEndpoint = data.callback;
    const eventPayload = JSON.stringify(zapRequest.rawEvent());
    d3(
      `Fetching invoice from ${zapEndpoint}?` + new URLSearchParams({
        amount: amount.toString(),
        nostr: eventPayload
      })
    );
    const url = new URL(zapEndpoint);
    url.searchParams.append("amount", amount.toString());
    url.searchParams.append("nostr", eventPayload);
    d3(`Fetching invoice from ${url.toString()}`);
    const response = await fetch(url.toString());
    d3(`Got response from zap endpoint: ${zapEndpoint}`, { status: response.status });
    if (response.status !== 200) {
      d3(`Received non-200 status from zap endpoint: ${zapEndpoint}`, {
        status: response.status,
        amount,
        nostr: eventPayload
      });
      const text = await response.text();
      throw new Error(`Unable to fetch zap endpoint ${zapEndpoint}: ${text}`);
    }
    const body = await response.json();
    return body.pr;
  }
  getZapSplits() {
    if (this.target instanceof NDKUser) {
      return [
        {
          pubkey: this.target.pubkey,
          amount: this.amount
        }
      ];
    }
    const zapTags = this.target.getMatchingTags("zap");
    if (zapTags.length === 0) {
      return [
        {
          pubkey: this.target.pubkey,
          amount: this.amount
        }
      ];
    }
    const splits = [];
    const total = zapTags.reduce((acc, tag) => acc + parseInt(tag[2]), 0);
    for (const tag of zapTags) {
      const pubkey = tag[1];
      const amount = Math.floor(parseInt(tag[2]) / total * this.amount);
      splits.push({ pubkey, amount });
    }
    return splits;
  }
  /**
   * Gets the zap method that should be used to zap a pubbkey
   * @param ndk
   * @param pubkey
   * @returns
   */
  async getZapMethods(ndk, recipient) {
    const methods = [];
    if (this.cashuPay) methods.push("nip61");
    if (this.lnPay) methods.push("nip57");
    if (methods.length === 0) throw new Error("There are no payment methods available! Please set at least one of lnPay or cashuPay");
    const user = ndk.getUser({ pubkey: recipient });
    const zapInfo = await user.getZapInfo(false, methods);
    d3("Zap info for %s: %o", user.npub, zapInfo);
    return zapInfo;
  }
  /**
   * @returns the relays to use for the zap request
   */
  async relays(pubkey) {
    let r = [];
    if (this.ndk?.activeUser) {
      const relayLists = await getRelayListForUsers(
        [this.ndk.activeUser.pubkey, pubkey],
        this.ndk
      );
      const relayScores = /* @__PURE__ */ new Map();
      for (const relayList of relayLists.values()) {
        for (const url of relayList.readRelayUrls) {
          const score = relayScores.get(url) || 0;
          relayScores.set(url, score + 1);
        }
      }
      r = Array.from(relayScores.entries()).sort((a, b) => b[1] - a[1]).map(([url]) => url).slice(0, this.maxRelays);
    }
    if (this.ndk?.pool?.permanentAndConnectedRelays().length) {
      r = this.ndk.pool.permanentAndConnectedRelays().map((relay) => relay.url);
    }
    if (!r.length) {
      r = [];
    }
    return r;
  }
};
export {
  BECH32_REGEX,
  DEFAULT_ENCRYPTION_SCHEME,
  NDKAppHandlerEvent,
  NDKAppSettings,
  NDKArticle,
  NDKCashuMintList,
  NDKClassified,
  NDKDVMJobFeedback,
  NDKDVMJobResult,
  NDKDVMRequest,
  NDKDraft,
  NDKDvmJobFeedbackStatus,
  NDKEvent,
  NDKHighlight,
  NDKImage,
  NDKKind,
  NDKList,
  NDKListKinds,
  NDKNip07Signer,
  NDKNip46Backend,
  NDKNip46Signer,
  NDKNostrRpc,
  NDKNutzap,
  NDKPool,
  NDKPrivateKeySigner,
  NDKPublishError,
  NDKRelay,
  NDKRelayAuthPolicies,
  NDKRelayList,
  NDKRelaySet,
  NDKRelayStatus,
  NDKRepost,
  NDKSimpleGroup,
  NDKSimpleGroupMemberList,
  NDKSimpleGroupMetadata,
  NDKSubscription,
  NDKSubscriptionCacheUsage,
  NDKSubscriptionReceipt,
  NDKSubscriptionStart,
  NDKSubscriptionTier,
  NDKTranscriptionDVM,
  NDKUser,
  NDKVideo,
  NDKWiki,
  NDKZapper,
  NIP33_A_REGEX,
  calculateRelaySetFromEvent,
  calculateTermDurationInSeconds,
  compareFilter,
  NDK as default,
  defaultOpts,
  deserialize,
  dvmSchedule,
  eventHasETagMarkers,
  eventIsPartOfThread,
  eventIsReply,
  eventReplies,
  eventThreadIds,
  eventThreads,
  eventWrappingMap,
  eventsBySameAuthor,
  filterAndRelaySetFromBech32,
  filterFingerprint,
  filterForEventsTaggingId,
  filterFromId,
  generateSubId,
  generateZapRequest,
  getEventReplyIds,
  getNip57ZapSpecFromLud,
  getRelayListForUser,
  getRelayListForUsers,
  getReplyTag,
  getRootEventId,
  getRootTag,
  imetaTagToTag,
  isEventOriginalPost,
  isNip33AValue,
  mapImetaTag,
  mergeFilters,
  newAmount,
  normalize,
  normalizeRelayUrl,
  normalizeUrl,
  parseTagToSubscriptionAmount,
  pinEvent,
  possibleIntervalFrequencies,
  profileFromEvent,
  queryFullyFilled,
  relayListFromKind3,
  relaysFromBech32,
  serialize,
  serializeProfile,
  tryNormalizeRelayUrl,
  wrapEvent,
  zapInvoiceFromEvent
};

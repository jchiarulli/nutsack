"use strict";

import { NDKEvent, deserialize, NDKKind } from '@nostr-dev-kit/ndk';
import { LRUCache } from 'typescript-lru-cache';
import * as SQLite from 'expo-sqlite';
import { matchFilter } from 'nostr-tools';
import { migrations } from "./migrations.js";
export class NDKCacheAdapterSqlite {
  locking = false;
  ready = false;
  pendingCallbacks = [];
  constructor(dbName, maxProfiles = 200) {
    this.dbName = dbName ?? 'ndk-cache';
    this.profileCache = new LRUCache({
      maxSize: maxProfiles
    });
    this.initialize();
  }
  async initialize() {
    this.db = await SQLite.openDatabaseAsync(this.dbName);

    // get current schema version
    let {
      user_version: schemaVersion
    } = await this.db.getFirstSync(`PRAGMA user_version;`);
    if (!schemaVersion) {
      schemaVersion = 0;

      // set the schema version
      await this.db.execAsync(`PRAGMA user_version = ${schemaVersion};`);
    }
    if (!schemaVersion || Number(schemaVersion) < migrations.length) {
      await this.db.withTransactionAsync(async () => {
        for (let i = Number(schemaVersion); i < migrations.length; i++) {
          try {
            await migrations[i].up(this.db);
          } catch (e) {
            console.error('error running migration', e);
            throw e;
          }
          await this.db.execAsync(`PRAGMA user_version = ${i + 1};`);
        }

        // set the schema version
        await this.db.execAsync(`PRAGMA user_version = ${migrations.length};`);
      });
    }
    this.ready = true;
    this.locking = true;
    Promise.all(this.pendingCallbacks.map(f => f()));
  }
  onReady(callback) {
    if (this.ready) {
      callback();
    } else {
      this.pendingCallbacks.unshift(callback);
    }
  }
  async query(subscription) {
    // Ensure the adapter is ready
    if (!this.ready) return;

    // Process filters from the subscription
    for (const filter of subscription.filters) {
      // Example: Fetch events by pubkey
      if (filter.authors) {
        const events = this.db.getAllSync(`SELECT * FROM events WHERE pubkey IN (${filter.authors.map(() => '?').join(',')})`, filter.authors);
        if (events.length > 0) foundEvents(subscription, events, filter);
      }

      // Example: Fetch events by kind
      if (filter.kinds) {
        const events = this.db.getAllSync(`SELECT * FROM events WHERE kind IN (${filter.kinds.map(() => '?').join(',')})`, filter.kinds);
        if (events.length > 0) foundEvents(subscription, events, filter);
      }
    }
  }
  async setEvent(event, filters, relay) {
    const filterTags = event.tags.filter(tag => tag[0].length === 1).map(tag => [tag[0], tag[1]]);
    await Promise.all([this.db.runAsync(`INSERT OR REPLACE INTO events (id, created_at, pubkey, event, kind, relay) VALUES (?, ?, ?, ?, ?, ?);`, [event.id, event.created_at, event.pubkey, event.serialize(true, true), event.kind, relay?.url || '']), filterTags.map(tag =>
    // Use INSERT OR REPLACE to avoid UNIQUE constraint violation
    this.db.runAsync(`INSERT OR REPLACE INTO event_tags (event_id, tag, value) VALUES (?, ?, ?);`, [event.id, tag[0], tag[1]]))]);

    // if this event is a delete event, see if the deleted events are in the cache and remove them
    if (event.kind === NDKKind.EventDeletion) {
      this.deleteEventIds(event.tags.filter(tag => tag[0] === 'e').map(tag => tag[1]));
    }
  }
  async deleteEventIds(eventIds) {
    await this.db.runAsync(`DELETE FROM events WHERE id IN (${eventIds.map(() => '?').join(',')});`, eventIds);
    await this.db.runAsync(`DELETE FROM event_tags WHERE event_id IN (${eventIds.map(() => '?').join(',')});`, eventIds);
  }
  fetchProfileSync(pubkey) {
    if (!this.ready) return null;
    const cached = this.profileCache.get(pubkey);
    if (cached) return cached;
    const result = this.db.getFirstSync(`SELECT profile, catched_at FROM profiles WHERE pubkey = ?;`, [pubkey]);
    if (result) {
      try {
        const profile = JSON.parse(result.profile);
        const entry = {
          ...profile,
          fetchedAt: result.catched_at
        };
        this.profileCache.set(pubkey, entry);
        return entry;
      } catch (e) {
        console.error('failed to parse profile', result.profile);
      }
    }
  }
  async fetchProfile(pubkey) {
    if (!this.ready) return;
    const cached = this.profileCache.get(pubkey);
    if (cached) return cached;
    const result = this.db.getFirstSync(`SELECT profile, catched_at FROM profiles WHERE pubkey = ?;`, [pubkey]);
    if (result) {
      try {
        const profile = JSON.parse(result.profile);
        const entry = {
          ...profile,
          fetchedAt: result.catched_at
        };
        this.profileCache.set(pubkey, entry);
        return entry;
      } catch (e) {
        console.error('failed to parse profile', result.profile);
      }
    }
    return null;
  }
  async saveProfile(pubkey, profile) {
    // check if the profile we have is newer based on created_at
    const existingProfile = await this.fetchProfile(pubkey);
    if (existingProfile?.created_at && profile.created_at && existingProfile.created_at >= profile.created_at) return;
    const now = Date.now();
    const entry = {
      ...profile,
      fetchedAt: now
    };
    this.profileCache.set(pubkey, entry);
    this.db.runAsync(`INSERT OR REPLACE INTO profiles (pubkey, profile, catched_at, created_at) VALUES (?, ?, ?, ?);`, [pubkey, JSON.stringify(profile), now, profile.created_at]);
  }
  addUnpublishedEvent(event, relayUrls) {
    const relayStatus = {};
    relayUrls.forEach(url => relayStatus[url] = false);
    try {
      this.db.runSync(`INSERT OR REPLACE INTO unpublished_events (id, event, relays, last_try_at) VALUES (?, ?, ?, ?);`, [event.id, event.serialize(true, true), JSON.stringify(relayStatus), Date.now()]);
      const onPublished = relay => {
        const url = relay.url;
        const record = this.db.getFirstSync(`SELECT relays FROM unpublished_events WHERE id = ?`, [event.id]);
        if (!record) {
          event.off('published', onPublished);
          return;
        }
        const relays = JSON.parse(record.relays);
        relays[url] = true;
        const successWrites = Object.values(relays).filter(v => v).length;
        const unsuccessWrites = Object.values(relays).length - successWrites;
        if (successWrites >= 3 || unsuccessWrites === 0) {
          this.discardUnpublishedEvent(event.id);
          event.off('published', onPublished);
        } else {
          this.db.runSync(`UPDATE unpublished_events SET relays = ? WHERE id = ?`, [JSON.stringify(relays), event.id]);
        }
      };
      event.once('published', onPublished);
    } catch (e) {
      console.error('error adding unpublished event', e);
    }
  }
  async getUnpublishedEvents() {
    const call = () => this._getUnpublishedEvents();
    if (!this.ready) {
      return new Promise((resolve, reject) => {
        this.pendingCallbacks.push(() => call().then(resolve).catch(reject));
      });
    } else {
      return call();
    }
  }
  async _getUnpublishedEvents() {
    const events = await this.db.getAllAsync(`SELECT * FROM unpublished_events`);
    return events.map(event => {
      const deserializedEvent = new NDKEvent(undefined, deserialize(event.event));
      const relays = JSON.parse(event.relays);
      return {
        event: deserializedEvent,
        relays: Object.keys(relays),
        lastTryAt: event.last_try_at
      };
    });
  }
  discardUnpublishedEvent(eventId) {
    this.db.runAsync(`DELETE FROM unpublished_events WHERE id = ?;`, [eventId]);
  }
}
export function foundEvents(subscription, events, filter) {
  // if we have a limit, sort and slice
  if (filter?.limit && events.length > filter.limit) {
    events = events.sort((a, b) => b.created_at - a.created_at).slice(0, filter.limit);
  }
  for (const event of events) {
    foundEvent(subscription, event, event.relay, filter);
  }
}
export function foundEvent(subscription, event, relayUrl, filter) {
  try {
    const deserializedEvent = deserialize(event.event);
    if (filter && !matchFilter(filter, deserializedEvent)) return;
    const ndkEvent = new NDKEvent(undefined, deserializedEvent);
    const relay = relayUrl ? subscription.pool.getRelay(relayUrl, false) : undefined;
    ndkEvent.relay = relay;
    subscription.eventReceived(ndkEvent, relay, true);
  } catch (e) {
    console.error('failed to deserialize event', e, event);
  }
}
//# sourceMappingURL=sqlite.js.map
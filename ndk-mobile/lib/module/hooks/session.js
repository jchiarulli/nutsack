"use strict";

import { useContext } from 'react';
import NDKSessionContext from "../context/session.js";
import { useNDK } from "./ndk.js";
const useNDKSession = () => {
  const context = useContext(NDKSessionContext);
  if (context === undefined) {
    throw new Error('useNDK must be used within an NDKProvider');
  }
  return context;
};

/**
 * This hook allows you to get a specific kind, wrapped in the event class you provide.
 * @param EventClass 
 * @param kind 
 * @param opts.create - If true, and the event kind is not found, an unpublished event will be provided.
 * @returns 
 */
const useNDKSessionEventKind = (EventClass, kind, {
  create
} = {
  create: false
}) => {
  const {
    ndk
  } = useNDK();
  const {
    events
  } = useNDKSession();
  const kindEvents = events.get(kind) || [];
  const firstEvent = !!kindEvents[0];
  if (create && !firstEvent) {
    const event = new EventClass(ndk);
    event.kind = kind;
    events.set(kind, [event]);
    return event;
  }
  return firstEvent ? EventClass.from(firstEvent) : undefined;
};
const useNDKSessionEvents = (kinds, eventClass) => {
  const {
    events
  } = useNDKSession();
  let allEvents = kinds.flatMap(kind => events.get(kind) || []);
  if (kinds.length > 1) allEvents = allEvents.sort((a, b) => a.created_at - b.created_at);

  // remove deleted events if replaceable
  allEvents = allEvents.filter(e => !e.isReplaceable() || !e.hasTag('deleted'));
  return allEvents.map(e => eventClass ? eventClass.from(e) : e);
};
export { useNDKSession, useNDKSessionEventKind, useNDKSessionEvents };
//# sourceMappingURL=session.js.map
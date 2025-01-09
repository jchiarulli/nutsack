"use strict";

export const setEvents = (kind, events, set) => {
  set(state => {
    const newEvents = new Map(state.events);
    newEvents.set(kind, events);
    return {
      events: newEvents
    };
  });
};
//# sourceMappingURL=setEvents.js.map
"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ClockContext = createContext(0);

/**
 * One shared one-second clock for every countdown in the block, instead of a
 * timer per card. Only components that call `useNow()` re-render on each tick.
 */
export function ClockProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <ClockContext.Provider value={now}>{children}</ClockContext.Provider>;
}

/** Current time in ms, updated every second. 0 until the first tick. */
export function useNow() {
  return useContext(ClockContext);
}

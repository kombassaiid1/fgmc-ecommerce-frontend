"use client";

import { useEffect } from "react";

import { apiRequest } from "@/lib/api/http-client";
import { getClientSession, subscribeToClientSession } from "@/lib/client-auth";

const PING_KEY = "fgmc_last_visit_ping";
const PING_EVERY_MS = 15 * 60 * 1000;

function readLastPing(): number {
  try {
    return Number(window.localStorage.getItem(PING_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Tells the backend a logged-in customer is on the site (admin "Dernière visite"). */
export function ClientVisitTracker() {
  useEffect(() => {
    const ping = () => {
      const session = getClientSession();
      if (!session?.token || document.visibilityState === "hidden") return;
      if (Date.now() - readLastPing() < PING_EVERY_MS) return;
      try {
        window.localStorage.setItem(PING_KEY, String(Date.now()));
      } catch {
        // storage unavailable: the backend throttles anyway
      }
      apiRequest({
        path: "/auth/me/visit",
        method: "POST",
        headers: { Authorization: `Bearer ${session.token}` },
      }).catch(() => {
        // best effort: a failed heartbeat must never disturb browsing
      });
    };

    ping();
    document.addEventListener("visibilitychange", ping);
    const unsubscribe = subscribeToClientSession(ping);
    return () => {
      document.removeEventListener("visibilitychange", ping);
      unsubscribe();
    };
  }, []);

  return null;
}

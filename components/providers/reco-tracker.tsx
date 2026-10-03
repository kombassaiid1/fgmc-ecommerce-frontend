"use client";

import { useEffect } from "react";
import { startRecoCartTracking } from "@/lib/reco/events";
import { startRecoSessionSync } from "@/lib/reco/session-sync";

/**
 * Renders nothing: enables ADD_TO_CART tracking for recommended products and
 * keeps the anonymous session registered (and linked to the logged-in client).
 */
export function RecoTracker() {
  useEffect(() => startRecoCartTracking(), []);
  useEffect(() => startRecoSessionSync(), []);
  return null;
}

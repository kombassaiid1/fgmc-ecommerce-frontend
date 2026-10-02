"use client";

import { useEffect } from "react";
import { startRecoCartTracking } from "@/lib/reco/events";

/** Renders nothing: enables ADD_TO_CART tracking for recommended products. */
export function RecoTracker() {
  useEffect(() => startRecoCartTracking(), []);
  return null;
}

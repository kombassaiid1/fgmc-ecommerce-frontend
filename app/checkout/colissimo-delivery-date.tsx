"use client";

import { useEffect, useState } from "react";
import { getColissimoDeliveryDate, type ColissimoDeliveryEstimate } from "@/lib/api/shipping";

/** The estimated delivery date line of a Colissimo carrier, in the colour and font chosen in the module. Nothing shows when the option is off. */
export function ColissimoDeliveryDate({ zip, country }: { zip: string; country: string }) {
  const [state, setState] = useState<{ key: string; estimate: ColissimoDeliveryEstimate } | null>(null);
  const key = `${country}|${zip}`;

  useEffect(() => {
    if (!zip.trim() || country.toUpperCase() !== "FR") return undefined;
    let cancelled = false;
    getColissimoDeliveryDate(zip.trim(), country)
      .then((estimate) => !cancelled && setState({ key, estimate }))
      .catch(() => !cancelled && setState({ key, estimate: null }));
    return () => {
      cancelled = true;
    };
  }, [zip, country, key]);

  if (!state || state.key !== key || !state.estimate?.message) return null;
  return (
    <p className="mt-2 text-sm" style={{ color: state.estimate.color, fontFamily: state.estimate.font }} role="status">
      {state.estimate.message}
    </p>
  );
}

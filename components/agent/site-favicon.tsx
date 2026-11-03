"use client";

import { useState } from "react";
import Image from "next/image";
import { Globe } from "lucide-react";

export function getPublicSiteDomain(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || /^[\d.]+$/.test(host)) return null;
    if (/\.(local|localhost|internal|lan|test)$/.test(host)) return null;
    if (typeof window !== "undefined" && url.host === window.location.host) return null;
    return host;
  } catch {
    return null;
  }
}

export function SiteFavicon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Globe size={16} className="shrink-0 text-slate-400" aria-hidden="true" />;
  return (
    <Image
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
      alt=""
      width={16}
      height={16}
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-4 shrink-0 rounded-sm"
    />
  );
}

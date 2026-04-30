"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import type { PageDataResponse } from "@/lib/pages-api";
import { usePageBySlug } from "@/hooks/use-pages";
import { PuckRenderer } from "@/components/puck/puck-renderer";

type Props = {
  pageName: string;
  /** Pre-fetched page data (e.g. from server). Avoids loading state and enables instant render. */
  initialData?: PageDataResponse | null;
};

const MIN_LOADING_MS = 500;

const EMPTY_PUCK_DATA = {
  content: [],
  root: { props: {} },
  zones: {},
} as Record<string, unknown>;

export function StorefrontClient({ pageName, initialData }: Props) {
  const [minDelayDone, setMinDelayDone] = useState(false);
  const { data: response, isLoading, isError, error } = usePageBySlug(pageName, {
    initialData: initialData ?? undefined,
  });

  useEffect(() => {
    const t = setTimeout(() => setMinDelayDone(true), MIN_LOADING_MS);
    return () => clearTimeout(t);
  }, []);

  const data =
    (response?.data as unknown as Record<string, unknown> | undefined) ??
    (initialData?.data as unknown as Record<string, unknown> | undefined) ??
    EMPTY_PUCK_DATA;

  const showLoading = isLoading || !minDelayDone;

  if (showLoading) {
    return (
      <div className="flex min-h-[90vh] flex-col items-center justify-center gap-6">
        <Image
          src="/logo.webp"
          alt=""
          width={160}
          height={64}
          className="h-16 w-auto object-contain"
          aria-hidden
          unoptimized
        />
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
          aria-hidden
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[90vh] items-center justify-center text-destructive">
        {error?.message ?? "Failed to load page"}
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden">
      <div className="mx-auto max-w-[1500px] px-4 py-8">
        <PuckRenderer data={data} />
      </div>
    </main>
  );
}


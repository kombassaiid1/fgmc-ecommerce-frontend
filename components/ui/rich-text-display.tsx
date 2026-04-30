"use client";

import { cn } from "@/lib/utils";

export function RichTextDisplay({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none prose-p:leading-relaxed",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}


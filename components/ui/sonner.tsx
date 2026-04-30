"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "bg-white border border-border/80 text-foreground shadow-lg rounded-xl",
          description: "text-muted-foreground",
          actionButton: "bg-slate-900 text-white",
          cancelButton: "bg-muted text-foreground",
        },
      }}
    />
  );
}


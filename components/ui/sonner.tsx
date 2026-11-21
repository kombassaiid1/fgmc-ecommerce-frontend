"use client";

import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from "lucide-react";
import { Toaster as Sonner } from "sonner";

/**
 * The shop's notifications: a small white ticket with a coloured edge, in the same blue, red and
 * stitched-line language as the rest of the shop. They sit at the bottom right, so they never cover the header
 * or the cart button, and on a phone they take the width of the screen.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      visibleToasts={3}
      icons={{
        success: <CheckCircle2 className="size-5" aria-hidden="true" />,
        error: <AlertCircle className="size-5" aria-hidden="true" />,
        warning: <TriangleAlert className="size-5" aria-hidden="true" />,
        info: <Info className="size-5" aria-hidden="true" />,
        loading: <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group flex w-full items-start gap-3 rounded-[4px] border border-[#d5deee] border-l-4 border-l-[#153675] bg-white py-4 pl-4 pr-12 text-[#0f1f45] shadow-[0_10px_28px_-14px_rgba(15,31,69,0.45)]",
          success: "border-l-[#153675] [&_[data-icon]]:text-[#153675]",
          info: "border-l-[#153675] [&_[data-icon]]:text-[#153675]",
          error: "border-l-[#d6202e] [&_[data-icon]]:text-[#d6202e]",
          warning: "border-l-[#d6202e] [&_[data-icon]]:text-[#d6202e]",
          icon: "mt-0.5 shrink-0",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "text-base font-semibold leading-snug",
          description: "text-sm leading-snug text-[#5b6b8a]",
          actionButton:
            "ml-auto inline-flex min-h-9 shrink-0 cursor-pointer items-center self-center rounded-[4px] border border-[#153675] bg-white px-3 text-sm font-medium text-[#153675] transition-colors duration-200 hover:bg-[#eef2f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153675]",
          cancelButton:
            "ml-2 inline-flex min-h-9 shrink-0 cursor-pointer items-center self-center rounded-[4px] px-3 text-sm font-medium text-[#5b6b8a] hover:bg-[#eef2f9]",
          closeButton:
            "absolute right-1 top-1 grid size-10 cursor-pointer place-items-center rounded-[4px] border-0 bg-transparent text-[#5b6b8a] transition-colors duration-200 hover:bg-[#eef2f9] hover:text-[#0f1f45] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#153675]",
        },
      }}
    />
  );
}

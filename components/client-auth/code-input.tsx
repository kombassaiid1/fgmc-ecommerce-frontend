"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

const LENGTH = 6;

/**
 * Six boxes for a code of digits. Typing moves on by itself, Backspace goes back, a pasted code (or the code a phone offers
 * from the e-mail) fills every box, and the whole thing is one field for a screen reader.
 */
export function CodeInput({
  id,
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Called once all six digits are there. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: LENGTH }, (_, index) => value[index] ?? "");

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, LENGTH);
    onChange(clean);
    if (clean.length === LENGTH) onComplete?.(clean);
  };

  return (
    <div role="group" aria-label="Code à 6 chiffres" className="flex gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          id={index === 0 ? id : `${id}-${index}`}
          ref={(node) => {
            boxes.current[index] = node;
          }}
          value={digit}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Chiffre ${index + 1} sur ${LENGTH}`}
          aria-invalid={invalid || undefined}
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            const typed = event.target.value.replace(/\D/g, "");
            if (!typed) return;
            // Several digits at once (autofill, paste in one box): spread them from this box.
            const next = (value.slice(0, index) + typed + value.slice(index + 1)).slice(0, LENGTH);
            commit(next);
            boxes.current[Math.min(index + typed.length, LENGTH - 1)]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace") {
              event.preventDefault();
              if (digit) commit(value.slice(0, index) + value.slice(index + 1));
              else if (index > 0) {
                commit(value.slice(0, index - 1) + value.slice(index));
                boxes.current[index - 1]?.focus();
              }
            } else if (event.key === "ArrowLeft" && index > 0) boxes.current[index - 1]?.focus();
            else if (event.key === "ArrowRight" && index < LENGTH - 1) boxes.current[index + 1]?.focus();
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
            if (!pasted) return;
            event.preventDefault();
            commit(pasted);
            boxes.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
          }}
          className={cn(
            "h-14 min-w-0 flex-1 rounded-xl border-2 bg-white text-center text-2xl font-bold tabular-nums text-[var(--auth-ink)] outline-none transition-colors sm:h-16 sm:text-3xl",
            "focus-visible:border-[var(--auth-blue)] focus-visible:ring-4 focus-visible:ring-[var(--auth-blue)]/15",
            invalid ? "border-[var(--auth-red)]" : digit ? "border-[var(--auth-ink)]" : "border-[var(--auth-line)]",
            "disabled:opacity-60",
          )}
        />
      ))}
    </div>
  );
}

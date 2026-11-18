"use client";

import { useMemo, useState } from "react";
import { ActionList, Popover } from "@shopify/polaris";
import type { StatusOption } from "@/lib/use-order-states";

/**
 * An order's status as PrestaShop shows it in the order list: a label in the status color. Clicking it opens a plain
 * list of the statuses (alphabetical); choosing one changes the order.
 */
export function StatusPicker({
  value,
  options,
  disabled,
  label,
  onChange,
}: {
  value: string;
  options: StatusOption[];
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  const sorted = useMemo(() => [...options].sort((a, b) => a.label.localeCompare(b.label, "fr")), [options]);

  const activator = (
    <button
      type="button"
      aria-label={`${label} : ${value}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => setOpen((on) => !on)}
      className="inline-flex max-w-full items-center gap-1 rounded px-2 py-0.5 text-left text-xs font-semibold disabled:opacity-60"
      style={{ backgroundColor: current?.backgroundColor ?? "#e5e7eb", color: current?.textColor ?? "#1f2937", border: 0, cursor: disabled ? "default" : "pointer" }}>
      <span>{value}</span>
      <svg aria-hidden="true" viewBox="0 0 20 20" width="12" height="12" fill="currentColor"><path d="M5.5 7.5 10 12l4.5-4.5z" /></svg>
    </button>
  );

  return (
    <Popover active={open} activator={activator} onClose={() => setOpen(false)} preferredAlignment="left" autofocusTarget="first-node">
      <ActionList
        actionRole="menuitem"
        items={sorted.map((option) => ({
          content: option.label,
          active: option.value === value,
          onAction: () => {
            setOpen(false);
            if (option.value !== value) onChange(option.value);
          },
        }))}
      />
    </Popover>
  );
}

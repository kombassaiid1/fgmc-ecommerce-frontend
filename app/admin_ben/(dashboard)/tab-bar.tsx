"use client";

export type TabItem = { id: string; label: string };

/**
 * Tab bar with an unmistakable active state: bold label, tinted background and a thick
 * underline in the accent colour. Arrow keys move between tabs.
 */
export function TabBar({ tabs, selected, onSelect, label, panelId }: { tabs: TabItem[]; selected: number; onSelect: (index: number) => void; label: string; panelId: string }) {
  return (
    <div
      role="tablist"
      aria-label={label}
      style={{ display: "flex", flexWrap: "wrap", gap: "var(--p-space-200)", borderBottom: "1px solid var(--p-color-border)" }}
      onKeyDown={(event) => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = (selected + step + tabs.length) % tabs.length;
        onSelect(next);
        document.getElementById(`${panelId}-tab-${tabs[next].id}`)?.focus();
      }}>
      {tabs.map((tab, index) => {
        const active = index === selected;
        return (
          <button
            key={tab.id}
            id={`${panelId}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(index)}
            style={{
              appearance: "none",
              background: active ? "var(--p-color-bg-surface-selected)" : "transparent",
              border: 0,
              borderBottom: `3px solid ${active ? "var(--p-color-border-focus)" : "transparent"}`,
              marginBottom: -1,
              borderTopLeftRadius: "var(--p-border-radius-200)",
              borderTopRightRadius: "var(--p-border-radius-200)",
              padding: "var(--p-space-300) var(--p-space-500)",
              cursor: "pointer",
              font: "inherit",
              fontSize: "var(--p-font-size-325)",
              fontWeight: active ? 650 : 450,
              color: active ? "var(--p-color-text)" : "var(--p-color-text-secondary)",
            }}>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

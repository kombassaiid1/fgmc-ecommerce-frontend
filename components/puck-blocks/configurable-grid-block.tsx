type ConfigurableGridBlockProps = {
  columns?: number;
  columnTemplate?: string;
  rows?: number;
  gap?: number;
  minCellHeight?: number;
  puck?: {
    renderDropZone?: (args: { zone: string }) => React.ReactNode;
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTemplateToken(token: string): string | null {
  const value = token.trim().toLowerCase();
  if (!value) return null;

  if (
    value.endsWith("fr") ||
    value.endsWith("%") ||
    value.endsWith("px") ||
    value.startsWith("minmax(") ||
    value.startsWith("clamp(")
  ) {
    return value;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return `${String(parsed)}fr`;
  }

  return null;
}

export function ConfigurableGridBlock({
  columns = 2,
  columnTemplate = "",
  rows = 1,
  gap = 16,
  minCellHeight = 120,
  puck,
}: ConfigurableGridBlockProps) {
  const parsedTemplate = columnTemplate
    .trim()
    .split(/\s+/)
    .map(normalizeTemplateToken)
    .filter((token): token is string => Boolean(token));
  const hasCustomTemplate = parsedTemplate.length > 0;
  const safeCols = hasCustomTemplate
    ? clamp(parsedTemplate.length, 1, 6)
    : clamp(Math.round(Number(columns) || 1), 1, 6);
  const safeRows = clamp(Math.round(Number(rows) || 1), 1, 6);
  const safeGap = clamp(Math.round(Number(gap) || 0), 0, 64);
  const safeMinHeight = clamp(Math.round(Number(minCellHeight) || 80), 40, 800);

  const gridTemplateColumns = hasCustomTemplate
    ? parsedTemplate.join(" ")
    : `repeat(${String(safeCols)}, minmax(0, 1fr))`;

  const cellCount = safeCols * safeRows;

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns,
        gap: safeGap,
      }}
    >
      {Array.from({ length: cellCount }).map((_, index) => {
        const zoneId = `cell-${String(index + 1)}`;
        return (
          <div
            key={zoneId}
            style={{
              minHeight: safeMinHeight,
              borderRadius: 8,
              padding: 0,
              background: "transparent",
            }}
          >
            {puck?.renderDropZone?.({ zone: zoneId })}
          </div>
        );
      })}
    </section>
  );
}

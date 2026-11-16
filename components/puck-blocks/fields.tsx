import { FieldLabel, type CustomField } from "@puckeditor/core";

/** Shared Yes/No options for radio fields. */
export const yesNoOptions = [
  { label: "Oui", value: true },
  { label: "Non", value: false },
];

/** Colour picker + hex box. An empty value means "use the default". */
export function colorField(label: string, placeholder = "Par défaut"): CustomField<string> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, name, field }) => (
      <FieldLabel label={field.label ?? label}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="color"
            aria-label={`${label} (sélecteur)`}
            value={/^#[0-9a-f]{6}$/i.test(value ?? "") ? value : "#ffffff"}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 40, height: 36, padding: 2, border: "1px solid #d5dadf", borderRadius: 3, background: "#fff", cursor: "pointer" }}
          />
          <input
            type="text"
            name={name}
            aria-label={label}
            placeholder={placeholder}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            style={{ flex: 1, minWidth: 0, height: 36, padding: "0 10px", border: "1px solid #d5dadf", borderRadius: 3, font: "inherit", fontSize: 13 }}
          />
          {value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              style={{ height: 36, padding: "0 10px", border: "1px solid #d5dadf", borderRadius: 3, background: "#fff", fontSize: 12, cursor: "pointer" }}
            >
              Effacer
            </button>
          ) : null}
        </div>
      </FieldLabel>
    ),
  };
}

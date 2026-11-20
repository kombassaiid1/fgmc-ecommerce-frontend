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

/** An on/off switch. */
export function switchField(label: string, help?: string): CustomField<boolean> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, name }) => (
      <FieldLabel label={label}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <button
            type="button"
            role="switch"
            name={name}
            aria-checked={Boolean(value)}
            aria-label={label}
            onClick={() => onChange(!value)}
            style={{ position: "relative", flex: "none", width: 44, height: 24, borderRadius: 12, border: 0, padding: 0, cursor: "pointer", background: value ? "#0858b1" : "#c3cad3", transition: "background .15s" }}
          >
            <span style={{ position: "absolute", top: 2, left: value ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "left .15s" }} />
          </button>
          <span style={{ fontSize: 12, lineHeight: 1.4, color: "#5b6573" }}>
            <strong style={{ color: value ? "#0858b1" : "#5b6573" }}>{value ? "Activé" : "Désactivé"}</strong>
            {help ? <><br />{help}</> : null}
          </span>
        </div>
      </FieldLabel>
    ),
  };
}

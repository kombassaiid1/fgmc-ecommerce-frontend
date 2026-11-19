"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Banner, BlockStack, Box, Button, ButtonGroup, Card, Icon, InlineStack, Modal as PolarisModal, Select as PolarisSelect, SkeletonBodyText, Text as PolarisText, TextField, Tooltip, useFrame } from "@shopify/polaris";
import { QuestionCircleIcon } from "@shopify/polaris-icons";
import { colissimoCall, type ModuleConfig } from "./colissimo-api";
import "./colissimo.css";

/* ---------------------------------------------------------------- */
/* Page context: the whole configuration, loaded once                */
/* ---------------------------------------------------------------- */

type Ctx = {
  config: ModuleConfig;
  /** Replaces the configuration with what the server answered after a save. */
  setConfig: (next: ModuleConfig) => void;
  toast: (message: string, error?: boolean) => void;
};

const ConfigContext = createContext<Ctx | null>(null);
export const useColissimo = () => {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("Colissimo context missing");
  return ctx;
};

/** Loads the configuration and gives it to the page. Shows a skeleton or the error until it is there. */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const { showToast, hideToast } = useFrame();
  const count = useRef(0);
  const [config, setConfig] = useState<ModuleConfig | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    colissimoCall<ModuleConfig>("/config")
      .then((loaded) => {
        if (!cancelled) setConfig(loaded);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toast = useCallback(
    (content: string, isError = false) => {
      const id = `colissimo-${Date.now()}-${++count.current}`;
      showToast({ id, content, error: isError, duration: isError ? 8000 : 4500, onDismiss: () => hideToast({ id }) });
    },
    [hideToast, showToast],
  );

  if (error) return <Banner tone="critical" title="Impossible de charger le module Colissimo">{error}</Banner>;
  if (!config) return <Card><SkeletonBodyText lines={10} /></Card>;
  return <ConfigContext.Provider value={{ config, setConfig, toast }}>{children}</ConfigContext.Provider>;
}

/** One form of the page: its values, a dirty flag and a Save that sends them to the server. */
export function useForm<T extends Record<string, unknown>>(initial: T, save: (values: T) => Promise<ModuleConfig>) {
  const { setConfig, toast } = useColissimo();
  const [values, setValues] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const set = <K extends keyof T>(key: K, value: T[K]) => {
    setValues((old) => ({ ...old, [key]: value }));
    setDirty(true);
  };
  const submit = async () => {
    setSaving(true);
    try {
      setConfig(await save(values));
      setDirty(false);
      toast("Réglages enregistrés");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enregistrement impossible.", true);
    } finally {
      setSaving(false);
    }
  };
  return { values, set, saving, dirty, submit, setValues };
}

/* ---------------------------------------------------------------- */
/* Building blocks (Polaris)                                         */
/* ---------------------------------------------------------------- */

/**
 * A settings section in the Shopify pattern: the title and what it is for on the left, the card with the fields on the
 * right, and one Save at the bottom of the card. Without a title it is a plain card.
 */
export function Panel({ title, description, children, onSave, saving, dirty = true, saveLabel = "Enregistrer", id }: { title?: string; description?: ReactNode; icon?: string; children: ReactNode; onSave?: () => void; saving?: boolean; dirty?: boolean; saveLabel?: string; id?: string }) {
  const card = (
    <Card>
      <BlockStack gap="400">
        {children}
        {onSave ? (
          <InlineStack align="end" gap="200">
            <Button variant="primary" onClick={onSave} loading={saving} disabled={!dirty}>{saveLabel}</Button>
          </InlineStack>
        ) : null}
      </BlockStack>
    </Card>
  );
  if (!title) return <div id={id}>{card}</div>;
  return (
    <section className="cm-section" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <BlockStack gap="150">
        <PolarisText as="h2" variant="headingMd" id={id ? `${id}-title` : undefined}>{title}</PolarisText>
        {description ? <PolarisText as="p" variant="bodyMd" tone="subdued">{description}</PolarisText> : null}
      </BlockStack>
      {card}
    </section>
  );
}

/** A label, its control and what it means. A tip adds a help tooltip next to the label. */
export function Group({ label, tip, help, required, offset, children, htmlFor }: { label?: ReactNode; tip?: string; help?: ReactNode; required?: boolean; offset?: boolean; children: ReactNode; htmlFor?: string }) {
  return (
    <BlockStack gap="100">
      {!offset && label ? (
        <InlineStack gap="100" blockAlign="center">
          <label className="cm-label" htmlFor={htmlFor} data-required={required ? "true" : undefined}>{label}</label>
          {tip ? (
            <Tooltip content={tip}>
              <span tabIndex={0} role="img" aria-label={tip} style={{ display: "inline-flex" }}><Icon source={QuestionCircleIcon} tone="subdued" /></span>
            </Tooltip>
          ) : null}
        </InlineStack>
      ) : null}
      {children}
      {help ? <PolarisText as="p" variant="bodySm" tone="subdued">{help}</PolarisText> : null}
    </BlockStack>
  );
}

/** Yes or No, as a segmented choice. */
export function YesNo({ name, value, onChange, disabled }: { name: string; value: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={name.replace(/^COLISSIMO_/, "").replace(/_/g, " ").toLowerCase()}>
      <ButtonGroup variant="segmented">
        <Button pressed={value} disabled={disabled} onClick={() => onChange(true)} accessibilityLabel="Oui">Oui</Button>
        <Button pressed={!value} disabled={disabled} onClick={() => onChange(false)} accessibilityLabel="Non">Non</Button>
      </ButtonGroup>
    </div>
  );
}

export function Text({ id, value, onChange, size, addon, type = "text", max, placeholder, autoComplete = "off", disabled, label }: { id?: string; value: string | number; onChange: (value: string) => void; size?: "xs" | "sm"; addon?: string; type?: string; max?: number; placeholder?: string; autoComplete?: string; disabled?: boolean; label?: string }) {
  return (
    <div className={size === "xs" ? "cm-narrower" : size === "sm" ? "cm-narrow" : undefined} style={size ? undefined : { maxWidth: 460 }}>
      <TextField
        id={id}
        label={label ?? id ?? "Valeur"}
        labelHidden
        type={type as "text"}
        value={String(value)}
        onChange={onChange}
        suffix={addon}
        maxLength={max}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        showCharacterCount={Boolean(max && max <= 80 && !size)}
      />
    </div>
  );
}

export function Select({ id, value, onChange, options, size, label }: { id?: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; size?: "md"; label?: string }) {
  return (
    <div style={{ maxWidth: size ? 260 : 460 }}>
      <PolarisSelect id={id} label={label ?? id ?? "Choix"} labelHidden value={value} onChange={onChange} options={options} />
    </div>
  );
}

export function Alert({ tone = "info", children, title }: { tone?: "info" | "warning" | "success" | "danger"; children: ReactNode; title?: string }) {
  return (
    <Banner tone={tone === "danger" ? "critical" : tone} title={title}>
      <BlockStack gap="100">{children}</BlockStack>
    </Banner>
  );
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <PolarisModal open onClose={onClose} title={title} secondaryActions={[{ content: "Fermer", onAction: onClose }]}>
      <PolarisModal.Section>
        <BlockStack gap="300">{children}{footer ? <Box>{footer}</Box> : null}</BlockStack>
      </PolarisModal.Section>
    </PolarisModal>
  );
}

export const yesNoOptions = [{ value: "1", label: "Oui" }, { value: "0", label: "Non" }];
export const asBool = (value: unknown) => value === true || value === 1 || value === "1";
export const asText = (value: unknown) => (value === null || value === undefined ? "" : String(value));

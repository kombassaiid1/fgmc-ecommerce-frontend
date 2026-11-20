"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Puck, usePuck } from "@puckeditor/core";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronDown,
  Eye,
  EyeOff,
  Grip,
  Layers,
  Loader2,
  Menu,
  Monitor,
  Redo2,
  RotateCcw,
  Settings,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react";

import { type PageSettings, pagePath } from "./pages-api";
import { blockLabel } from "./puck-config";

type LeftView = "widgets" | "navigator" | "page";

const DEVICES = [
  { id: "desktop", label: "Ordinateur", width: "100%" as const, Icon: Monitor },
  { id: "tablet", label: "Tablette", width: 820 as const, Icon: Tablet },
  { id: "mobile", label: "Mobile", width: 390 as const, Icon: Smartphone },
];

type ShellProps = {
  saved: boolean;
  page: PageSettings;
  onManagePages: () => void;
  onPublish: (data: unknown) => void;
  onReset: () => void;
};

export function BuilderShell({ saved, page, onManagePages, onPublish, onReset }: ShellProps) {
  const { appState, dispatch, history, selectedItem } = usePuck();
  const [view, setView] = useState<LeftView>("widgets");
  const [menuOpen, setMenuOpen] = useState(false);

  const preview = appState.ui.previewMode === "interactive";
  const hasSelection = Boolean(appState.ui.itemSelector) && Boolean(selectedItem);
  // Unknown widths count as Desktop, and the canvas uses the same value, so the
  // highlighted icon always matches what is shown.
  const activeDevice =
    DEVICES.find((d) => d.width === appState.ui.viewports.current.width) ?? DEVICES[0];
  const frameWidth = activeDevice.width;

  const setUi = (ui: Partial<typeof appState.ui>) => dispatch({ type: "setUi", ui });

  const setDevice = (width: number | "100%") =>
    setUi({
      viewports: {
        ...appState.ui.viewports,
        current: { width, height: "auto" },
      },
    });

  const showWidgets = () => {
    setUi({ itemSelector: null });
    setView("widgets");
  };

  // Close the hamburger menu with Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const selectedLabel = selectedItem
    ? blockLabel(selectedItem.type)
    : "";

  return (
    <div className="pb-shell" data-preview={preview || undefined}>
      {/* ------------------------------------------------ left panel */}
      <aside className="pb-left" aria-label="Panneau de l'éditeur">
        <header className="pb-left-head">
          <div className="pb-menu-wrap">
            <button
              type="button"
              className="pb-icon-btn"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            {menuOpen && (
              <>
                <div className="pb-scrim" onClick={() => setMenuOpen(false)} />
                <div className="pb-menu" role="menu">
                  <Link href="/admin_ben/apparence" className="pb-menu-item" role="menuitem">
                    <ArrowLeft className="size-4" aria-hidden="true" /> Retour à l&apos;admin
                  </Link>
                  <button
                    type="button"
                    className="pb-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onReset();
                    }}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" /> Réinitialiser la page
                  </button>
                </div>
              </>
            )}
          </div>
          <h1 className="pb-left-title">
            {hasSelection ? `Modifier ${selectedLabel}` : view === "navigator" ? "Navigateur" : view === "page" ? "Réglages de la page" : "Widgets"}
          </h1>
          <button
            type="button"
            className="pb-icon-btn"
            aria-label="Afficher les widgets"
            title="Widgets"
            onClick={showWidgets}
          >
            <Grip className="size-5" aria-hidden="true" />
          </button>
        </header>

        <div className="pb-left-body">
          {hasSelection ? (
            <>
              <button type="button" className="pb-back" onClick={showWidgets}>
                <ChevronLeft className="size-4" aria-hidden="true" /> Tous les widgets
              </button>
              <Puck.Fields />
            </>
          ) : view === "navigator" ? (
            <Puck.Outline />
          ) : view === "page" ? (
            <Puck.Fields />
          ) : (
            <Puck.Components />
          )}
        </div>

        <footer className="pb-left-foot">
          <div className="pb-foot-tools">
            <button
              type="button"
              className="pb-icon-btn"
              aria-label="Réglages de la page"
              title="Réglages de la page"
              data-active={view === "page" && !hasSelection ? "" : undefined}
              onClick={() => {
                setUi({ itemSelector: null });
                setView("page");
              }}
            >
              <Settings className="size-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pb-icon-btn"
              aria-label="Navigateur"
              title="Navigateur"
              data-active={view === "navigator" && !hasSelection ? "" : undefined}
              onClick={() => {
                setUi({ itemSelector: null });
                setView("navigator");
              }}
            >
              <Layers className="size-[18px]" aria-hidden="true" />
            </button>
            <span className="pb-foot-sep" aria-hidden="true" />
            <button
              type="button"
              className="pb-icon-btn"
              aria-label="Annuler"
              title="Annuler"
              disabled={!history.hasPast}
              onClick={() => history.back()}
            >
              <Undo2 className="size-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pb-icon-btn"
              aria-label="Rétablir"
              title="Rétablir"
              disabled={!history.hasFuture}
              onClick={() => history.forward()}
            >
              <Redo2 className="size-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pb-icon-btn"
              aria-label="Aperçu"
              title="Aperçu"
              onClick={() => setUi({ previewMode: "interactive" })}
            >
              <Eye className="size-[18px]" aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="pb-publish" onClick={() => onPublish(appState.data)}>
            {page.published ? "Enregistrer" : "Publier"}
          </button>
        </footer>
      </aside>

      {/* ------------------------------------------------ stage */}
      <section className="pb-stage">
        <div className="pb-topbar">
          <button type="button" className="pb-topbar-title pb-topbar-switch" onClick={onManagePages} aria-haspopup="dialog" title="Pages et réglages de la page">
            <span className="pb-topbar-page">{page.title}</span>
            <span className="pb-topbar-path">{pagePath(page.slug)}</span>
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>

          <div className="pb-devices" role="group" aria-label="Aperçu responsive">
            {DEVICES.map(({ id, label, width, Icon }) => (
              <button
                key={id}
                type="button"
                className="pb-device"
                aria-label={label}
                title={label}
                aria-pressed={activeDevice.id === id}
                onClick={() => setDevice(width)}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
              </button>
            ))}
          </div>

          <span className="pb-status" role="status" aria-live="polite">
            {saved ? (
              <>
                <Check className="size-4" aria-hidden="true" /> {page.published ? "Enregistré, en ligne" : "Brouillon enregistré"}
              </>
            ) : (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Enregistrement…
              </>
            )}
          </span>
        </div>

        <div className="pb-canvas">
          {/* Puck.Preview doesn't size itself to the selected device. */}
          <div
            className="pb-frame"
            style={{ width: frameWidth }}
          >
            <Puck.Preview />
          </div>
        </div>

        {preview && (
          <button
            type="button"
            className="pb-exit-preview"
            onClick={() => setUi({ previewMode: "edit" })}
          >
            <EyeOff className="size-4" aria-hidden="true" /> Retour à l&apos;édition
          </button>
        )}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Settings panel tabs (Contenu / Style / Avancé), Elementor-style.
 * Fields are grouped by name; anything not listed below lands in "Contenu".
 * ------------------------------------------------------------------------- */
const STYLE_FIELDS = new Set([
  "align",
  "height",
  "ratio",
  "rounded",
  "radius",
  "size",
  "tone",
  "level",
  "color",
  "background",
  "padding",
  "margin",
  "minHeight",
  "fullWidth",
  "maxWidth",
  "panelGap",
  "sliderRadius",
  "cardRadius",
  "spaceTop",
  "spaceBottom",
]);
const ADVANCED_FIELDS = new Set(["id", "className", "anchor", "hidden", "visibility"]);

type FieldsOverrideProps = {
  children: React.ReactNode;
  fields: Partial<Record<string, React.ReactNode>>;
  itemSelector?: unknown;
};

export function TabbedFields({ children, fields, itemSelector }: FieldsOverrideProps) {
  const selectorKey = JSON.stringify(itemSelector ?? null);
  // The chosen tab is remembered per selected item, so selecting another
  // widget starts back on "Contenu" without needing an effect.
  const [chosen, setChosen] = useState<{ key: string; tab: string }>({ key: "", tab: "content" });
  const tab = chosen.key === selectorKey ? chosen.tab : "content";

  const groups = { content: [] as string[], style: [] as string[], advanced: [] as string[] };
  for (const name of Object.keys(fields)) {
    if (ADVANCED_FIELDS.has(name)) groups.advanced.push(name);
    else if (STYLE_FIELDS.has(name) || name.endsWith("Color")) groups.style.push(name);
    else groups.content.push(name);
  }

  const tabs = [
    { id: "content" as const, label: "Contenu", names: groups.content },
    { id: "style" as const, label: "Style", names: groups.style },
    { id: "advanced" as const, label: "Avancé", names: groups.advanced },
  ].filter((t) => t.names.length > 0);

  // Nothing to organise (e.g. page settings): show Puck's default rendering.
  if (tabs.length <= 1) return <div className="pb-fields">{children}</div>;

  const active = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <div className="pb-fields">
      <div className="pb-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active.id === t.id}
            className="pb-tab"
            onClick={() => setChosen({ key: selectorKey, tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pb-fields-list" role="tabpanel">
        {active.names.map((name) => (
          <div key={name} className="pb-field">
            {fields[name]}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banner, BlockStack, Button, Text, TextField } from "@shopify/polaris";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DeleteIcon,
  PlusIcon,
  SaveIcon,
} from "@shopify/polaris-icons";
import {
  AlignJustify,
  BadgePercent,
  ChevronDown,
  Menu,
  Palette,
  Phone,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";

import { getAdminHeaderSettings, updateHeaderSettings } from "@/lib/api/header";
import { MediaPickerDialog, type MediaItem } from "@/components/admin/media-picker-dialog";
import {
  DEFAULT_HEADER_CONFIG,
  normalizeHeaderConfig,
  type HeaderConfig,
  type HeaderLink,
} from "@/lib/header-config";
import styles from "./header.module.css";

type TabId = "appearance" | "promo" | "desktop" | "mobile" | "actions";
type LinkCollection = "links" | "mobileLinks";
type OnChange = <Key extends keyof HeaderConfig>(key: Key, value: HeaderConfig[Key]) => void;

const SECTIONS: Array<{ id: TabId; label: string; help: string; icon: typeof Palette }> = [
  { id: "appearance", label: "Logo et couleurs", help: "Identité visuelle de l'en-tête", icon: Palette },
  { id: "promo", label: "Barre du haut", help: "Contact et horaires", icon: BadgePercent },
  { id: "desktop", label: "Menu ordinateur", help: "Liens de navigation", icon: AlignJustify },
  { id: "mobile", label: "Menu mobile", help: "Liens du menu sur téléphone", icon: Menu },
  { id: "actions", label: "Recherche et panier", help: "Boutons affichés et position", icon: ShoppingBag },
];

const COLOR_PRESETS: Array<{ name: string; colors: Partial<HeaderConfig> }> = [
  {
    name: "Marine et rouge",
    colors: {
      backgroundColor: "#ffffff",
      utilityColor: "#10295f",
      utilityTextColor: "#ffffff",
      textColor: "#153675",
      accentColor: "#df1e32",
    },
  },
  {
    name: "Clair",
    colors: {
      backgroundColor: "#ffffff",
      utilityColor: "#eef2f9",
      utilityTextColor: "#153675",
      textColor: "#0f1f45",
      accentColor: "#d6202e",
    },
  },
  {
    name: "Nuit",
    colors: {
      backgroundColor: "#0f1f45",
      utilityColor: "#060e24",
      utilityTextColor: "#ffffff",
      textColor: "#ffffff",
      accentColor: "#ff5a6a",
    },
  },
];

const EMPTY_LINK: HeaderLink = { label: "Nouveau lien", url: "/" };

const sameConfig = (a: HeaderConfig, b: HeaderConfig) =>
  JSON.stringify(normalizeHeaderConfig(a)) === JSON.stringify(normalizeHeaderConfig(b));

export default function AdminHeaderAppearancePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("appearance");
  const [draftConfig, setDraftConfig] = useState<HeaderConfig | null>(null);
  const [lastSaved, setLastSaved] = useState<HeaderConfig | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const headerQuery = useQuery({
    queryKey: ["admin-header-settings"],
    queryFn: getAdminHeaderSettings,
  });

  const baseline = lastSaved ?? headerQuery.data ?? DEFAULT_HEADER_CONFIG;
  const config = draftConfig ?? baseline;
  const isDirty = !sameConfig(config, baseline);

  const edit = (changes: (current: HeaderConfig) => HeaderConfig) =>
    setDraftConfig((current) => changes(current ?? config));

  const updateConfig: OnChange = (key, value) => edit((current) => ({ ...current, [key]: value }));

  const updateLink = (collection: LinkCollection, index: number, key: keyof HeaderLink, value: string) =>
    edit((base) => ({
      ...base,
      [collection]: base[collection].map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));

  const addLink = (collection: LinkCollection) =>
    edit((base) => ({ ...base, [collection]: [...base[collection], EMPTY_LINK] }));

  const removeLink = (collection: LinkCollection, index: number) =>
    edit((base) => ({ ...base, [collection]: base[collection].filter((_, i) => i !== index) }));

  const moveLink = (collection: LinkCollection, index: number, offset: -1 | 1) =>
    edit((base) => {
      const next = [...base[collection]];
      const target = index + offset;
      if (target < 0 || target >= next.length) return base;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...base, [collection]: next };
    });

  const publishConfig = async () => {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const saved = await updateHeaderSettings(normalizeHeaderConfig(config));
      setDraftConfig(saved);
      setLastSaved(saved);
      queryClient.setQueryData(["admin-header-settings"], saved);
      queryClient.setQueryData(["storefront-header-settings"], saved);
      setNotice("En-tête publié sur la boutique.");
      await queryClient.invalidateQueries({ queryKey: ["storefront-header-settings"] });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible de publier l'en-tête. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = () => {
    setDraftConfig(DEFAULT_HEADER_CONFIG);
    setNotice("Valeurs d'origine rétablies. Cliquez sur Publier pour les appliquer à la boutique.");
  };

  const section = SECTIONS.find((item) => item.id === activeTab) ?? SECTIONS[0];

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <div className={styles.barTitle}>
          <Text as="h1" variant="headingLg">En-tête du site</Text>
          <Text as="p" tone="subdued">Ce que vos clients voient tout en haut de chaque page.</Text>
        </div>
        <div className={styles.barActions}>
          <span
            className={`${styles.status} ${isDirty ? styles.statusDirty : ""}`}
            role="status">
            <span className={styles.statusDot} aria-hidden="true" />
            {isDirty ? "Modifications non publiées" : "À jour sur la boutique"}
          </span>
          <Button onClick={resetConfig}>Rétablir</Button>
          <Button
            icon={SaveIcon}
            variant="primary"
            onClick={publishConfig}
            loading={saving}
            disabled={headerQuery.isLoading || !isDirty}>
            Publier
          </Button>
        </div>
      </header>

      {notice ? <Banner tone="success" title={notice} onDismiss={() => setNotice(null)} /> : null}
      {error ? <Banner tone="critical" title={error} onDismiss={() => setError(null)} /> : null}
      {headerQuery.isError ? (
        <Banner
          tone="warning"
          title="Les réglages n'ont pas pu être chargés. L'en-tête par défaut est affiché."
        />
      ) : null}

      <section className={styles.stage} aria-label="Aperçu en direct">
        <div className={styles.stageHead}>
          <Text as="h2" variant="headingMd">Aperçu en direct</Text>
          <span className={styles.stageHint}>Cliquez sur une zone de l&apos;aperçu pour la modifier.</span>
        </div>
        <HeaderPreview config={config} activeTab={activeTab} onSelect={setActiveTab} />
        {activeTab === "mobile" ? <DrawerPreview config={config} /> : null}
      </section>

      <div className={styles.editor}>
        <nav className={styles.sections} aria-label="Sections de l'en-tête">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.section} ${isActive ? styles.sectionActive : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setActiveTab(item.id)}>
                <span className={styles.sectionIcon}>
                  <Icon size={18} strokeWidth={1.9} aria-hidden />
                </span>
                <span>
                  <span className={styles.sectionName}>{item.label}</span>
                  <span className={styles.sectionHelp}>{item.help}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <Text as="h2" variant="headingMd">{section.label}</Text>
            <Text as="p" tone="subdued">{section.help}</Text>
          </div>

          {activeTab === "appearance" ? (
            <AppearanceSection config={config} onChange={updateConfig} onApply={(colors) => edit((c) => ({ ...c, ...colors }))} />
          ) : null}
          {activeTab === "promo" ? <PromoSection config={config} onChange={updateConfig} /> : null}
          {activeTab === "desktop" ? (
            <LinksSection
              intro="Ces liens apparaissent dans la barre de navigation, sur ordinateur et tablette."
              links={config.links}
              onAdd={() => addLink("links")}
              onRemove={(index) => removeLink("links", index)}
              onMove={(index, offset) => moveLink("links", index, offset)}
              onChange={(index, key, value) => updateLink("links", index, key, value)}
            />
          ) : null}
          {activeTab === "mobile" ? (
            <LinksSection
              intro="Ces liens apparaissent dans le menu qui s'ouvre sur téléphone."
              links={config.mobileLinks}
              onAdd={() => addLink("mobileLinks")}
              onRemove={(index) => removeLink("mobileLinks", index)}
              onMove={(index, offset) => moveLink("mobileLinks", index, offset)}
              onChange={(index, key, value) => updateLink("mobileLinks", index, key, value)}
            />
          ) : null}
          {activeTab === "actions" ? <ActionsSection config={config} onChange={updateConfig} /> : null}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

function Group({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div className={styles.group}>
      <BlockStack gap="050">
        <Text as="h3" variant="headingSm">{title}</Text>
        {help ? <Text as="p" tone="subdued" variant="bodySm">{help}</Text> : null}
      </BlockStack>
      {children}
    </div>
  );
}

function AppearanceSection({
  config,
  onChange,
  onApply,
}: {
  config: HeaderConfig;
  onChange: OnChange;
  onApply: (colors: Partial<HeaderConfig>) => void;
}) {
  const [isLogoPickerOpen, setIsLogoPickerOpen] = useState(false);

  const selectLogo = (item: MediaItem) => {
    if (item.fileType && !item.fileType.toLowerCase().startsWith("image/")) return;
    onChange("logoUrl", item.url);
    if (item.altText?.trim()) onChange("logoAlt", item.altText.trim());
    setIsLogoPickerOpen(false);
  };

  return (
    <>
      <Group title="Logo" help="Affiché en haut à gauche de chaque page.">
        <div className={styles.logoRow}>
          <div className={styles.logoPreviewBox}>
            {config.logoUrl.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logoUrl} alt={config.logoAlt || "Logo sélectionné"} />
            ) : (
              <span>Aucun logo</span>
            )}
          </div>
          <BlockStack gap="200">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Button onClick={() => setIsLogoPickerOpen(true)}>Choisir dans la médiathèque</Button>
              {config.logoUrl.trim() ? (
                <Button tone="critical" onClick={() => onChange("logoUrl", "")}>Retirer le logo</Button>
              ) : null}
            </div>
            <TextField
              label="Texte alternatif"
              helpText="Décrit le logo aux lecteurs d'écran et si l'image ne charge pas."
              value={config.logoAlt}
              onChange={(value) => onChange("logoAlt", value)}
              autoComplete="off"
            />
          </BlockStack>
        </div>
        <details className={styles.advanced}>
          <summary>Utiliser l&apos;adresse d&apos;une image</summary>
          <TextField
            label="Adresse de l'image"
            value={config.logoUrl}
            onChange={(value) => onChange("logoUrl", value)}
            autoComplete="off"
          />
        </details>
        <div className={styles.formGrid}>
          <RangeField label="Largeur du logo" value={config.logoWidth} min={72} max={300} suffix="px" onChange={(v) => onChange("logoWidth", v)} />
          <RangeField label="Hauteur de l'en-tête" value={config.headerHeight} min={56} max={112} suffix="px" onChange={(v) => onChange("headerHeight", v)} />
        </div>
      </Group>

      <Group title="Couleurs" help="Choisissez un thème, puis ajustez chaque couleur si besoin.">
        <div className={styles.presets} role="group" aria-label="Thèmes de couleurs">
          {COLOR_PRESETS.map((preset) => (
            <button key={preset.name} type="button" className={styles.preset} onClick={() => onApply(preset.colors)}>
              <span className={styles.presetSwatches} aria-hidden="true">
                {[preset.colors.backgroundColor, preset.colors.utilityColor, preset.colors.textColor, preset.colors.accentColor].map(
                  (color, index) => (
                    <i key={index} style={{ background: color }} />
                  ),
                )}
              </span>
              {preset.name}
            </button>
          ))}
        </div>
        <div className={styles.colorGrid}>
          <ColorField label="Fond de l'en-tête" value={config.backgroundColor} onChange={(v) => onChange("backgroundColor", v)} />
          <ColorField label="Fond de la barre du haut" value={config.utilityColor} onChange={(v) => onChange("utilityColor", v)} />
          <ColorField label="Texte de la barre du haut" value={config.utilityTextColor} onChange={(v) => onChange("utilityTextColor", v)} />
          <ColorField label="Texte" value={config.textColor} onChange={(v) => onChange("textColor", v)} />
          <ColorField label="Couleur d'accent" value={config.accentColor} onChange={(v) => onChange("accentColor", v)} />
        </div>
      </Group>

      <MediaPickerDialog
        open={isLogoPickerOpen}
        selectedUrl={config.logoUrl || null}
        onClose={() => setIsLogoPickerOpen(false)}
        onSelect={selectLogo}
      />
    </>
  );
}

function PromoSection({ config, onChange }: { config: HeaderConfig; onChange: OnChange }) {
  return (
    <>
      <Group title="Affichage">
        <div className={styles.toggleList}>
          <ToggleRow
            label="Afficher la barre du haut"
            help="La bande au-dessus du logo, avec le téléphone et les liens d'aide."
            checked={config.showUtilityBar}
            onChange={(checked) => onChange("showUtilityBar", checked)}
          />
        </div>
      </Group>
      <Group title="Contact" help="Affichés dans la barre du haut et dans le menu mobile.">
        <div className={styles.formGrid}>
          <TextField label="E-mail" type="email" value={config.contactEmail} onChange={(v) => onChange("contactEmail", v)} autoComplete="email" />
          <TextField label="Téléphone" type="tel" value={config.phoneNumber} onChange={(v) => onChange("phoneNumber", v)} autoComplete="tel" />
        </div>
      </Group>
      <Group title="Horaires d'ouverture">
        <div className={styles.formGrid}>
          <TextField label="Jours" value={config.openingDays} onChange={(v) => onChange("openingDays", v)} autoComplete="off" helpText="Par exemple : Lun-Sam" />
          <span />
          <TextField label="Ouverture" value={config.openingTime} onChange={(v) => onChange("openingTime", v)} autoComplete="off" helpText="Par exemple : 8h ou 08:00" />
          <TextField label="Fermeture" value={config.closingTime} onChange={(v) => onChange("closingTime", v)} autoComplete="off" helpText="Par exemple : 18h ou 18:00" />
        </div>
      </Group>
    </>
  );
}

function LinksSection({
  intro,
  links,
  onAdd,
  onRemove,
  onMove,
  onChange,
}: {
  intro: string;
  links: HeaderLink[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (index: number, offset: -1 | 1) => void;
  onChange: (index: number, key: keyof HeaderLink, value: string) => void;
}) {
  return (
    <Group title="Liens" help={`${intro} L'ordre ci-dessous est l'ordre d'affichage.`}>
      {links.length === 0 ? (
        <div className={styles.empty}>Aucun lien pour le moment. Ajoutez-en un pour commencer.</div>
      ) : (
        <div className={styles.linkList}>
          {links.map((link, index) => (
            <div key={index} className={styles.linkRow}>
              <TextField
                label="Texte du lien"
                value={link.label}
                onChange={(value) => onChange(index, "label", value)}
                autoComplete="off"
              />
              <TextField
                label="Adresse"
                value={link.url}
                onChange={(value) => onChange(index, "url", value)}
                autoComplete="off"
                placeholder="/contact"
              />
              <div className={styles.linkActions}>
                <Button icon={ArrowUpIcon} accessibilityLabel={`Monter ${link.label || "le lien"}`} disabled={index === 0} onClick={() => onMove(index, -1)} />
                <Button icon={ArrowDownIcon} accessibilityLabel={`Descendre ${link.label || "le lien"}`} disabled={index === links.length - 1} onClick={() => onMove(index, 1)} />
                <Button icon={DeleteIcon} tone="critical" accessibilityLabel={`Supprimer ${link.label || "le lien"}`} disabled={links.length <= 1} onClick={() => onRemove(index)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div>
        <Button icon={PlusIcon} onClick={onAdd}>Ajouter un lien</Button>
      </div>
    </Group>
  );
}

function ActionsSection({ config, onChange }: { config: HeaderConfig; onChange: OnChange }) {
  return (
    <Group title="Boutons de l'en-tête" help="Activez seulement ce dont vos clients ont besoin.">
      <div className={styles.toggleList}>
        <ToggleRow label="Champ de recherche" help="Permet de chercher une machine, une marque ou une référence." checked={config.showSearch} onChange={(c) => onChange("showSearch", c)} />
        <ToggleRow label="Compte client" help="Lien « Se connecter » ou « Mon compte »." checked={config.showAccount} onChange={(c) => onChange("showAccount", c)} />
        <ToggleRow label="Panier" help="Bouton panier avec le total en cours." checked={config.showCart} onChange={(c) => onChange("showCart", c)} />
        <ToggleRow label="En-tête toujours visible" help="Reste en haut de l'écran quand on fait défiler la page." checked={config.sticky} onChange={(c) => onChange("sticky", c)} />
      </div>
    </Group>
  );
}

/* -------------------------------------------------------------------------- */
/* Fields                                                                     */
/* -------------------------------------------------------------------------- */

function ToggleRow({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={styles.toggle} onClick={() => onChange(!checked)}>
      <span>
        <span className={styles.toggleName}>{label}</span>
        <span className={styles.toggleHelp}>{help}</span>
      </span>
      <span className={styles.switch} aria-hidden="true" />
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={styles.colorTile}>
      <span className={styles.colorSwatch} style={{ background: value }} />
      <span>
        <span className={styles.colorName}>{label}</span>
        <span className={styles.colorValue}>{value}</span>
      </span>
      <input className={styles.colorInput} type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.rangeField}>
      <span className={styles.rangeHead}>
        {label}
        <span className={styles.rangeValue}>{`${value}${suffix}`}</span>
      </span>
      <input className={styles.rangeInput} type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Preview                                                                    */
/* -------------------------------------------------------------------------- */

/** A part of the preview that opens its own settings when clicked. */
function Zone({
  id,
  label,
  activeTab,
  onSelect,
  children,
}: {
  id: TabId;
  label: string;
  activeTab: TabId;
  onSelect: (id: TabId) => void;
  children: React.ReactNode;
}) {
  const isActive = activeTab === id;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Modifier : ${label}`}
      aria-pressed={isActive}
      className={`${styles.zone} ${isActive ? styles.zoneActive : ""}`}
      onClick={() => onSelect(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(id);
        }
      }}>
      <span className={styles.zoneTag}>{label}</span>
      {children}
    </div>
  );
}

function HeaderPreview({
  config,
  activeTab,
  onSelect,
}: {
  config: HeaderConfig;
  activeTab: TabId;
  onSelect: (id: TabId) => void;
}) {
  const cssVars = {
    "--header-bg": config.backgroundColor,
    "--utility-bg": config.utilityColor,
    "--header-text": config.textColor,
    "--header-utility-text": config.utilityTextColor,
    "--header-accent": config.accentColor,
    "--header-height": `${config.headerHeight}px`,
    "--logo-width": `${config.logoWidth}px`,
  } as React.CSSProperties;
  // Editing the mobile menu highlights the same zone as the desktop navigation.
  const navTab: TabId = activeTab === "mobile" ? "mobile" : "desktop";

  return (
    <div className={styles.previewStage}>
      <div className={styles.storeHeader} style={cssVars}>
        <div className={styles.topStripe} aria-hidden="true" />
        {config.showUtilityBar ? (
          <Zone id="promo" label="Barre du haut" activeTab={activeTab} onSelect={onSelect}>
            <div className={styles.utilityBar}>
              <span />
              <span className={styles.utilityMeta}>
                <span><Phone size={13} />{config.phoneNumber}</span>
                <span>Nous contacter</span>
                <span>Aide &amp; SAV</span>
              </span>
            </div>
          </Zone>
        ) : null}

        <div className={styles.mainRow}>
          <Zone id="appearance" label="Logo et couleurs" activeTab={activeTab} onSelect={onSelect}>
            <div className={styles.logo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={config.logoUrl || "/logo.png"} alt={config.logoAlt} />
            </div>
          </Zone>
          <Zone id="actions" label="Recherche et panier" activeTab={activeTab} onSelect={onSelect}>
            <div className={styles.searchControl}>
              <span className={styles.storeSelector}>TOUT LE MAGASIN <ChevronDown size={12} /></span>
              {config.showSearch ? (
                <span className={styles.searchBox}>
                  Rechercher une machine, une marque, une référence...
                  <Search size={15} />
                </span>
              ) : null}
              {config.showAccount ? (
                <span className={styles.accountPreview}>
                  <User size={17} /> Bonjour<br /><strong>SE CONNECTER</strong>
                </span>
              ) : null}
              {config.showCart ? (
                <span className={styles.cartPreview}>
                  <ShoppingBag size={16} /> Panier<br /><strong>0,00 €</strong>
                </span>
              ) : null}
            </div>
          </Zone>
        </div>

        <Zone id={navTab} label={navTab === "mobile" ? "Menu mobile" : "Menu ordinateur"} activeTab={activeTab} onSelect={onSelect}>
          <div className={styles.navBar}>
            <div className={styles.navLinks}>
              {config.links.slice(0, 5).map((link, index) => (
                <span key={index} className={styles.navLink}>
                  {link.label.trim() || "Lien"}
                </span>
              ))}
            </div>
            <span>Livraison France &amp; Europe</span>
          </div>
        </Zone>
      </div>
    </div>
  );
}

/** Mock-up of the menu that opens on a phone. */
function DrawerPreview({ config }: { config: HeaderConfig }) {
  return (
    <div className={styles.drawerWrap} aria-label="Aperçu du menu mobile">
      <div className={styles.drawer}>
        <div className={styles.drawerTop}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={config.logoUrl || "/logo.png"} alt={config.logoAlt} />
          <X size={18} aria-hidden="true" />
        </div>
        <div className={styles.drawerLinks}>
          {config.mobileLinks.map((link, index) => (
            <span key={index}>{link.label.trim() || "Lien"}</span>
          ))}
        </div>
        <div className={styles.drawerFoot}>
          {config.phoneNumber}
          <br />
          {config.openingDays} {config.openingTime}–{config.closingTime}
        </div>
      </div>
    </div>
  );
}

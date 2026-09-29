"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  Divider,
  InlineStack,
  Text,
  TextField,
} from "@shopify/polaris";
import {
  DeleteIcon as PolarisDeleteIcon,
  PlusIcon as PolarisPlusIcon,
  SaveIcon,
} from "@shopify/polaris-icons";
import {
  AlignJustify,
  BadgePercent,
  ChevronDown,
  Eye,
  Menu,
  Palette,
  Phone,
  Search,
  ShoppingBag,
  User,
} from "lucide-react";

import {
  getAdminHeaderSettings,
  updateHeaderSettings,
} from "@/lib/api/header";
import {
  MediaPickerDialog,
  type MediaItem,
} from "@/components/admin/media-picker-dialog";
import {
  DEFAULT_HEADER_CONFIG,
  normalizeHeaderConfig,
  type HeaderConfig,
  type HeaderLink,
} from "@/lib/header-config";
import styles from "./header.module.css";

type TabId =
  | "appearance"
  | "promo"
  | "desktop"
  | "mobile"
  | "actions";

const TABS: Array<{ id: TabId; label: string; icon: typeof Palette }> = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "promo", label: "Top bar", icon: BadgePercent },
  { id: "desktop", label: "Desktop menu", icon: AlignJustify },
  { id: "mobile", label: "Mobile menu", icon: Menu },
  { id: "actions", label: "Cart and search", icon: ShoppingBag },
];

const EMPTY_LINK: HeaderLink = { label: "New link", url: "/" };

function compactLinkLabel(link: HeaderLink) {
  return link.label.trim() || "Link";
}

export default function AdminHeaderAppearancePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("appearance");
  const [draftConfig, setDraftConfig] = useState<HeaderConfig | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const headerQuery = useQuery({
    queryKey: ["admin-header-settings"],
    queryFn: getAdminHeaderSettings,
  });

  const config = draftConfig ?? headerQuery.data ?? DEFAULT_HEADER_CONFIG;

  const updateConfig = <Key extends keyof HeaderConfig>(
    key: Key,
    value: HeaderConfig[Key],
  ) => {
    setDraftConfig((current) => ({
      ...(current ?? config),
      [key]: value,
    }));
  };

  const updateLink = (
    collection: "links" | "mobileLinks",
    index: number,
    key: keyof HeaderLink,
    value: string,
  ) => {
    setDraftConfig((current) => {
      const base = current ?? config;
      return {
        ...base,
        [collection]: base[collection].map((item, itemIndex) =>
          itemIndex === index ? { ...item, [key]: value } : item,
        ),
      };
    });
  };

  const addLink = (collection: "links" | "mobileLinks") => {
    setDraftConfig((current) => {
      const base = current ?? config;
      return {
        ...base,
        [collection]: [...base[collection], EMPTY_LINK],
      };
    });
  };

  const removeLink = (collection: "links" | "mobileLinks", index: number) => {
    setDraftConfig((current) => {
      const base = current ?? config;
      return {
        ...base,
        [collection]: base[collection].filter((_, itemIndex) => itemIndex !== index),
      };
    });
  };

  const publishConfig = async () => {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const saved = await updateHeaderSettings(normalizeHeaderConfig(config));
      setDraftConfig(saved);
      queryClient.setQueryData(["admin-header-settings"], saved);
      queryClient.setQueryData(["storefront-header-settings"], saved);
      setNotice("Header saved and published on the storefront.");
      await queryClient.invalidateQueries({
        queryKey: ["storefront-header-settings"],
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Impossible de publier le header.",
      );
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = () => {
    setDraftConfig(DEFAULT_HEADER_CONFIG);
    setNotice("Header reset locally. Save and publish to apply it on the storefront.");
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <BlockStack gap="100">
          <Text as="h1" variant="headingLg">
            Header configuration
          </Text>
          <Text as="p" tone="subdued">
            Edit the fixed storefront header shown in the live preview.
          </Text>
        </BlockStack>
        <InlineStack gap="200">
          <Badge tone={config.sticky ? "success" : undefined}>
            {config.sticky ? "Sticky" : "Static"}
          </Badge>
          <Badge tone="info">Fixed storefront header</Badge>
        </InlineStack>
      </div>

      {notice ? (
        <Banner tone="success" title={notice} onDismiss={() => setNotice(null)} />
      ) : null}
      {error ? (
        <Banner tone="critical" title={error} onDismiss={() => setError(null)} />
      ) : null}
      {headerQuery.isError ? (
        <Banner
          tone="warning"
          title="Header settings could not be loaded. The default header is shown for editing."
        />
      ) : null}

      <nav className={styles.tabs} aria-label="Header configuration sections">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={17} strokeWidth={1.9} aria-hidden />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className={styles.workspace}>
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="400">
              {activeTab === "appearance" ? (
                <AppearanceSection config={config} onChange={updateConfig} />
              ) : null}

              {activeTab === "promo" ? (
                <PromoSection config={config} onChange={updateConfig} />
              ) : null}

              {activeTab === "desktop" ? (
                <LinksSection
                  title="Desktop menu"
                  description="Edit the primary navigation shown on wider screens."
                  links={config.links}
                  onAdd={() => addLink("links")}
                  onRemove={(index) => removeLink("links", index)}
                  onChange={(index, key, value) => updateLink("links", index, key, value)}
                />
              ) : null}

              {activeTab === "mobile" ? (
                <LinksSection
                  title="Mobile menu"
                  description="Set the links shown in the drawer on small screens."
                  links={config.mobileLinks}
                  onAdd={() => addLink("mobileLinks")}
                  onRemove={(index) => removeLink("mobileLinks", index)}
                  onChange={(index, key, value) =>
                    updateLink("mobileLinks", index, key, value)
                  }
                />
              ) : null}

              {activeTab === "actions" ? (
                <ActionsSection config={config} onChange={updateConfig} />
              ) : null}
            </BlockStack>
          </Card>

        </BlockStack>

        <Card>
          <div className={styles.previewShell}>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Live preview
                  </Text>
                  <Text as="p" tone="subdued">
                    Preview updates as you edit the selected header.
                  </Text>
                </BlockStack>
                <Eye size={20} strokeWidth={1.9} aria-hidden />
              </InlineStack>
              <HeaderPreview config={config} />
              <Divider />
              <InlineStack gap="200" align="end">
                <Button onClick={resetConfig}>Reset</Button>
                <Button
                  icon={SaveIcon}
                  variant="primary"
                  onClick={publishConfig}
                  loading={saving}
                  disabled={headerQuery.isLoading}
                >
                  Save and publish
                </Button>
              </InlineStack>
            </BlockStack>
          </div>
        </Card>
      </div>
    </div>
  );
}

function AppearanceSection({
  config,
  onChange,
}: {
  config: HeaderConfig;
  onChange: <Key extends keyof HeaderConfig>(
    key: Key,
    value: HeaderConfig[Key],
  ) => void;
}) {
  const [isLogoPickerOpen, setIsLogoPickerOpen] = useState(false);

  const selectLogo = (item: MediaItem) => {
    if (item.fileType && !item.fileType.toLowerCase().startsWith("image/")) {
      return;
    }
    onChange("logoUrl", item.url);
    if (item.altText?.trim()) {
      onChange("logoAlt", item.altText.trim());
    }
    setIsLogoPickerOpen(false);
  };

  return (
    <>
      <BlockStack gap="300">
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">
            Appearance
          </Text>
          <Text as="p" tone="subdued">
            Tune the logo, header height, and color system.
          </Text>
        </BlockStack>

        <div className={styles.logoPickerRow}>
          <div className={styles.logoPreviewBox}>
            {config.logoUrl.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logoUrl} alt={config.logoAlt || "Selected logo"} />
            ) : (
              <span>No logo selected</span>
            )}
          </div>
          <BlockStack gap="200">
            <Text as="p" variant="bodySm" fontWeight="semibold">
              Header logo
            </Text>
            <InlineStack gap="200">
              <Button onClick={() => setIsLogoPickerOpen(true)}>
                Choose from media
              </Button>
              {config.logoUrl.trim() ? (
                <Button tone="critical" onClick={() => onChange("logoUrl", "")}>
                  Remove logo
                </Button>
              ) : null}
            </InlineStack>
          </BlockStack>
        </div>

        <div className={styles.formGrid}>
          <TextField
            label="Logo URL"
            value={config.logoUrl}
            onChange={(value) => onChange("logoUrl", value)}
            autoComplete="off"
          />
          <TextField
            label="Logo alt text"
            value={config.logoAlt}
            onChange={(value) => onChange("logoAlt", value)}
            autoComplete="off"
          />
          <RangeField
            label="Logo width"
            value={config.logoWidth}
            min={72}
          max={300}
            suffix="px"
            onChange={(value) => onChange("logoWidth", value)}
          />
          <RangeField
            label="Header height"
            value={config.headerHeight}
            min={56}
            max={112}
            suffix="px"
            onChange={(value) => onChange("headerHeight", value)}
          />
          <ColorField
            label="Background color"
            value={config.backgroundColor}
            onChange={(value) => onChange("backgroundColor", value)}
          />
          <ColorField
            label="Utility bar color"
            value={config.utilityColor}
            onChange={(value) => onChange("utilityColor", value)}
          />
          <ColorField
            label="Utility text color"
            value={config.utilityTextColor}
            onChange={(value) => onChange("utilityTextColor", value)}
          />
          <ColorField
            label="Text color"
            value={config.textColor}
            onChange={(value) => onChange("textColor", value)}
          />
          <ColorField
            label="Accent color"
            value={config.accentColor}
            onChange={(value) => onChange("accentColor", value)}
          />
        </div>
      </BlockStack>

      <MediaPickerDialog
        open={isLogoPickerOpen}
        selectedUrl={config.logoUrl || null}
        onClose={() => setIsLogoPickerOpen(false)}
        onSelect={selectLogo}
      />
    </>
  );
}

function PromoSection({
  config,
  onChange,
}: {
  config: HeaderConfig;
  onChange: <Key extends keyof HeaderConfig>(
    key: Key,
    value: HeaderConfig[Key],
  ) => void;
}) {
  return (
    <BlockStack gap="300">
      <BlockStack gap="100">
          <Text as="h2" variant="headingMd">
            Top contact bar
        </Text>
        <Text as="p" tone="subdued">
          Configure the contact strip above the logo and search row.
        </Text>
      </BlockStack>
      <Checkbox
        label="Show top contact bar"
        checked={config.showUtilityBar}
        onChange={(checked) => onChange("showUtilityBar", checked)}
      />
      <Divider />
      <BlockStack gap="100">
        <Text as="h3" variant="headingSm">
          Contact and opening hours
        </Text>
        <Text as="p" tone="subdued">
          These values appear in the storefront utility bar and mobile menu.
        </Text>
      </BlockStack>
      <div className={styles.formGrid}>
        <TextField
          label="Email"
          type="email"
          value={config.contactEmail}
          onChange={(value) => onChange("contactEmail", value)}
          autoComplete="email"
        />
        <TextField
          label="Phone number"
          type="tel"
          value={config.phoneNumber}
          onChange={(value) => onChange("phoneNumber", value)}
          autoComplete="tel"
        />
        <TextField
          label="Opening days"
          value={config.openingDays}
          onChange={(value) => onChange("openingDays", value)}
          autoComplete="off"
          helpText="Example: Lun-Sam or Mon-Fri"
        />
        <TextField
          label="Opening time"
          value={config.openingTime}
          onChange={(value) => onChange("openingTime", value)}
          autoComplete="off"
          helpText="Example: 8h or 08:00"
        />
        <TextField
          label="Closing time"
          value={config.closingTime}
          onChange={(value) => onChange("closingTime", value)}
          autoComplete="off"
          helpText="Example: 18h or 18:00"
        />
      </div>
    </BlockStack>
  );
}

function LinksSection({
  title,
  description,
  links,
  onAdd,
  onRemove,
  onChange,
}: {
  title: string;
  description: string;
  links: HeaderLink[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, key: keyof HeaderLink, value: string) => void;
}) {
  return (
    <BlockStack gap="300">
      <InlineStack align="space-between" blockAlign="center">
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">
            {title}
          </Text>
          <Text as="p" tone="subdued">
            {description}
          </Text>
        </BlockStack>
        <Button icon={PolarisPlusIcon} onClick={onAdd}>
          Add link
        </Button>
      </InlineStack>
      <div className={styles.linkList}>
        {links.map((link, index) => (
          <div key={`${link.label}-${String(index)}`} className={styles.linkRow}>
            <TextField
              label="Label"
              value={link.label}
              onChange={(value) => onChange(index, "label", value)}
              autoComplete="off"
            />
            <TextField
              label="URL"
              value={link.url}
              onChange={(value) => onChange(index, "url", value)}
              autoComplete="off"
            />
            <Button
              icon={PolarisDeleteIcon}
              accessibilityLabel={`Remove ${compactLinkLabel(link)}`}
              onClick={() => onRemove(index)}
              disabled={links.length <= 1}
            />
          </div>
        ))}
      </div>
    </BlockStack>
  );
}

function ActionsSection({
  config,
  onChange,
}: {
  config: HeaderConfig;
  onChange: <Key extends keyof HeaderConfig>(
    key: Key,
    value: HeaderConfig[Key],
  ) => void;
}) {
  return (
    <BlockStack gap="300">
      <BlockStack gap="100">
        <Text as="h2" variant="headingMd">
          Cart and search
        </Text>
        <Text as="p" tone="subdued">
          Decide which storefront actions appear in the header.
        </Text>
      </BlockStack>
      <Checkbox
        label="Show search field"
        checked={config.showSearch}
        onChange={(checked) => onChange("showSearch", checked)}
      />
      <Checkbox
        label="Show cart action"
        checked={config.showCart}
        onChange={(checked) => onChange("showCart", checked)}
      />
      <Checkbox
        label="Show account action"
        checked={config.showAccount}
        onChange={(checked) => onChange("showAccount", checked)}
      />
      <Checkbox
        label="Sticky header"
        checked={config.sticky}
        onChange={(checked) => onChange("sticky", checked)}
      />
    </BlockStack>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.fieldGroup}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.colorControl}>
        <input
          className={styles.colorInput}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
        />
        <span className={styles.colorValue}>{value}</span>
      </span>
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
    <label className={styles.fieldGroup}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.rangeControl}>
        <input
          className={styles.rangeInput}
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
        />
        <span className={styles.rangeValue}>{`${value}${suffix}`}</span>
      </span>
    </label>
  );
}

function HeaderPreview({ config }: { config: HeaderConfig }) {
  const cssVars = {
    "--header-bg": config.backgroundColor,
    "--utility-bg": config.utilityColor,
    "--header-text": config.textColor,
    "--header-utility-text": config.utilityTextColor,
    "--header-accent": config.accentColor,
    "--header-height": `${config.headerHeight}px`,
    "--logo-width": `${config.logoWidth}px`,
  } as React.CSSProperties;

  return (
    <div className={styles.previewStage}>
      <div className={styles.storeHeader} style={cssVars}>
        <div className={styles.topStripe} aria-hidden="true" />
        {config.showUtilityBar ? (
          <div className={styles.utilityBar}>
            <span />
            <span className={styles.utilityMeta}>
              <span><Phone size={13} />{config.phoneNumber}</span>
              <span>Nous contacter</span>
              <span>Aide &amp; SAV</span>
            </span>
          </div>
        ) : null}

        <div className={styles.mainRow}>
          <div className={styles.logo}>
            <img src={config.logoUrl || "/logo.png"} alt={config.logoAlt} />
          </div>
          <div className={styles.searchControl}>
            <span className={styles.storeSelector}>TOUT LE MAGASIN <ChevronDown size={12} /></span>
            {config.showSearch ? (
              <span className={styles.searchBox}>
                Rechercher une machine, une marque, une reference...
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
        </div>

        <div className={styles.navBar}>
          <PreviewNav links={config.links} />
          <span>Livraison France &amp; Europe</span>
        </div>
      </div>
    </div>
  );
}

function PreviewNav({ links }: { links: HeaderLink[] }) {
  return (
    <div className={styles.navLinks}>
      {links.slice(0, 5).map((link) => (
        <span key={`${link.label}-${link.url}`} className={styles.navLink}>
          {compactLinkLabel(link)}
        </span>
      ))}
    </div>
  );
}


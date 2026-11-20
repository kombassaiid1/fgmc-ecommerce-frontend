"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Puck, type Data, type Overrides } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import {
  Loader2,
  PackageOpen,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import "./puck-theme.css";
import { BlockIcon } from "./block-icons";
import { BuilderShell, TabbedFields } from "./builder-shell";
import { isUsableBuilderPage } from "@/lib/builder-blocks";
import { markMigrated, migrateSavedData } from "./migrate-data";
import { HOME_SLUG, type PageSettings, getPage, savePage } from "./pages-api";
import { PagesDialog } from "./pages-dialog";
import { blockLabel, puckConfig, initialData } from "./puck-config";

const DRAFT_KEY = "page-builder:home:draft:v2";
const PUBLISHED_KEY = "page-builder:home:published:v2";

const VIEWPORTS = [
  {
    width: 390,
    height: "auto" as const,
    label: "Mobile",
    icon: "Smartphone" as const,
  },
  {
    width: 820,
    height: "auto" as const,
    label: "Tablet",
    icon: "Tablet" as const,
  },
  {
    width: "100%" as const,
    height: "auto" as const,
    label: "Desktop",
    icon: "Monitor" as const,
  },
];

const QueryContext = createContext<{
  query: string;
  setQuery: (q: string) => void;
}>({
  query: "",
  setQuery: () => {},
});

function WidgetPanel({ children }: { children: React.ReactNode }) {
  const { query, setQuery } = useContext(QueryContext);
  const isEmpty = Object.keys(puckConfig.components).length === 0;

  return (
    <div className="pb-panel">
      <div className="pb-search">
        <Search className="size-4" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un widget…"
          aria-label="Rechercher un widget"
        />
      </div>
      {isEmpty ? (
        <div className="pb-empty">
          <PackageOpen
            className="size-8"
            aria-hidden="true"
            strokeWidth={1.4}
          />
          <p className="pb-empty-title">Aucun widget</p>
          <p className="pb-empty-text">
            Les widgets que vous ajouterez apparaîtront ici.
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function WidgetTile({
  children,
  name,
}: {
  children: React.ReactNode;
  name: string;
}) {
  const { query } = useContext(QueryContext);
  const label = blockLabel(name).toLowerCase();
  const needle = query.trim().toLowerCase();

  if (needle && !label.includes(needle)) return <></>;

  return (
    <div className="pb-tile">
      <BlockIcon name={name} className="pb-tile-icon" />
      {children}
    </div>
  );
}

// Stable reference: the search term travels through context, so the editor
// never remounts (and the search input never loses focus) while typing.
const overrides: Partial<Overrides> = {
  components: WidgetPanel,
  drawerItem: WidgetTile,
  fields: TabbedFields,
};

// Open on Desktop. Without this Puck starts on its own default width, which
// doesn't match any of the device buttons.
const INITIAL_UI = {
  viewports: {
    current: { width: "100%" as const, height: "auto" as const },
    controlsVisible: true,
    options: VIEWPORTS,
  },
};

function readStored(key: string): Data | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Data) : null;
  } catch {
    return null;
  }
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background px-6 text-center text-muted-foreground">{children}</div>;
}

export function PageBuilderClient({ slug }: { slug: string }) {
  const router = useRouter();
  const isHome = slug === HOME_SLUG;
  const [data, setData] = useState<Data | null>(null);
  const [settings, setSettings] = useState<PageSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [editorKey, setEditorKey] = useState(0);
  const [query, setQuery] = useState("");
  const [pagesOpen, setPagesOpen] = useState(false);
  // Nothing is saved until the page has been read: a failed read must never overwrite the stored page.
  const [canSave, setCanSave] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await getPage(slug);
        if (cancelled) return;
        setSettings({ slug: page.slug, title: page.title, published: page.published, metaTitle: page.metaTitle, metaDescription: page.metaDescription, ogImage: page.ogImage });

        if (!isHome) {
          setData(Array.isArray(page.data?.content) ? page.data : initialData);
          setCanSave(true);
          return;
        }

        // The front page also takes over the draft this browser kept before pages were saved on the server.
        let loaded = migrateSavedData(isUsableBuilderPage(page.data) ? page.data : null);
        let imported = false;
        if (!loaded.data) {
          loaded = migrateSavedData(readStored(DRAFT_KEY) ?? readStored(PUBLISHED_KEY));
          imported = Boolean(loaded.data);
        }
        markMigrated();
        setData(loaded.data ?? initialData);
        setCanSave(true);
        if (loaded.data && (loaded.changed || imported)) {
          await savePage(slug, { data: loaded.data });
          if (imported && !cancelled) toast.success("Brouillon de ce navigateur enregistré en ligne.");
        }
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Impossible de charger la page.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, isHome]);

  // Every change is saved (debounced). On a published page it is online straight away.
  const [pending, setPending] = useState<Data | null>(null);
  useEffect(() => {
    if (!pending || !canSave) return;
    const id = window.setTimeout(() => {
      savePage(slug, { data: pending })
        .then(() => setSaved(true))
        .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible."));
    }, 600);
    return () => window.clearTimeout(id);
  }, [pending, canSave, slug]);

  const handleChange = useCallback((next: Data) => {
    setSaved(false);
    setPending(next);
  }, []);

  /** The Publier button: saves now, and puts a draft page online. */
  const handlePublish = useCallback(
    (next: Data) => {
      if (!canSave) {
        toast.error("La page n'a pas pu être chargée : rechargez avant d'enregistrer.");
        return;
      }
      const publishing = !isHome && settings !== null && !settings.published;
      savePage(slug, publishing ? { data: next, published: true } : { data: next })
        .then(() => {
          setSaved(true);
          setPending(null);
          if (publishing) setSettings((current) => (current ? { ...current, published: true } : current));
          toast.success(publishing ? "Page publiée : elle est en ligne." : isHome || settings?.published ? "Page enregistrée : elle est en ligne." : "Brouillon enregistré.");
        })
        .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible."));
    },
    [canSave, isHome, settings, slug],
  );

  const handleReset = useCallback(() => {
    if (!window.confirm("Vider la page ? Tous ses blocs seront supprimés.")) return;
    setData(initialData);
    setEditorKey((k) => k + 1);
    setPending(initialData);
    setSaved(false);
  }, []);

  const openPage = useCallback((next: string) => router.push(`/admin_ben/page-builder?page=${encodeURIComponent(next)}`), [router]);

  if (loadError) {
    return (
      <Screen>
        <p className="text-base font-semibold text-foreground">{loadError}</p>
        <Link href="/admin_ben/page-builder" className="text-sm font-semibold text-primary underline underline-offset-4">Ouvrir la page d’accueil</Link>
      </Screen>
    );
  }

  if (!data || !settings) {
    return (
      <Screen>
        <Loader2 className="size-6 animate-spin" aria-label="Chargement" />
      </Screen>
    );
  }

  return (
    <QueryContext.Provider value={{ query, setQuery }}>
      <div className="pb-root fixed inset-0 z-50 bg-background">
        <Puck
          key={editorKey}
          config={puckConfig}
          data={data}
          height="100dvh"
          viewports={VIEWPORTS}
          ui={INITIAL_UI}
          overrides={overrides}
          onChange={handleChange}
          onPublish={handlePublish}
        >
          <BuilderShell
            saved={saved}
            page={settings}
            onManagePages={() => setPagesOpen(true)}
            onPublish={(d) => handlePublish(d as Data)}
            onReset={handleReset}
          />
        </Puck>
        {pagesOpen ? (
          <PagesDialog
            current={settings}
            canSwitch={saved}
            onClose={() => setPagesOpen(false)}
            onOpenPage={(next) => {
              setPagesOpen(false);
              if (next !== slug) openPage(next);
            }}
            onSettingsSaved={(next) => setSettings({ slug: next.slug, title: next.title, published: next.published, metaTitle: next.metaTitle, metaDescription: next.metaDescription, ogImage: next.ogImage })}
          />
        ) : null}
      </div>
    </QueryContext.Provider>
  );
}

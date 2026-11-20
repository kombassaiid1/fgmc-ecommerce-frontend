"use client";

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

const PAGE_URL = "/frontend-api/admin/pages";
const SLUG = "home";

async function savePage(data: Data) {
  const response = await fetch(PAGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: SLUG, title: "Accueil", data }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    throw new Error(Array.isArray(body.message) ? body.message.join(" ") : body.message || "Enregistrement impossible.");
  }
}

export function PageBuilderClient() {
  const [data, setData] = useState<Data | null>(null);
  const [saved, setSaved] = useState(true);
  const [editorKey, setEditorKey] = useState(0);
  const [query, setQuery] = useState("");
  // Nothing is saved until the page has been read: a failed read must never overwrite the stored page.
  const [canSave, setCanSave] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${PAGE_URL}?slug=${SLUG}`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const body = (await response.json()) as { data?: Data };
        let page = migrateSavedData(isUsableBuilderPage(body.data) ? body.data : null);
        let imported = false;
        if (!page.data) {
          // Nothing in the database yet: take the draft this browser kept before pages were saved there.
          page = migrateSavedData(readStored(DRAFT_KEY) ?? readStored(PUBLISHED_KEY));
          imported = Boolean(page.data);
        }
        markMigrated();
        if (cancelled) return;
        setData(page.data ?? initialData);
        setCanSave(true);
        if (page.data && (page.changed || imported)) {
          await savePage(page.data);
          if (imported && !cancelled) toast.success("Brouillon de ce navigateur enregistré en ligne.");
        }
      } catch {
        if (cancelled) return;
        toast.error("Impossible de charger la page : modifications désactivées. Rechargez la page.");
        setData(initialData);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Every change is saved (debounced) and goes live: there is no separate draft.
  const [pending, setPending] = useState<Data | null>(null);
  useEffect(() => {
    if (!pending || !canSave) return;
    const id = window.setTimeout(() => {
      savePage(pending)
        .then(() => setSaved(true))
        .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible."));
    }, 600);
    return () => window.clearTimeout(id);
  }, [pending, canSave]);

  const handleChange = useCallback((next: Data) => {
    setSaved(false);
    setPending(next);
  }, []);

  const handlePublish = useCallback(
    (next: Data) => {
      if (!canSave) {
        toast.error("La page n'a pas pu être chargée : rechargez avant d'enregistrer.");
        return;
      }
      savePage(next)
        .then(() => {
          setSaved(true);
          setPending(null);
          toast.success("Page enregistrée : elle est en ligne.");
        })
        .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible."));
    },
    [canSave],
  );

  const handleReset = useCallback(() => {
    if (!window.confirm("Vider la page ? La page d'accueil d'origine s'affichera à la place.")) return;
    setData(initialData);
    setEditorKey((k) => k + 1);
    setPending(initialData);
    setSaved(false);
  }, []);

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-label="Chargement" />
      </div>
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
            onPublish={(d) => handlePublish(d as Data)}
            onReset={handleReset}
          />
        </Puck>
      </div>
    </QueryContext.Provider>
  );
}

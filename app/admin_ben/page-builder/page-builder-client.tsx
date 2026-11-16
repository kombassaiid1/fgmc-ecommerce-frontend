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

function writeStored(key: string, data: Data) {
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    toast.error("Impossible d'enregistrer localement.");
  }
}

export function PageBuilderClient() {
  const [data, setData] = useState<Data | null>(null);
  const [saved, setSaved] = useState(true);
  const [editorKey, setEditorKey] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    // Draft lives in localStorage until the backend is wired up.
    // Blocks saved before a default changed are updated once, and saved back.
    const draft = migrateSavedData(readStored(DRAFT_KEY));
    const published = migrateSavedData(readStored(PUBLISHED_KEY));
    if (draft.changed && draft.data) writeStored(DRAFT_KEY, draft.data);
    if (published.changed && published.data) writeStored(PUBLISHED_KEY, published.data);
    markMigrated();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(draft.data ?? published.data ?? initialData);
  }, []);

  // Autosave the draft (debounced) on every change.
  const [pending, setPending] = useState<Data | null>(null);
  useEffect(() => {
    if (!pending) return;
    const id = window.setTimeout(() => {
      writeStored(DRAFT_KEY, pending);
      setSaved(true);
    }, 600);
    return () => window.clearTimeout(id);
  }, [pending]);

  const handleChange = useCallback((next: Data) => {
    setSaved(false);
    setPending(next);
  }, []);

  const handlePublish = useCallback((next: Data) => {
    writeStored(PUBLISHED_KEY, next);
    writeStored(DRAFT_KEY, next);
    setSaved(true);
    toast.success("Page publiée (stockage local).");
  }, []);

  const handleReset = useCallback(() => {
    if (!window.confirm("Réinitialiser la page au modèle de départ ?")) return;
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setData(initialData);
    setEditorKey((k) => k + 1);
    setSaved(true);
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

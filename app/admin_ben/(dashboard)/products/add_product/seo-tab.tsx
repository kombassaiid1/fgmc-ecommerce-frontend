"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Text, TextField } from "@shopify/polaris";
import { ChevronDown, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { generateProductSeo, validateProductSeo, type ProductSeoGenerationInput, type SeoValidationResult } from "@/lib/api/seo";
import { applyProductSeoProposal, createSingleFlightAction, type ProductSeoCallbacks } from "@/lib/api/seo-generation-contract";

export type SeoTabProps = {
  productId?: string;
  title: string;
  slug: string;
  /** HTML description */
  description: string;
  /** HTML short description */
  shortDescription: string;
  imageCount: number;
  metaTitle: string;
  metaDescription: string;
  /** Stored in metaKeywords; the first comma-separated entry is the focus keyphrase. */
  keyphrase: string;
  onMetaTitleChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
  onKeyphraseChange: (value: string) => void;
  onSlugChange: (value: string) => void;
};

type Level = "good" | "ok" | "bad";
type Check = { id: string; level: Level; text: string };

const TITLE_MAX = 60;
const TITLE_MIN = 30;
const DESC_MAX = 156;
const DESC_MIN = 120;

const levelDot: Record<Level, string> = {
  good: "bg-green-500",
  ok: "bg-orange-400",
  bad: "bg-red-500",
};
const levelLabel: Record<Level, string> = {
  good: "Bon",
  ok: "À améliorer",
  bad: "Problème",
};

function norm(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(html: string) {
  return html
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, "$&\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function Dot({ level }: { level: Level }) {
  return (
    <span
      aria-label={levelLabel[level]}
      className={`inline-block size-3 shrink-0 rounded-full ${levelDot[level]}`}
    />
  );
}

function LengthBar({ value, min, max }: { value: number; min: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color =
    value === 0
      ? "bg-slate-300"
      : value > max
        ? "bg-red-500"
        : value >= min
          ? "bg-green-500"
          : "bg-orange-400";
  return (
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Section({
  title,
  checks,
  level,
  defaultOpen = true,
}: {
  title: string;
  checks: Check[];
  level: Level;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const order: Level[] = ["bad", "ok", "good"];
  const groupLabel: Record<Level, string> = {
    bad: "Problèmes",
    ok: "Améliorations",
    good: "Bons résultats",
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left"
      >
        <Dot level={level} />
        <span className="flex-1 text-sm font-semibold text-slate-900">{title}</span>
        <ChevronDown
          className={`size-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-slate-200 px-4 py-3">
          {order.map((lvl) => {
            const items = checks.filter((c) => c.level === lvl);
            if (!items.length) return null;
            return (
              <div key={lvl}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {groupLabel[lvl]} ({items.length})
                </p>
                <ul className="space-y-1.5">
                  {items.map((c) => (
                    <li key={c.id} className="flex items-start gap-2 text-sm text-slate-800">
                      <span
                        className={`mt-1.5 inline-block size-2.5 shrink-0 rounded-full ${levelDot[c.level]}`}
                        aria-hidden
                      />
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function SeoTab(props: SeoTabProps) {
  const {
    title,
    slug,
    shortDescription,
    metaTitle,
    metaDescription,
    keyphrase,
    onMetaTitleChange,
    onMetaDescriptionChange,
    onKeyphraseChange,
    onSlugChange,
  } = props;

  const [mode, setMode] = useState<"mobile" | "desktop">("mobile");
  const [host, setHost] = useState("votre-site.com");
  const [result, setResult] = useState<SeoValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const generateAction = useRef(createSingleFlightAction(async (
    input: ProductSeoGenerationInput,
    callbacks: ProductSeoCallbacks,
  ) => {
    setIsGenerating(true);
    try {
      const response = await generateProductSeo(input);
      applyProductSeoProposal(response, callbacks);
      toast.success("SEO généré avec l’IA.");
    } catch {
      toast.error("Impossible de générer le SEO. Réessayez.");
    } finally {
      setIsGenerating(false);
    }
  })).current;

  useEffect(() => {
    try {
      setHost(window.location.host || "votre-site.com");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let requestTimeout: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      setValidationError(null);
      requestTimeout = setTimeout(() => controller.abort(), 15_000);
      void validateProductSeo(
        {
          title: props.title,
          slug: props.slug,
          description: props.description,
          shortDescription: props.shortDescription,
          imageCount: props.imageCount,
          metaTitle: props.metaTitle,
          metaDescription: props.metaDescription,
          keyphrase: props.keyphrase,
        },
        controller.signal,
      )
        .then((next) => {
          if (active) setResult(next);
        })
        .catch((error: unknown) => {
          if (active && !(error instanceof DOMException && error.name === "AbortError")) {
            setValidationError(
              error instanceof Error ? error.message : "Impossible de valider le SEO.",
            );
          }
        })
        .finally(() => {
          if (requestTimeout) clearTimeout(requestTimeout);
        });
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
      if (requestTimeout) clearTimeout(requestTimeout);
      controller.abort();
    };
  }, [
    props.title,
    props.slug,
    props.description,
    props.shortDescription,
    props.imageCount,
    props.metaTitle,
    props.metaDescription,
    props.keyphrase,
  ]);

  const effTitle = result?.effTitle ?? (metaTitle.trim() || title.trim());
  const previewTitle = effTitle || "Titre du produit";
  const fallbackDesc = stripHtml(shortDescription).replace(/\s+/g, " ");
  const previewDesc = (metaDescription.trim() || fallbackDesc || "Ajoutez une méta description pour contrôler l'extrait affiché dans les résultats de recherche.");
  const cutTitle = previewTitle.length > TITLE_MAX ? `${previewTitle.slice(0, TITLE_MAX - 1).trimEnd()}…` : previewTitle;
  const cutDesc = previewDesc.length > DESC_MAX ? `${previewDesc.slice(0, DESC_MAX - 1).trimEnd()}…` : previewDesc;
  const focus = keyphrase.split(",")[0].trim();

  const handleGenerate = () => {
    const input: ProductSeoGenerationInput = {
      ...(props.productId ? { productId: props.productId } : {}),
      title: props.title,
      slug: props.slug,
      description: props.description,
      shortDescription: props.shortDescription,
      imageCount: props.imageCount,
      metaTitle: props.metaTitle,
      metaDescription: props.metaDescription,
      keyphrase: props.keyphrase,
    };
    void generateAction(input, {
      onKeyphraseChange,
      onMetaTitleChange,
      onSlugChange,
      onMetaDescriptionChange,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={handleGenerate} loading={isGenerating} disabled={isGenerating}>
          {isGenerating ? "Génération SEO..." : "✨ Générer avec l’IA"}
        </Button>
      </div>
      {/* Overall scores */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          {result ? (
            <>
              <Dot level={result.seoLevel} />
              <span className="text-sm text-slate-900">
                <strong>Analyse SEO :</strong> {levelLabel[result.seoLevel]}
              </span>
            </>
          ) : <span className="text-sm text-slate-600">Analyse SEO en cours…</span>}
        </div>
        {result?.readLevel ? (
          <div className="flex items-center gap-2">
              <Dot level={result.readLevel} />
            <span className="text-sm text-slate-900">
              <strong>Lisibilité :</strong> {levelLabel[result.readLevel]}
            </span>
          </div>
        ) : null}
      </div>

      {/* Focus keyphrase */}
      <div>
        <TextField
          label="Expression-clé principale"
          value={keyphrase}
          onChange={onKeyphraseChange}
          autoComplete="off"
          placeholder="ex : perceuse sans fil"
          helpText="Le mot ou l'expression pour lequel vous souhaitez que ce produit soit trouvé sur Google. Séparez d'éventuels mots-clés secondaires par des virgules : seul le premier est analysé."
        />
      </div>

      {/* Snippet preview */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Text as="h3" variant="headingSm">
            Aperçu Google
          </Text>
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300" role="group" aria-label="Type d'aperçu">
            {(
              [
                ["mobile", "Mobile", Smartphone],
                ["desktop", "Ordinateur", Monitor],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={() => setMode(key)}
                className={`flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === key ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`rounded-md border border-slate-200 bg-white p-4 font-sans ${
            mode === "mobile" ? "max-w-[360px]" : "max-w-[640px]"
          }`}
        >
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <span className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold uppercase text-slate-600">
              {host.charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm text-slate-900">{host}</div>
              <div className="truncate text-xs text-slate-600">
                https://{host} › {slug || "url-du-produit"}
              </div>
            </div>
          </div>
          <div className="mt-2 text-xl leading-snug text-blue-800">{cutTitle}</div>
          <div className="mt-1 text-sm leading-snug text-slate-700">
            {focus
              ? highlight(cutDesc, focus)
              : cutDesc}
          </div>
        </div>
      </div>

      {/* Editable fields */}
      <div className="space-y-4">
        <div>
          <TextField
            label="Titre SEO"
            value={metaTitle}
            onChange={onMetaTitleChange}
            autoComplete="off"
            placeholder={title}
            connectedRight={
              <Button onClick={() => onMetaTitleChange(title)} disabled={!title.trim()}>
                Utiliser le nom du produit
              </Button>
            }
          />
          <LengthBar value={effTitle.length} min={TITLE_MIN} max={TITLE_MAX} />
          <p className="mt-1 text-xs text-slate-600">
            {effTitle.length} / {TITLE_MAX} caractères
          </p>
        </div>

        <div>
          <TextField
            label="Slug (URL)"
            value={slug}
            onChange={onSlugChange}
            autoComplete="off"
          />
        </div>

        <div>
          <TextField
            label="Méta description"
            value={metaDescription}
            onChange={onMetaDescriptionChange}
            multiline={3}
            autoComplete="off"
          />
          <LengthBar value={metaDescription.trim().length} min={DESC_MIN} max={DESC_MAX} />
          <p className="mt-1 text-xs text-slate-600">
            {metaDescription.trim().length} / {DESC_MAX} caractères
          </p>
        </div>
      </div>

      {/* Analysis */}
      <div className="space-y-3">
        {validationError ? <p className="text-sm text-red-700" role="status">{validationError}</p> : null}
        {result ? <Section title="Analyse SEO" checks={[...result.keyChecks, ...result.contentChecks]} level={result.seoLevel} /> : null}
        {result && result.readLevel ? (
          <Section title="Analyse de lisibilité" checks={result.readChecks} level={result.readLevel} defaultOpen={false} />
        ) : null}
      </div>
    </div>
  );
}

function highlight(text: string, key: string) {
  const idx = norm(text).indexOf(norm(key));
  // norm() can change length only with exotic characters; guard to keep slicing safe.
  if (idx === -1 || norm(text).length !== text.length) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong>{text.slice(idx, idx + key.length)}</strong>
      {text.slice(idx + key.length)}
    </>
  );
}

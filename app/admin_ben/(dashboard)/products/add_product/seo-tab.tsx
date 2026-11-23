"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Text, TextField } from "@shopify/polaris";
import { ChevronDown, Monitor, Smartphone } from "lucide-react";

export type SeoTabProps = {
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

function words(text: string) {
  return text.split(/\s+/).filter(Boolean);
}

function slugifyKey(value: string) {
  return norm(value)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function analyze(p: SeoTabProps) {
  const keyphrase = p.keyphrase.split(",")[0].trim();
  const nKey = norm(keyphrase);
  const effTitle = p.metaTitle.trim() || p.title.trim();
  const descText = stripHtml(p.description);
  const shortText = stripHtml(p.shortDescription);
  const metaDesc = p.metaDescription.trim();
  const wordCount = words(descText).length;

  const keyChecks: Check[] = [];
  const contentChecks: Check[] = [];
  const readChecks: Check[] = [];

  // ---- Keyphrase ----
  if (!nKey) {
    keyChecks.push({
      id: "kp-set",
      level: "bad",
      text: "Aucune expression-clé n'est définie. Saisissez-en une pour obtenir l'analyse SEO complète.",
    });
  } else {
    const kpWords = words(nKey).length;
    keyChecks.push({
      id: "kp-len",
      level: kpWords <= 4 ? "good" : "ok",
      text:
        kpWords <= 4
          ? `Longueur de l'expression-clé : ${kpWords} mot${kpWords > 1 ? "s" : ""}. Parfait.`
          : `Votre expression-clé fait ${kpWords} mots. Essayez de la raccourcir à 4 mots maximum.`,
    });

    const titleN = norm(effTitle);
    const tIdx = titleN.indexOf(nKey);
    keyChecks.push({
      id: "kp-title",
      level: tIdx === -1 ? "bad" : tIdx <= 10 ? "good" : "ok",
      text:
        tIdx === -1
          ? "L'expression-clé n'apparaît pas dans le titre SEO."
          : tIdx <= 10
            ? "L'expression-clé apparaît au début du titre SEO. Bon travail !"
            : "L'expression-clé apparaît dans le titre SEO, mais pas au début. Essayez de la placer plus tôt.",
    });

    keyChecks.push({
      id: "kp-desc",
      level: !metaDesc ? "bad" : norm(metaDesc).includes(nKey) ? "good" : "bad",
      text: !metaDesc
        ? "Pas de méta description : impossible de vérifier l'expression-clé."
        : norm(metaDesc).includes(nKey)
          ? "L'expression-clé apparaît dans la méta description."
          : "L'expression-clé n'apparaît pas dans la méta description. Ajoutez-la.",
    });

    const slugKey = slugifyKey(keyphrase);
    keyChecks.push({
      id: "kp-slug",
      level: p.slug && slugKey && p.slug.includes(slugKey) ? "good" : "bad",
      text:
        p.slug && slugKey && p.slug.includes(slugKey)
          ? "L'expression-clé apparaît dans l'URL (slug)."
          : "L'expression-clé n'apparaît pas dans l'URL (slug).",
    });

    keyChecks.push({
      id: "kp-h1",
      level: norm(p.title).includes(nKey) ? "good" : "ok",
      text: norm(p.title).includes(nKey)
        ? "L'expression-clé apparaît dans le nom du produit."
        : "L'expression-clé n'apparaît pas dans le nom du produit.",
    });

    const intro = norm(
      (shortText || descText.split("\n").find((l) => l.trim()) || "").slice(0, 400),
    );
    keyChecks.push({
      id: "kp-intro",
      level: intro.includes(nKey) ? "good" : "bad",
      text: intro.includes(nKey)
        ? "L'expression-clé apparaît dans l'introduction."
        : "L'expression-clé n'apparaît pas dans le premier paragraphe. Mentionnez-la dès l'introduction.",
    });

    if (wordCount > 0) {
      const occurrences = norm(descText).split(nKey).length - 1;
      const density = (occurrences * kpWords * 100) / wordCount;
      const d = density.toFixed(1).replace(".", ",");
      keyChecks.push({
        id: "kp-density",
        level:
          occurrences === 0
            ? "bad"
            : density >= 0.5 && density <= 3
              ? "good"
              : "ok",
        text:
          occurrences === 0
            ? "L'expression-clé n'apparaît pas dans la description. Utilisez-la au moins une fois."
            : density > 3
              ? `Densité : ${d} % (${occurrences} fois). C'est trop : risque de sur-optimisation.`
              : density < 0.5
                ? `Densité : ${d} % (${occurrences} fois). C'est un peu faible, utilisez-la davantage.`
                : `Densité : ${d} % (${occurrences} fois). Parfait.`,
      });
    }
  }

  // ---- Content / technical SEO ----
  const tl = effTitle.length;
  contentChecks.push({
    id: "title-len",
    level: tl === 0 ? "bad" : tl > TITLE_MAX ? "ok" : tl < TITLE_MIN ? "ok" : "good",
    text:
      tl === 0
        ? "Le titre SEO est vide."
        : tl > TITLE_MAX
          ? `Le titre SEO fait ${tl} caractères : il sera tronqué (max. ${TITLE_MAX}).`
          : tl < TITLE_MIN
            ? `Le titre SEO est court (${tl} caractères). Visez entre ${TITLE_MIN} et ${TITLE_MAX}.`
            : "La largeur du titre SEO est idéale.",
  });

  contentChecks.push({
    id: "desc-len",
    level: !metaDesc
      ? "bad"
      : metaDesc.length > DESC_MAX || metaDesc.length < DESC_MIN
        ? "ok"
        : "good",
    text: !metaDesc
      ? "Aucune méta description. Les moteurs afficheront un extrait aléatoire de la page."
      : metaDesc.length > DESC_MAX
        ? `La méta description fait ${metaDesc.length} caractères : trop longue (max. ${DESC_MAX}).`
        : metaDesc.length < DESC_MIN
          ? `La méta description est courte (${metaDesc.length} caractères). Visez ${DESC_MIN} à ${DESC_MAX}.`
          : "La longueur de la méta description est idéale.",
  });

  contentChecks.push({
    id: "text-len",
    level: wordCount >= 300 ? "good" : wordCount >= 150 ? "ok" : "bad",
    text:
      wordCount >= 300
        ? `La description contient ${wordCount} mots. Très bien.`
        : wordCount >= 150
          ? `La description contient ${wordCount} mots. Idéalement au moins 300.`
          : `La description ne contient que ${wordCount} mot${wordCount > 1 ? "s" : ""}. Écrivez au moins 300 mots.`,
  });

  contentChecks.push({
    id: "images",
    level: p.imageCount > 0 ? "good" : "bad",
    text:
      p.imageCount > 0
        ? `${p.imageCount} image${p.imageCount > 1 ? "s" : ""} sur le produit. Bon travail !`
        : "Aucune image. Ajoutez au moins une image pour ce produit.",
  });

  const links = (p.description.match(/<a\s[^>]*href=/gi) || []).length;
  contentChecks.push({
    id: "links",
    level: links > 0 ? "good" : "ok",
    text:
      links > 0
        ? `${links} lien${links > 1 ? "s" : ""} dans la description.`
        : "Aucun lien dans la description. Ajoutez des liens vers d'autres pages ou catégories.",
  });

  if (wordCount > 300) {
    const heads = (p.description.match(/<h[2-4][\s>]/gi) || []).length;
    contentChecks.push({
      id: "headings",
      level: heads > 0 ? "good" : "ok",
      text:
        heads > 0
          ? "La description utilise des sous-titres."
          : "Votre description est longue : ajoutez des sous-titres (H2/H3) pour la structurer.",
    });
  }

  // ---- Readability ----
  if (wordCount > 0) {
    const sentences = descText
      .split(/[.!?…]+\s|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const long = sentences.filter((s) => words(s).length > 20).length;
    const pct = sentences.length ? (long * 100) / sentences.length : 0;
    readChecks.push({
      id: "sentences",
      level: pct <= 25 ? "good" : pct <= 30 ? "ok" : "bad",
      text:
        pct <= 25
          ? `Longueur des phrases : ${Math.round(pct)} % dépassent 20 mots. Parfait.`
          : `${Math.round(pct)} % des phrases dépassent 20 mots (max. recommandé : 25 %). Raccourcissez-les.`,
    });

    const paragraphs = (p.description.match(/<p[\s>][\s\S]*?<\/p>/gi) || []).map(
      (x) => words(stripHtml(x)).length,
    );
    const longPara = paragraphs.filter((n) => n > 150).length;
    readChecks.push({
      id: "paragraphs",
      level: longPara === 0 ? "good" : "ok",
      text:
        longPara === 0
          ? "Aucun paragraphe trop long."
          : `${longPara} paragraphe${longPara > 1 ? "s" : ""} dépasse${longPara > 1 ? "nt" : ""} 150 mots. Découpez-le${longPara > 1 ? "s" : ""}.`,
    });
  }

  const all = [...keyChecks, ...contentChecks];
  const seoLevel: Level = all.some((c) => c.level === "bad")
    ? "bad"
    : all.some((c) => c.level === "ok")
      ? "ok"
      : "good";
  const readLevel: Level | null = readChecks.length
    ? readChecks.some((c) => c.level === "bad")
      ? "bad"
      : readChecks.some((c) => c.level === "ok")
        ? "ok"
        : "good"
    : null;

  return { keyChecks, contentChecks, readChecks, seoLevel, readLevel, effTitle };
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

  useEffect(() => {
    try {
      setHost(window.location.host || "votre-site.com");
    } catch {
      /* ignore */
    }
  }, []);

  const result = useMemo(() => analyze(props), [props]);

  const previewTitle = result.effTitle || "Titre du produit";
  const fallbackDesc = stripHtml(shortDescription).replace(/\s+/g, " ");
  const previewDesc = (metaDescription.trim() || fallbackDesc || "Ajoutez une méta description pour contrôler l'extrait affiché dans les résultats de recherche.");
  const cutTitle = previewTitle.length > TITLE_MAX ? `${previewTitle.slice(0, TITLE_MAX - 1).trimEnd()}…` : previewTitle;
  const cutDesc = previewDesc.length > DESC_MAX ? `${previewDesc.slice(0, DESC_MAX - 1).trimEnd()}…` : previewDesc;
  const focus = keyphrase.split(",")[0].trim();

  return (
    <div className="space-y-5">
      {/* Overall scores */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Dot level={result.seoLevel} />
          <span className="text-sm text-slate-900">
            <strong>Analyse SEO :</strong> {levelLabel[result.seoLevel]}
          </span>
        </div>
        {result.readLevel ? (
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
          <LengthBar value={result.effTitle.length} min={TITLE_MIN} max={TITLE_MAX} />
          <p className="mt-1 text-xs text-slate-600">
            {result.effTitle.length} / {TITLE_MAX} caractères
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
        <Section title="Analyse SEO" checks={[...result.keyChecks, ...result.contentChecks]} level={result.seoLevel} />
        {result.readLevel ? (
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

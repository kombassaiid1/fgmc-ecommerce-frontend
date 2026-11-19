"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BlockStack, Button, InlineStack, Text, TextField } from "@shopify/polaris";
import { ExportIcon, ExternalIcon, ImportIcon } from "@shopify/polaris-icons";
import { Alert, Panel, useColissimo } from "../cm-kit";
import { ColissimoPage } from "../cm-page";
import { BASE } from "../cm-shell";
import { colissimoCall, patch } from "../colissimo-api";

const API = "/frontend-api/admin/colissimo-integration";

function ImportPanel() {
  const { toast } = useColissimo();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; ignored: number; errors: string[] } | null>(null);

  async function send() {
    const file = input.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const outcome = await colissimoCall<{ imported: number; ignored: number; errors: string[] }>("/coliship/import", { method: "POST", body: JSON.stringify({ csv: await file.text() }) });
      setResult(outcome);
      toast(outcome.imported ? `${outcome.imported} étiquette${outcome.imported > 1 ? "s" : ""} importée${outcome.imported > 1 ? "s" : ""}` : "Aucune étiquette importée", outcome.imported === 0);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import impossible.", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Importer des numéros d’expédition" description="Importez le fichier .csv des numéros de suivi, par exemple celui que Coliship produit après l’impression de vos étiquettes.">
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd">Le fichier contient une ligne par colis : <span className="cm-mono">NumeroColis;ReferenceExpedition</span>.</Text>
        <a href="/colissimo/shippingNumbers.csv" download>Télécharger un exemple de fichier .csv</a>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cm-preview" src="/colissimo/shipping-numbers.png" alt="Exemple de fichier .csv avec les colonnes NumeroColis et ReferenceExpedition" style={{ maxWidth: 520 }} />
      </BlockStack>
      <div>
        <label className="cm-label" htmlFor="coliship-file">Fichier .csv</label>
        <div style={{ marginTop: 6 }}>
          <input id="coliship-file" ref={input} type="file" accept=".csv,text/csv" onChange={(event) => { setName(event.target.files?.[0]?.name ?? ""); setResult(null); }} />
        </div>
      </div>
      <InlineStack><Button variant="primary" icon={ImportIcon} onClick={() => void send()} disabled={!name} loading={busy}>Importer</Button></InlineStack>
      {result ? (
        <Alert tone={result.errors.length ? "warning" : "success"} title={`${result.imported} étiquette${result.imported > 1 ? "s" : ""} importée${result.imported > 1 ? "s" : ""}`}>
          {result.ignored ? <Text as="p" variant="bodyMd">{result.ignored} ligne{result.ignored > 1 ? "s" : ""} ignorée{result.ignored > 1 ? "s" : ""} : autre code expéditeur Coliship.</Text> : null}
          {result.errors.length ? <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>{result.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
        </Alert>
      ) : null}
    </Panel>
  );
}

function Coliship() {
  const { toast } = useColissimo();
  const [code, setCode] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    colissimoCall<{ senderCode: string }>("/coliship")
      .then((loaded) => {
        if (cancelled) return;
        setCode(loaded.senderCode);
        setSaved(loaded.senderCode);
      })
      .catch(() => !cancelled && setCode(""));
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveCode() {
    setSaving(true);
    try {
      const result = await patch<{ senderCode: string }>("/coliship/sender-code", { senderCode: code ?? "" });
      setSaved(result.senderCode);
      setCode(result.senderCode);
      toast("Code expéditeur enregistré");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enregistrement impossible.", true);
    } finally {
      setSaving(false);
    }
  }

  async function download(path: string, fallback: string) {
    try {
      const response = await fetch(`${API}${path}`, { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Téléchargement impossible.");
      }
      const blob = await response.blob();
      const name = /filename="?([^";]+)"?/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? fallback;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Téléchargement impossible.", true);
    }
  }

  return (
    <Panel title="Imprimer avec Coliship" description="Exportez vos commandes, imprimez les étiquettes dans Coliship, puis importez les numéros d’expédition ci-dessus.">
      <BlockStack gap="500">
        <ol className="cm-steps" aria-label="Étapes avec Coliship">
          <li>
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">Lancez le plugin Coliship</Text>
              <Text as="p" variant="bodyMd" tone="subdued">S’il n’est pas installé, téléchargez-le depuis l’interface Coliship.</Text>
            </BlockStack>
          </li>
          <li>
            <BlockStack gap="150">
              <Text as="h3" variant="headingSm">Code expéditeur (facultatif)</Text>
              <Text as="p" variant="bodyMd" tone="subdued">Renseigné, le code est ajouté à chaque ligne exportée et au fichier .fmt, et seules les lignes portant ce code sont importées. Vide, tout est exporté et importé sans filtre.</Text>
              <div style={{ maxWidth: 420 }}>
                <TextField
                  label="Code expéditeur"
                  labelHidden
                  value={code ?? ""}
                  onChange={setCode}
                  maxLength={30}
                  autoComplete="off"
                  disabled={code === null}
                  connectedRight={<Button variant="primary" onClick={() => void saveCode()} loading={saving} disabled={code === saved}>Enregistrer</Button>}
                />
              </div>
            </BlockStack>
          </li>
          <li>
            <BlockStack gap="150">
              <Text as="h3" variant="headingSm">Téléchargez les commandes prêtes à expédier</Text>
              <Text as="p" variant="bodyMd" tone="subdued">Les commandes qui ont l’un des statuts configurés dans <Link href={BASE}>Configuration, Expédition</Link> sont incluses.</Text>
              <InlineStack><Button icon={ExportIcon} variant="primary" onClick={() => void download("/coliship/csv", "coliship.csv")}>Télécharger le fichier .csv</Button></InlineStack>
            </BlockStack>
          </li>
          <li>
            <BlockStack gap="150">
              <Text as="h3" variant="headingSm">Importez-les dans Coliship</Text>
              <Text as="p" variant="bodyMd" tone="subdued">Avant d’importer, configurez le format d’import et d’export comme indiqué dans la documentation : téléversez le fichier .fmt dans Coliship, menu « Paramètres », onglet « Import ».</Text>
              <InlineStack gap="200">
                <Button icon={ExportIcon} onClick={() => void download("/coliship/fmt", "PrestaShop.FMT")}>Télécharger le fichier .fmt</Button>
                <Button icon={ExternalIcon} url="https://www.colissimo.fr/entreprise/coliship/login?lang=fr" external>Ouvrir Coliship</Button>
              </InlineStack>
            </BlockStack>
          </li>
          <li>
            <BlockStack gap="100">
              <Text as="h3" variant="headingSm">Importez le fichier produit par Coliship</Text>
              <Text as="p" variant="bodyMd" tone="subdued">Le .csv se trouve à l’emplacement configuré dans Coliship (Paramètres, Export). Importez-le dans la section ci-dessus.</Text>
            </BlockStack>
          </li>
        </ol>
      </BlockStack>
    </Panel>
  );
}

export default function ImportPage() {
  return (
    <ColissimoPage current="coliship" title="Import de numéros d’expédition">
      <ImportPanel />
      <Coliship />
    </ColissimoPage>
  );
}

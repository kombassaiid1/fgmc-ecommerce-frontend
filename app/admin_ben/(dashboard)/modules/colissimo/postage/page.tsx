"use client";

import { Fragment, useEffect, useState } from "react";
import { Badge, BlockStack, Button, Card, InlineStack, ProgressBar, Text, TextField } from "@shopify/polaris";
import { ChevronLeftIcon, MinusIcon, PlusIcon } from "@shopify/polaris-icons";
import { Alert, useColissimo } from "../cm-kit";
import { ColissimoPage } from "../cm-page";
import { BASE } from "../cm-shell";
import { LABEL_URL, colissimoCall, type LabelResult, type PostageOptions, type PostageRow } from "../colissimo-api";
import { OrderTable, useOrderList } from "../order-list";

type Draft = PostageOptions & { weight: string; returnLabel: boolean; insured: boolean; ddp: boolean; nonMachinable: boolean; secureCode: boolean; postalPartner: number; cn23Copies: number };

const STEP_TITLES = ["Sélection des commandes", "Configuration des envois", "Résultat"];

function StepHeader({ step }: { step: 1 | 2 | 3 }) {
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">{STEP_TITLES[step - 1]}</Text>
          <Text as="span" variant="bodySm" tone="subdued">Étape {step} sur 3</Text>
        </InlineStack>
        <ProgressBar progress={(step / 3) * 100} size="small" tone="primary" />
      </BlockStack>
    </Card>
  );
}

function Step1({ onProcess }: { onProcess: (ids: string[]) => void }) {
  const { toast } = useColissimo();
  const list = useOrderList("/postage/orders");
  async function hide() {
    try {
      await colissimoCall("/postage/hide", { method: "POST", body: JSON.stringify({ orderIds: list.selected, hide: true }) });
      toast("Commandes masquées de la sélection");
      list.setSelected([]);
      list.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action impossible.", true);
    }
  }
  return (
    <BlockStack gap="400">
      <StepHeader step={1} />
      <Alert>Seules les commandes sans étiquette, dans un statut autorisé (Configuration, Expédition), sont listées.</Alert>
      <InlineStack gap="200" blockAlign="center">
        <Button variant="primary" disabled={!list.selected.length} onClick={() => onProcess(list.selected)}>{list.selected.length ? `Configurer ${list.selected.length} envoi${list.selected.length > 1 ? "s" : ""}` : "Configurer les envois"}</Button>
        <Button disabled={!list.selected.length} onClick={() => void hide()}>Masquer la sélection</Button>
      </InlineStack>
      <OrderTable list={list} />
    </BlockStack>
  );
}

function Step2({ ids, onBack, onDone }: { ids: string[]; onBack: () => void; onDone: (results: LabelResult[]) => void }) {
  const { toast, config } = useColissimo();
  const [rows, setRows] = useState<PostageRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    colissimoCall<PostageRow[]>("/postage/rows", { method: "POST", body: JSON.stringify({ orderIds: ids }) })
      .then((loaded) => {
        if (cancelled) return;
        setRows(loaded);
        setDrafts(Object.fromEntries(loaded.map((row) => [row.id, { weight: String(row.weightKg), returnLabel: row.returnLabelAvailable && row.returnLabelDefault, insured: row.insured, ddp: false, nonMachinable: false, secureCode: row.secureCodeAvailable, postalPartner: row.postalPartner, cn23Copies: row.cn23Copies }])));
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Chargement impossible."));
    return () => {
      cancelled = true;
    };
  }, [ids]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!rows) return <Card><Text as="p" tone="subdued">Chargement des commandes…</Text></Card>;

  const set = (id: string, patch: Partial<Draft>) => setDrafts((old) => ({ ...old, [id]: { ...old[id], ...patch } }));
  const anyPartner = rows.some((row) => row.postalPartnerAvailable);
  const anySecure = config.values.COLISSIMO_DELIVERY_BLOCKING_CODE === true;
  const tare = config.values.COLISSIMO_USE_WEIGHT_TARE === true;
  const weightOk = (value: string) => {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) && n > 0 && n <= 30;
  };

  async function process() {
    if (!rows) return;
    if (rows.some((row) => !weightOk(drafts[row.id].weight))) {
      toast("Chaque poids doit être supérieur à 0 et ne pas dépasser 30 kg.", true);
      return;
    }
    setBusy(true);
    try {
      const results = await colissimoCall<LabelResult[]>("/labels", {
        method: "POST",
        body: JSON.stringify({
          orders: rows.map((row) => {
            const d = drafts[row.id];
            const parsed = Number(d.weight.replace(",", "."));
            return {
              orderId: row.id,
              options: {
                weightKg: Math.round((parsed + (row.tareKg ?? 0)) * 1000) / 1000,
                returnLabel: d.returnLabel,
                insured: d.insured,
                ddp: d.ddp,
                nonMachinable: d.nonMachinable,
                secureCode: d.secureCode,
                ...(row.postalPartnerAvailable ? { postalPartner: d.postalPartner } : {}),
                cn23Copies: d.cn23Copies,
                articlesDescription: d.articlesDescription,
              } satisfies PostageOptions,
            };
          }),
        }),
      });
      onDone(results);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Traitement impossible.", true);
    } finally {
      setBusy(false);
    }
  }

  const columns = 10 + (anySecure ? 1 : 0) + (anyPartner ? 1 : 0) + (tare ? 1 : 0);

  return (
    <BlockStack gap="400">
      <StepHeader step={2} />
      <InlineStack><Button icon={ChevronLeftIcon} variant="plain" onClick={onBack}>Retour à la sélection</Button></InlineStack>
      <Alert>
        <Text as="p" variant="bodyMd">Pour expédier une commande en plusieurs colis, ouvrez-la avec le bouton « + ».</Text>
        {rows.some((row) => row.ddpAvailable) ? <Text as="p" variant="bodyMd">Pour un colis en DDP, décrivez les articles en anglais en ouvrant la commande, et pensez à la catégorie d’envoi du CN23.</Text> : null}
        {rows.some((row) => row.type === "RELAY") ? <Text as="p" variant="bodyMd">Vers un point de retrait, l’assurance est plafonnée à 1 000 €.</Text> : null}
      </Alert>
      <div className="cm-table-wrap">
        <table className="cm-table">
          <thead>
            <tr>
              <th>Commande</th><th>Adresse de livraison</th><th>Service</th>
              {anySecure ? <th>Code sécurisé</th> : null}
              <th>Étiquette retour</th><th>Assurance</th><th>DDP</th><th>D150</th>
              {anyPartner ? <th>Partenaire</th> : null}
              <th>Poids (kg)</th>{tare ? <th>Tare</th> : null}<th>CN23</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const d = drafts[row.id];
              return (
                <Fragment key={row.id}>
                  <tr>
                    <td>
                      <InlineStack gap="150" blockAlign="center" wrap={false}>
                        <Button size="micro" icon={open === row.id ? MinusIcon : PlusIcon} accessibilityLabel={open === row.id ? "Masquer le détail" : "Voir le détail de la commande"} onClick={() => setOpen(open === row.id ? null : row.id)} />
                        <span><Text as="span" fontWeight="semibold">{row.reference ?? "—"}</Text><br /><span className="cm-mono" style={{ fontSize: 12 }}>…{row.id.slice(-8)}</span></span>
                      </InlineStack>
                    </td>
                    <td>{[row.consignee.firstName, row.consignee.name].filter(Boolean).join(" ")}<br /><Text as="span" variant="bodySm" tone="subdued">{row.consignee.street}, {row.consignee.zip} {row.consignee.city} ({row.consignee.countryCode})</Text></td>
                    <td>{row.service}</td>
                    {anySecure ? <td><input type="checkbox" aria-label="Code sécurisé" checked={d.secureCode} disabled={!row.secureCodeAvailable} onChange={(e) => set(row.id, { secureCode: e.target.checked })} /></td> : null}
                    <td><input type="checkbox" aria-label="Étiquette retour" checked={d.returnLabel} disabled={!row.returnLabelAvailable} onChange={(e) => set(row.id, { returnLabel: e.target.checked })} /></td>
                    <td><input type="checkbox" aria-label="Assurance" checked={d.insured} onChange={(e) => set(row.id, { insured: e.target.checked })} /></td>
                    <td><input type="checkbox" aria-label="DDP" checked={d.ddp} disabled={!row.ddpAvailable} onChange={(e) => set(row.id, { ddp: e.target.checked })} /></td>
                    <td><input type="checkbox" aria-label="D150, colis non mécanisable" checked={d.nonMachinable} disabled={!row.nonMachinableAvailable} onChange={(e) => set(row.id, { nonMachinable: e.target.checked })} /></td>
                    {anyPartner ? <td>{row.postalPartnerAvailable ? <select aria-label="Partenaire postal" value={d.postalPartner} onChange={(e) => set(row.id, { postalPartner: Number(e.target.value) })}><option value={0}>DPD</option><option value={1}>Partenaire postal</option></select> : "—"}</td> : null}
                    <td><input type="text" aria-label="Poids en kilogrammes" inputMode="decimal" style={{ width: 80 }} value={d.weight} aria-invalid={!weightOk(d.weight)} onChange={(e) => set(row.id, { weight: e.target.value })} /></td>
                    {tare ? <td className="cm-num">{row.tareKg ?? 0} kg</td> : null}
                    <td>{row.cn23Needed ? <select aria-label="Nombre de CN23" value={d.cn23Copies} onChange={(e) => set(row.id, { cn23Copies: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select> : "—"}</td>
                  </tr>
                  {open === row.id ? (
                    <tr>
                      <td colSpan={columns}>
                        <BlockStack gap="200">
                          <Text as="h3" variant="headingSm">Produits</Text>
                          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>{row.products.map((product, index) => <li key={index}>{product.quantity} × {product.title} <span className="cm-num">— {product.unitPrice.toFixed(2).replace(".", ",")} €</span></li>)}</ul>
                          {row.cn23Needed ? <TextField label="Description des articles pour la douane (en anglais)" maxLength={100} value={d.articlesDescription ?? ""} onChange={(value) => set(row.id, { articlesDescription: value })} autoComplete="off" /> : null}
                        </BlockStack>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <InlineStack gap="200">
        <Button variant="primary" onClick={() => void process()} loading={busy}>{`Créer ${rows.length} étiquette${rows.length > 1 ? "s" : ""}`}</Button>
        <Button onClick={onBack}>Retour à la sélection</Button>
      </InlineStack>
    </BlockStack>
  );
}

function Step3({ results, onRestart }: { results: LabelResult[]; onRestart: () => void }) {
  const failed = results.filter((item) => !item.ok);
  return (
    <BlockStack gap="400">
      <StepHeader step={3} />
      <Alert tone={failed.length ? "warning" : "success"} title={failed.length ? `${failed.length} commande${failed.length > 1 ? "s" : ""} en erreur` : "Toutes les étiquettes sont créées"}>
        <Text as="p" variant="bodyMd">{results.length - failed.length} sur {results.length} envois traités. Les erreurs sont détaillées ci-dessous et dans le journal.</Text>
      </Alert>
      <div className="cm-table-wrap">
        <table className="cm-table">
          <thead><tr><th>Commande</th><th>Résultat</th><th>Étiquette</th><th>Étiquette retour</th></tr></thead>
          <tbody>
            {results.map((item) => (
              <tr key={item.orderId}>
                <td>{item.reference ?? `…${item.orderId.slice(-8)}`}</td>
                <td>{item.ok ? <Badge tone="success">{item.trackId}</Badge> : <Badge tone="critical">{item.error}</Badge>}</td>
                <td>{item.shipmentId ? <a href={LABEL_URL(item.shipmentId)} target="_blank" rel="noopener noreferrer">Ouvrir le PDF</a> : "—"}</td>
                <td>{item.returnShipmentId ? <a href={LABEL_URL(item.returnShipmentId)} target="_blank" rel="noopener noreferrer">Ouvrir le PDF</a> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <InlineStack gap="200">
        <Button variant="primary" onClick={onRestart}>Nouvelle sélection</Button>
        {results.some((item) => item.ok) ? <Button url={`${BASE}/documents`}>Documents douaniers</Button> : null}
        <Button url={`${BASE}/deposit-slip`}>Bordereau de dépôt</Button>
      </InlineStack>
    </BlockStack>
  );
}

function Postage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [ids, setIds] = useState<string[]>([]);
  const [results, setResults] = useState<LabelResult[]>([]);
  return step === 1 ? (
    <Step1 onProcess={(selected) => { setIds(selected); setStep(2); }} />
  ) : step === 2 ? (
    <Step2 key={ids.join(",")} ids={ids} onBack={() => setStep(1)} onDone={(done) => { setResults(done); setStep(3); }} />
  ) : (
    <Step3 results={results} onRestart={() => { setIds([]); setStep(1); }} />
  );
}

export default function PostagePage() {
  return <ColissimoPage current="postage" title="Affranchissement"><Postage /></ColissimoPage>;
}

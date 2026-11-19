"use client";

import { useState } from "react";
import { ActionList, Badge, BlockStack, Box, Button, Card, Collapsible, FormLayout, Icon, InlineStack, Modal, Popover, Select, Text, TextField } from "@shopify/polaris";
import { MenuVerticalIcon, MinusIcon, PersonIcon, PlusIcon } from "@shopify/polaris-icons";
import { toast } from "sonner";
import { chooseOrderAddress, getOrderAddresses, saveOrderNote, updateOrderAddress, updateOrderGuest, type OrderAddressChoice, type OrderDetail } from "@/lib/api/orders";

type Which = "shipping" | "invoice";

/** The customer card of an order: who, their orders, both addresses with a menu to correct or change them, and a private note. */
export function CustomerCard({ order, onUpdated, onNoteSaved }: { order: OrderDetail; onUpdated: (order: OrderDetail) => void; onNoteSaved?: (note: string | null) => void }) {
  const [menu, setMenu] = useState<Which | null>(null);
  const [modal, setModal] = useState<"edit" | "choose" | null>(null);
  const [noteOpen, setNoteOpen] = useState(Boolean(order.privateNote));
  const [noteDraft, setNoteDraft] = useState<{ base: string; text: string } | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const savedNote = order.privateNote ?? "";
  const note = noteDraft?.base === savedNote ? noteDraft.text : savedNote;

  const client = order.Client;
  const isGuest = !client;
  const name = client ? `${client.Titre === "Mme" ? "Mme" : "M"} ${client.firstName} ${client.lastName}`.trim() : order.guestName || "Client invité";
  const email = client?.email ?? order.guestEmail;
  const phone = client?.phoneNumber ?? order.guestPhone;
  const address = order.Address;
  const lines = address
    ? [name, client?.company, address.street, `${address.zipCode} ${address.City}`.trim(), address.state, address.country, phone].filter(Boolean)
    : [order.guestName || name, ...(order.guestAddress ? order.guestAddress.split(",").map((part) => part.trim()).filter(Boolean) : ["Aucune adresse enregistrée."]), order.guestPhone].filter(Boolean);

  async function submitNote() {
    if (!onNoteSaved || savingNote) return;
    setSavingNote(true);
    try {
      const result = await saveOrderNote(order.id, note);
      onNoteSaved(result.privateNote);
      setNoteDraft(null);
      toast.success("Note enregistrée.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSavingNote(false);
    }
  }

  const addressBlock = (which: Which, title: string, hint?: string) => (
    <div className="min-w-0">
      <InlineStack align="space-between" blockAlign="start" wrap={false}>
        <Text as="h3" variant="headingSm">{title}</Text>
        <Popover
          active={menu === which}
          onClose={() => setMenu(null)}
          activator={<Button variant="tertiary" icon={MenuVerticalIcon} accessibilityLabel={`Actions pour l’${title.toLowerCase()}`} onClick={() => setMenu(menu === which ? null : which)} />}>
          <ActionList
            items={[
              { content: "Modifier l’adresse actuelle", onAction: () => { setMenu(null); setModal("edit"); } },
              ...(isGuest ? [] : [{ content: "Choisir une autre adresse", onAction: () => { setMenu(null); setModal("choose"); } }]),
            ]}
          />
        </Popover>
      </InlineStack>
      {hint ? <p className="mb-1 text-xs text-[#667085]">{hint}</p> : null}
      <p className="whitespace-pre-line text-sm leading-6 text-[#344054]">{lines.join("\n")}</p>
    </div>
  );

  return (
    <>
      <Card padding="0">
        <div className="border-b border-[#dce4ea] px-4 py-3"><Text as="h2" variant="headingMd">Client</Text></div>
        <Box padding="400">
          <BlockStack gap="400">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-[#f6f6f7] px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#303030] text-white"><Icon source={PersonIcon} tone="inherit" /></span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-[#303030]">{name}{client ? <span className="ml-2 font-semibold text-[#8a94a0]">#{client.id.slice(-6)}</span> : null}</p>
                  <p className="text-xs font-semibold text-[#667085]">{client ? "Client enregistré" : "Invité"}</p>
                </div>
              </div>
              {client ? <Button variant="plain" url="/admin_ben/clients">Voir la fiche complète</Button> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold text-[#303030]">E-mail :</p>
                <p className="mt-1 text-sm">{email ? <a className="text-[#005bd3] hover:underline" href={`mailto:${email}`}>{email}</a> : "—"}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#303030]">Commandes validées :</p>
                <p className="mt-1"><span className="inline-block min-w-6 rounded bg-[#303030] px-2 py-0.5 text-center text-sm font-bold text-white">{client ? order.customerOrderCount : 1}</span></p>
              </div>
            </div>

            <div className="grid gap-5 rounded-md bg-[#f6f6f7] p-4 sm:grid-cols-2">
              {addressBlock("shipping", "Adresse de livraison")}
              {addressBlock("invoice", "Adresse de facturation", "Identique à l’adresse de livraison")}
            </div>

            <div className="rounded-md bg-[#f6f6f7]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-[#005bd3]"
                aria-expanded={noteOpen}
                aria-controls="order-private-note"
                onClick={() => setNoteOpen((open) => !open)}>
                <Text as="h3" variant="headingSm">Note privée</Text>
                <span className="flex items-center gap-2">
                  {savedNote && !noteOpen ? <Badge>Renseignée</Badge> : null}
                  <Icon source={noteOpen ? MinusIcon : PlusIcon} tone="subdued" />
                </span>
              </button>
              <Collapsible open={noteOpen} id="order-private-note" transition={{ duration: "150ms", timingFunction: "ease-out" }}>
                <Box padding="400" paddingBlockStart="0">
                  <BlockStack gap="200">
                    <TextField label="Note privée" labelHidden multiline={4} value={note} onChange={(text) => setNoteDraft({ base: savedNote, text })} readOnly={!onNoteSaved} disabled={savingNote} autoComplete="off" maxLength={4000} showCharacterCount helpText="Visible uniquement par l’équipe de la boutique." />
                    {onNoteSaved ? <InlineStack align="end"><Button variant="primary" onClick={() => void submitNote()} loading={savingNote} disabled={note.trim() === savedNote.trim()}>Enregistrer</Button></InlineStack> : null}
                  </BlockStack>
                </Box>
              </Collapsible>
            </div>
          </BlockStack>
        </Box>
      </Card>

      {modal === "edit" ? <EditAddressModal order={order} onClose={() => setModal(null)} onUpdated={(next) => { setModal(null); onUpdated(next); }} /> : null}
      {modal === "choose" ? <ChooseAddressModal order={order} onClose={() => setModal(null)} onUpdated={(next) => { setModal(null); onUpdated(next); }} /> : null}
    </>
  );
}

/* ---------------------------------------------------------------- */

function EditAddressModal({ order, onClose, onUpdated }: { order: OrderDetail; onClose: () => void; onUpdated: (order: OrderDetail) => void }) {
  const client = order.Client;
  const address = order.Address;
  const [street, setStreet] = useState(address?.street ?? "");
  const [zipCode, setZipCode] = useState(address?.zipCode ?? "");
  const [city, setCity] = useState(address?.City ?? "");
  const [state, setState] = useState(address?.state ?? "");
  const [country, setCountry] = useState(address?.country ?? "France");
  const [guestName, setGuestName] = useState(order.guestName ?? "");
  const [guestEmail, setGuestEmail] = useState(order.guestEmail ?? "");
  const [guestPhone, setGuestPhone] = useState(order.guestPhone ?? "");
  const [guestAddress, setGuestAddress] = useState(order.guestAddress ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    setSaving(true);
    try {
      let result: OrderDetail | null = null;
      if (!client) result = await updateOrderGuest(order.id, { guestName, guestEmail, guestPhone, ...(address ? {} : { guestAddress }) });
      if (address) result = await updateOrderAddress(order.id, { street, zipCode, city, state, country });
      if (result) {
        toast.success("Adresse mise à jour.");
        onUpdated(result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Modifier l’adresse"
      primaryAction={{ content: "Enregistrer", onAction: () => void save(), loading: saving }}
      secondaryActions={[{ content: "Annuler", onAction: onClose }]}>
      <Modal.Section>
        <FormLayout>
          {client ? (
            <TextField label="Client" value={`${client.firstName} ${client.lastName} (${client.email})`} readOnly autoComplete="off" helpText="Le nom et l’e-mail se modifient dans la fiche du client." />
          ) : (
            <>
              <TextField label="Nom complet" value={guestName} onChange={setGuestName} autoComplete="off" />
              <FormLayout.Group>
                <TextField label="E-mail" type="email" value={guestEmail} onChange={setGuestEmail} autoComplete="off" />
                <TextField label="Téléphone" type="tel" value={guestPhone} onChange={setGuestPhone} autoComplete="off" />
              </FormLayout.Group>
            </>
          )}
          {address ? (
            <>
              <TextField label="Adresse" requiredIndicator value={street} onChange={setStreet} autoComplete="off" helpText="Numéro, rue et complément." />
              <FormLayout.Group>
                <TextField label="Code postal" requiredIndicator value={zipCode} onChange={setZipCode} autoComplete="off" />
                <TextField label="Ville" requiredIndicator value={city} onChange={setCity} autoComplete="off" />
              </FormLayout.Group>
              <FormLayout.Group>
                <TextField label="Région ou département" value={state} onChange={setState} autoComplete="off" />
                <TextField label="Pays" requiredIndicator value={country} onChange={setCountry} autoComplete="off" />
              </FormLayout.Group>
              <Text as="p" variant="bodySm" tone="subdued">Cette correction ne concerne que cette commande : le carnet d’adresses du client et ses autres commandes ne changent pas.</Text>
            </>
          ) : (
            <TextField label="Adresse" multiline={3} value={guestAddress} onChange={setGuestAddress} autoComplete="off" helpText="Rue, ville, code postal, pays." />
          )}
          {error ? <Text as="p" tone="critical" variant="bodyMd">{error}</Text> : null}
        </FormLayout>
      </Modal.Section>
    </Modal>
  );
}

function ChooseAddressModal({ order, onClose, onUpdated }: { order: OrderDetail; onClose: () => void; onUpdated: (order: OrderDetail) => void }) {
  const [choices, setChoices] = useState<OrderAddressChoice[] | null>(null);
  const [selected, setSelected] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);

  if (!started) {
    setStarted(true);
    getOrderAddresses(order.id)
      .then((result) => {
        setChoices(result.addresses);
        setCurrent(result.currentId);
        setSelected(result.currentId ?? result.addresses[0]?.id ?? "");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Chargement impossible."));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const result = await chooseOrderAddress(order.id, selected);
      toast.success("Adresse de la commande changée.");
      onUpdated(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  const label = (row: OrderAddressChoice) => `${row.street}, ${row.zipCode} ${row.city}, ${row.country}`;
  return (
    <Modal
      open
      onClose={onClose}
      title="Choisir une autre adresse"
      primaryAction={{ content: "Choisir", onAction: () => void save(), loading: saving, disabled: !selected || selected === current }}
      secondaryActions={[{ content: "Annuler", onAction: onClose }]}>
      <Modal.Section>
        {!choices ? (
          <Text as="p" tone="subdued">{error || "Chargement des adresses…"}</Text>
        ) : choices.length === 0 ? (
          <Text as="p" tone="subdued">Ce client n’a pas d’autre adresse enregistrée.</Text>
        ) : (
          <BlockStack gap="300">
            <Select label="Adresse du client" value={selected} onChange={setSelected} options={choices.map((row) => ({ label: `${label(row)}${row.id === current ? " (actuelle)" : ""}`, value: row.id }))} />
            {error ? <Text as="p" tone="critical" variant="bodyMd">{error}</Text> : null}
          </BlockStack>
        )}
      </Modal.Section>
    </Modal>
  );
}

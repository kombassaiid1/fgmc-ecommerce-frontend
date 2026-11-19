"use client";

import type { ReactNode } from "react";
import { Badge, BlockStack, Box, Button, Card, Divider, InlineStack, Text } from "@shopify/polaris";

/** The frame both carrier cards (GLS, Colissimo) share on the order page: brand, state, settings link, content. */
export function CarrierCard({
  title,
  logo,
  status,
  settingsHref,
  settingsLabel,
  disabledReason,
  children,
}: {
  title: string;
  logo: { src: string; alt: string; width: number };
  status?: ReactNode;
  settingsHref: string;
  settingsLabel: string;
  /** When set the card shows only this reason: the order was placed with the other carrier. */
  disabledReason?: string;
  children: ReactNode;
}) {
  if (disabledReason) {
    return (
      <Card>
        <BlockStack gap="150">
          <InlineStack gap="200" blockAlign="center" wrap={false}>
            <span style={{ opacity: 0.45, display: "inline-flex" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo.src} alt="" width={logo.width} height={24} style={{ height: 24, width: "auto", filter: "grayscale(1)" }} />
            </span>
            <Text as="h2" variant="headingSm" tone="disabled">{title}</Text>
            <Badge>Désactivé</Badge>
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">{disabledReason}</Text>
        </BlockStack>
      </Card>
    );
  }
  return (
    <Card padding="0">
      <Box padding="400">
        <InlineStack align="space-between" blockAlign="center" gap="300" wrap={false}>
          <InlineStack gap="300" blockAlign="center" wrap={false}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.src} alt={logo.alt} width={logo.width} height={28} style={{ height: 28, width: "auto", display: "block" }} />
            <Text as="h2" variant="headingMd">{title}</Text>
            {status}
          </InlineStack>
          <Button variant="plain" url={settingsHref}>{settingsLabel}</Button>
        </InlineStack>
      </Box>
      <Divider />
      <Box padding="400">
        <BlockStack gap="400">{children}</BlockStack>
      </Box>
    </Card>
  );
}

/** What the customer chose at checkout, in one line. */
export function ChosenDelivery({ label, detail }: { label: string; detail?: string }) {
  return (
    <BlockStack gap="050">
      <Text as="span" variant="bodySm" tone="subdued">Livraison choisie par le client</Text>
      <Text as="span" variant="bodyMd" fontWeight="semibold">{label}</Text>
      {detail ? <Text as="span" variant="bodySm" tone="subdued">{detail}</Text> : null}
    </BlockStack>
  );
}

export type TrackLink = { id: string; labelHref: string; labelText?: string; trackHref: string; trackText: string; extra?: ReactNode };
export type TrackEvent = { date: string; time: string; description: string; place: string };

/** One shipment: its state, its numbers with their links, the last tracking status and the timeline. */
export function ShipmentBlock({
  badges,
  meta,
  cancelled,
  numbers,
  lastStatus,
  lastEvent,
  events,
  onTrack,
  trackBusy,
  onCancel,
  cancelBusy,
  cancelLabel = "Annuler",
}: {
  badges: ReactNode;
  meta: string;
  cancelled: boolean;
  numbers: TrackLink[];
  lastStatus?: string | null;
  lastEvent?: string;
  events?: TrackEvent[];
  onTrack: () => void;
  trackBusy: boolean;
  onCancel: () => void;
  cancelBusy: boolean;
  cancelLabel?: string;
}) {
  return (
    <Box padding="300" borderWidth="025" borderColor="border" borderRadius="300" background={cancelled ? "bg-surface-secondary" : "bg-surface"}>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start" gap="200">
          <BlockStack gap="100">
            <InlineStack gap="150" blockAlign="center">{badges}</InlineStack>
            <Text as="span" variant="bodySm" tone="subdued">{meta}</Text>
          </BlockStack>
          {cancelled ? null : (
            <InlineStack gap="150">
              <Button size="slim" onClick={onTrack} loading={trackBusy}>Actualiser le suivi</Button>
              <Button size="slim" tone="critical" variant="secondary" onClick={onCancel} loading={cancelBusy}>{cancelLabel}</Button>
            </InlineStack>
          )}
        </InlineStack>

        <BlockStack gap="150">
          {numbers.map((number) => (
            <InlineStack key={number.id} align="space-between" blockAlign="center" gap="200">
              <span className="font-mono text-sm text-[#344054]" style={{ fontFamily: "ui-monospace, Consolas, monospace", fontVariantNumeric: "tabular-nums" }}>{number.id}</span>
              {cancelled ? null : (
                <InlineStack gap="300">
                  <a href={number.labelHref} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#005bd3] hover:underline">{number.labelText ?? "Étiquette PDF"}</a>
                  {number.extra}
                  <a href={number.trackHref} target="_blank" rel="noopener noreferrer" className="text-sm text-[#005bd3] hover:underline">{number.trackText}</a>
                </InlineStack>
              )}
            </InlineStack>
          ))}
        </BlockStack>

        {lastStatus ? (
          <Text as="p" variant="bodySm">Dernier statut : <strong>{lastStatus}</strong>{lastEvent ? <span style={{ color: "var(--p-color-text-secondary)" }}> ({lastEvent})</span> : null}</Text>
        ) : null}
        {events?.length ? (
          <ol className="space-y-1 border-l-2 border-[#dce4ea] pl-3 text-xs text-[#526174]" style={{ margin: 0 }}>
            {events.map((event, index) => (
              <li key={`${event.date}-${event.time}-${index}`}>
                <span className="text-[#8492a3]">{event.date} {event.time}</span> · {event.description}{event.place ? ` · ${event.place}` : ""}
              </li>
            ))}
          </ol>
        ) : null}
      </BlockStack>
    </Box>
  );
}

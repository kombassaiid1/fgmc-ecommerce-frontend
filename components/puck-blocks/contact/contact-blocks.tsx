"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { useQuery } from "@tanstack/react-query";
import { PiArrowUpRightBold, PiChatTextDuotone, PiCheckBold, PiEnvelopeSimpleDuotone, PiLockKeyDuotone, PiMapPinAreaDuotone, PiMapPinDuotone, PiMapPinFill, PiPaperPlaneTiltDuotone, PiPhoneCallDuotone, PiPhoneDuotone, PiStorefrontDuotone, PiSpinnerGapBold, PiTagDuotone, PiUserDuotone } from "react-icons/pi";

import { SOCIAL_ICONS } from "@/components/footer/social-icons";
import { apiRequest } from "@/lib/api/http-client";
import { SOCIAL_ORDER, toFooterSite } from "@/lib/footer";

import { Wrap, spaceFields, widthField } from "../content/content-blocks";

import { formatTime, nowIn, parseDays, parseHours, buildWeek, statusAt } from "./opening-hours";

import "./contact.css";

/** The shop's own details, read from "Informations de la boutique". */
function useShopDetails() {
  return useQuery({
    queryKey: ["shop-details"],
    queryFn: async () => toFooterSite(await apiRequest<Record<string, unknown>>({ path: "/settings" })),
    staleTime: 60_000,
  });
}

const shopAddress = (site: { address: string; postalCode: string; city: string; country: string }) =>
  [site.address, [site.postalCode, site.city].filter(Boolean).join(" "), site.country].filter(Boolean).join(", ");

/* -------------------------------------------------------------------------- */
/* Contact form                                                               */
/* -------------------------------------------------------------------------- */

export type ContactFormProps = {
  title: string;
  intro: string;
  /** A line of reassurance under the button. Missing on forms placed before it existed. */
  reassurance?: string;
  showPhone: boolean;
  showSubject: boolean;
  submitLabel: string;
  successTitle: string;
  successText: string;
  card: boolean;
  maxWidth: number;
  spaceTop: number;
  spaceBottom: number;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_REASSURANCE = "Vos informations ne servent qu’à vous répondre. Nous répondons en général sous un jour ouvré.";

function ContactFormView({ title, intro, reassurance = DEFAULT_REASSURANCE, showPhone, showSubject, submitLabel, successTitle, successText, card, isEditing }: ContactFormProps & { isEditing: boolean }) {
  const [values, setValues] = useState({ name: "", email: "", phone: "", subject: "", message: "", website: "" });
  const [errors, setErrors] = useState<Partial<Record<"name" | "email" | "message", string>>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [failure, setFailure] = useState("");

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isEditing) return;
    const next: typeof errors = {};
    if (!values.name.trim()) next.name = "Indiquez votre nom.";
    if (!EMAIL.test(values.email.trim())) next.email = "Indiquez une adresse e-mail valide.";
    if (!values.message.trim()) next.message = "Écrivez votre message.";
    setErrors(next);
    setFailure("");
    if (Object.keys(next).length > 0) return;

    setStatus("sending");
    try {
      await apiRequest({
        path: "/contact",
        method: "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          ...(showPhone && values.phone.trim() ? { phone: values.phone.trim() } : {}),
          ...(showSubject && values.subject.trim() ? { subject: values.subject.trim() } : {}),
          message: values.message.trim(),
          website: values.website,
        }),
      });
      setStatus("sent");
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Le message n’a pas pu être envoyé. Réessayez dans un instant.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className="pc-sent" role="status">
        <span className="pc-sent-icon"><PiCheckBold className="size-7" aria-hidden="true" /></span>
        <h3>{successTitle}</h3>
        <p>{successText}</p>
        <button type="button" className="pc-sent-again" onClick={() => { setValues({ name: "", email: "", phone: "", subject: "", message: "", website: "" }); setStatus("idle"); }}>Écrire un autre message</button>
      </div>
    );
  }

  const sending = status === "sending";
  return (
    <div className={card ? "pc-form-card" : undefined}>
      <header className="pc-form-head">
        <span className="pc-form-badge" aria-hidden="true"><PiPaperPlaneTiltDuotone className="size-7" /></span>
        <div>
          {title ? <h2 className="pc-heading pc-form-title">{title}</h2> : null}
          {intro ? <p className="pc-form-intro">{intro}</p> : null}
        </div>
      </header>
      <div className="pc-seam" aria-hidden="true" />

      <form className="pc-form" onSubmit={submit} noValidate>
        <div className={`pc-form-row ${showPhone ? "is-two" : ""}`}>
          <Field id="cf-name" label="Nom" icon={PiUserDuotone} required error={errors.name}>
            <input id="cf-name" value={values.name} onChange={set("name")} autoComplete="name" maxLength={120} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "cf-name-error" : undefined} />
          </Field>
          {showPhone ? (
            <Field id="cf-phone" label="Téléphone" icon={PiPhoneDuotone}>
              <input id="cf-phone" type="tel" value={values.phone} onChange={set("phone")} autoComplete="tel" maxLength={40} />
            </Field>
          ) : null}
        </div>
        <Field id="cf-email" label="Adresse e-mail" icon={PiEnvelopeSimpleDuotone} required error={errors.email}>
          <input id="cf-email" type="email" value={values.email} onChange={set("email")} autoComplete="email" maxLength={200} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "cf-email-error" : undefined} />
        </Field>
        {showSubject ? (
          <Field id="cf-subject" label="Sujet" icon={PiTagDuotone}>
            <input id="cf-subject" value={values.subject} onChange={set("subject")} maxLength={160} />
          </Field>
        ) : null}
        <Field id="cf-message" label="Message" icon={PiChatTextDuotone} required error={errors.message} top>
          <textarea id="cf-message" value={values.message} onChange={set("message")} maxLength={5000} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "cf-message-error" : undefined} />
          <span className="pc-count" aria-hidden="true">{values.message.length}/5000</span>
        </Field>

        <div className="pc-trap" aria-hidden="true">
          <label htmlFor="cf-website">Ne pas remplir ce champ</label>
          <input id="cf-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} />
        </div>

        {failure ? <p role="alert" className="pc-form-alert">{failure}</p> : null}
        <button type="submit" className="pc-submit" disabled={sending || isEditing}>
          {sending ? <PiSpinnerGapBold className="size-5 animate-spin" aria-hidden="true" /> : null}
          {sending ? "Envoi en cours…" : submitLabel}
          {sending ? null : <PiArrowUpRightBold className="size-5" aria-hidden="true" />}
        </button>
        {reassurance ? <p className="pc-reassure"><PiLockKeyDuotone className="size-4" aria-hidden="true" />{reassurance}</p> : null}
        {isEditing ? <p className="pc-form-note">Le formulaire s’envoie depuis la page en ligne : ici, il sert d’aperçu.</p> : null}
      </form>
    </div>
  );
}

function Field({ id, label, icon: Icon, required, error, top, children }: { id: string; label: string; icon: typeof PiUserDuotone; required?: boolean; error?: string; top?: boolean; children: React.ReactNode }) {
  return (
    <div className="pc-field">
      <label htmlFor={id}>
        {label}
        {required ? <span className="pc-req" aria-hidden="true">*</span> : null}
        {required ? <span className="sr-only"> (obligatoire)</span> : null}
      </label>
      <div className={`pc-input ${top ? "is-top" : ""}`}>
        <Icon className="pc-input-icon size-[18px]" aria-hidden="true" />
        {children}
      </div>
      {error ? <span id={`${id}-error`} className="pc-field-error" role="alert">{error}</span> : null}
    </div>
  );
}

export const contactFormBlock: ComponentConfig<ContactFormProps> = {
  label: "Formulaire de contact",
  defaultProps: {
    title: "Écrivez-nous",
    intro: "Une question, une réparation, un devis ? Nous vous répondons rapidement.",
    showPhone: true,
    showSubject: true,
    reassurance: DEFAULT_REASSURANCE,
    submitLabel: "Envoyer le message",
    successTitle: "Message envoyé",
    successText: "Merci ! Nous avons bien reçu votre message et nous vous répondons au plus vite.",
    card: true,
    maxWidth: 720,
    spaceTop: 24,
    spaceBottom: 24,
  },
  fields: {
    title: { type: "text", label: "Titre (vide = aucun)" },
    intro: { type: "textarea", label: "Texte d’introduction" },
    showPhone: { type: "radio", label: "Champ téléphone", options: [{ label: "Oui", value: true }, { label: "Non", value: false }] },
    showSubject: { type: "radio", label: "Champ sujet", options: [{ label: "Oui", value: true }, { label: "Non", value: false }] },
    reassurance: { type: "text", label: "Phrase sous le bouton (vide = aucune)" },
    submitLabel: { type: "text", label: "Texte du bouton" },
    successTitle: { type: "text", label: "Titre après l’envoi" },
    successText: { type: "textarea", label: "Texte après l’envoi" },
    card: { type: "radio", label: "Fond en carte blanche", options: [{ label: "Oui", value: true }, { label: "Non", value: false }] },
    maxWidth: widthField,
    ...spaceFields,
  },
  render: ({ puck, maxWidth, spaceTop, spaceBottom, ...props }) => (
    <Wrap width={maxWidth} top={spaceTop} bottom={spaceBottom}>
      <ContactFormView {...props} maxWidth={maxWidth} spaceTop={spaceTop} spaceBottom={spaceBottom} isEditing={puck.isEditing} />
    </Wrap>
  ),
};

/* -------------------------------------------------------------------------- */
/* Shop details                                                               */
/* -------------------------------------------------------------------------- */

export type ContactInfoProps = {
  title: string;
  layout: "cards" | "list";
  showPhone: boolean;
  showEmail: boolean;
  showAddress: boolean;
  showSocial: boolean;
  maxWidth: number;
  spaceTop: number;
  spaceBottom: number;
};

const CONTACT_ROWS = {
  phone: { icon: PiPhoneCallDuotone, label: "Téléphone", cta: "Appeler", tone: "blue" },
  email: { icon: PiEnvelopeSimpleDuotone, label: "E-mail", cta: "Écrire", tone: "red" },
  address: { icon: PiMapPinAreaDuotone, label: "Adresse", cta: "Itinéraire", tone: "green" },
} as const;

function ContactInfoView({ title, layout, showPhone, showEmail, showAddress, showSocial }: ContactInfoProps) {
  const { data: site } = useShopDetails();
  if (!site) return <div className="pc-empty">Chargement des coordonnées…</div>;
  const address = shopAddress(site);
  const social = SOCIAL_ORDER.filter((id) => site.socialLinks[id]?.trim());
  const rows = [
    showPhone && site.phoneNumber ? { key: "phone" as const, value: site.phoneNumber, href: `tel:${site.phoneNumber.replace(/\s+/g, "")}`, external: false } : null,
    showEmail && site.contactEmail ? { key: "email" as const, value: site.contactEmail, href: `mailto:${site.contactEmail}`, external: false } : null,
    showAddress && address ? { key: "address" as const, value: address, href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, external: true } : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0 && !(showSocial && social.length > 0)) {
    return <div className="pc-empty">Renseignez le téléphone, l’e-mail et l’adresse dans « Informations de la boutique » pour qu’ils apparaissent ici.</div>;
  }

  const socialBlock =
    showSocial && social.length > 0 ? (
      <div className="pc-social-block">
        <span className="pc-social-label">Suivez-nous</span>
        <ul className="pc-social" aria-label="Réseaux sociaux">
          {social.map((id) => (
            <li key={id}><a href={site.socialLinks[id]} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_ICONS[id].label}>{SOCIAL_ICONS[id].icon}</a></li>
          ))}
        </ul>
      </div>
    ) : null;

  const list = (
    <ul className="pc-contact-list">
      {rows.map((row) => {
        const { icon: Icon, label, cta, tone } = CONTACT_ROWS[row.key];
        return (
          <li key={row.key} className={`pc-contact-item tone-${tone}`}>
            <span className="pc-contact-icon"><Icon className="size-7" aria-hidden="true" /></span>
            <div className="pc-contact-text">
              <p className="pc-info-label">{label}</p>
              <a className="pc-contact-link" href={row.href} {...(row.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                <span className="pc-contact-value">{row.value}</span>
                <span className="pc-contact-cta" aria-hidden="true">{cta}<PiArrowUpRightBold className="size-4" /></span>
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={layout === "list" ? "is-mat" : "is-tags"}>
      {title ? <h2 className="pc-heading pc-contact-title is-stitched">{title}</h2> : null}
      {layout === "list" ? (
        <div className="pc-contact-body">
          {list}
          {socialBlock}
        </div>
      ) : (
        <>
          {list}
          {socialBlock}
        </>
      )}
    </div>
  );
}

export const contactInfoBlock: ComponentConfig<ContactInfoProps> = {
  label: "Coordonnées",
  defaultProps: { title: "Nos coordonnées", layout: "cards", showPhone: true, showEmail: true, showAddress: true, showSocial: true, maxWidth: 960, spaceTop: 24, spaceBottom: 24 },
  fields: {
    title: { type: "text", label: "Titre (vide = aucun)" },
    layout: { type: "radio", label: "Style", options: [{ label: "Étiquettes", value: "cards" }, { label: "Panneau sombre", value: "list" }] },
    showPhone: { type: "radio", label: "Téléphone", options: [{ label: "Oui", value: true }, { label: "Non", value: false }] },
    showEmail: { type: "radio", label: "E-mail", options: [{ label: "Oui", value: true }, { label: "Non", value: false }] },
    showAddress: { type: "radio", label: "Adresse", options: [{ label: "Oui", value: true }, { label: "Non", value: false }] },
    showSocial: { type: "radio", label: "Réseaux sociaux", options: [{ label: "Oui", value: true }, { label: "Non", value: false }] },
    maxWidth: widthField,
    ...spaceFields,
  },
  render: ({ maxWidth, spaceTop, spaceBottom, ...props }) => (
    <Wrap width={maxWidth} top={spaceTop} bottom={spaceBottom}>
      <ContactInfoView {...props} maxWidth={maxWidth} spaceTop={spaceTop} spaceBottom={spaceBottom} />
    </Wrap>
  ),
};

/* -------------------------------------------------------------------------- */
/* Map                                                                        */
/* -------------------------------------------------------------------------- */

export type MapProps = {
  address: string;
  /** The tag pinned on the map. Missing on maps placed before it existed. */
  label?: string;
  height: number;
  directionsLabel: string;
  maxWidth: number;
  spaceTop: number;
  spaceBottom: number;
};

function MapView({ address, label = "Notre atelier", height, directionsLabel }: MapProps) {
  const { data: site } = useShopDetails();
  const place = address.trim() || (site ? shopAddress(site) : "");
  if (!place) return <div className="pc-empty">Indiquez une adresse, ou renseignez celle de la boutique dans « Informations de la boutique ».</div>;
  return (
    <figure className="pc-map">
      <div className="pc-map-mat">
        {/* The embedded map draws its own address card at the top left: the frame is shifted up so only the map shows. */}
        <div className="pc-map-view" style={{ height }}>
          <iframe title={`Carte : ${place}`} src={`https://www.google.com/maps?q=${encodeURIComponent(place)}&output=embed`} style={{ height: height + 170 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
          {label ? <span className="pc-map-tag"><PiMapPinFill className="size-4" aria-hidden="true" />{label}</span> : null}
        </div>
      </div>
      <figcaption className="pc-map-bar">
        <span className="pc-map-address"><PiMapPinDuotone className="size-6" aria-hidden="true" />{place}</span>
        {directionsLabel ? <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`} target="_blank" rel="noopener noreferrer">{directionsLabel}<PiArrowUpRightBold className="size-4" aria-hidden="true" /></a> : null}
      </figcaption>
    </figure>
  );
}

export const mapBlock: ComponentConfig<MapProps> = {
  label: "Carte",
  defaultProps: { address: "", label: "Notre atelier", height: 420, directionsLabel: "Itinéraire", maxWidth: 960, spaceTop: 24, spaceBottom: 24 },
  fields: {
    address: { type: "text", label: "Adresse (vide = adresse de la boutique)" },
    label: { type: "text", label: "Étiquette sur la carte (vide = aucune)" },
    height: { type: "number", label: "Hauteur de la carte (px)", min: 200, max: 800 },
    directionsLabel: { type: "text", label: "Texte du bouton d’itinéraire (vide = aucun)" },
    maxWidth: widthField,
    ...spaceFields,
  },
  render: ({ maxWidth, spaceTop, spaceBottom, ...props }) => (
    <Wrap width={maxWidth} top={spaceTop} bottom={spaceBottom}>
      <MapView {...props} maxWidth={maxWidth} spaceTop={spaceTop} spaceBottom={spaceBottom} />
    </Wrap>
  ),
};

/* -------------------------------------------------------------------------- */
/* Opening hours                                                              */
/* -------------------------------------------------------------------------- */

export type HoursProps = {
  title: string;
  rows: Array<{ days: string; hours: string }>;
  note: string;
  /** Says whether the shop is open right now. Missing on blocks placed before it existed. */
  showStatus?: boolean;
  /** The shop's time zone (for example Europe/Paris), so a visitor abroad still sees the shop's own time. */
  timezone?: string;
  maxWidth: number;
  spaceTop: number;
  spaceBottom: number;
};

function HoursView({ title, rows, note, showStatus = true, timezone = "Europe/Paris" }: HoursProps) {
  // The clock is read after the page has loaded, so the server and the browser never disagree.
  const [now, setNow] = useState<{ day: number; minutes: number } | null>(null);
  useEffect(() => {
    const tick = () => setNow(nowIn(timezone));
    const first = window.setTimeout(tick, 0);
    const every = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, [timezone]);

  const lines = useMemo(
    () => rows.filter((row) => row.days.trim() || row.hours.trim()).map((row) => ({ row, days: parseDays(row.days), intervals: parseHours(row.hours) })),
    [rows],
  );
  const week = useMemo(() => buildWeek(rows), [rows]);
  const status = showStatus && week && now ? statusAt(week, now) : null;

  // The measuring tape covers the whole opening day, rounded to full hours.
  const all = lines.flatMap((line) => line.intervals ?? []);
  const min = all.length ? Math.floor(Math.min(...all.map((interval) => interval[0])) / 60) * 60 : 7 * 60;
  const max = all.length ? Math.ceil(Math.max(...all.map((interval) => interval[1])) / 60) * 60 : 20 * 60;
  const place = (minutes: number) => `${(((minutes - min) / (max - min)) * 100).toFixed(2)}%`;

  return (
    <section className="pc-hours" aria-label={title || "Horaires d’ouverture"}>
      <header className="pc-hours-head">
        <span className="pc-hours-icon" aria-hidden="true"><PiStorefrontDuotone className="size-8" /></span>
        <div>
          {title ? <h2 className="pc-heading pc-hours-title">{title}</h2> : null}
          {status ? (
            <p className={`pc-hours-status ${status.open ? "is-open" : "is-closed"}`} role="status">
              <span className="pc-dot" aria-hidden="true" />
              <strong>{status.open ? "Ouvert maintenant" : "Fermé"}</strong>
              {status.detail ? <span>{status.detail}</span> : null}
            </p>
          ) : null}
        </div>
      </header>

      <ul className="pc-hours-list">
        {lines.map(({ row, days, intervals }, index) => {
          const today = Boolean(now && days?.includes(now.day));
          const closed = intervals !== null && intervals.length === 0;
          return (
            <li key={index} className={`pc-hours-row ${today ? "is-today" : ""}`} aria-current={today ? "date" : undefined}>
              <span className="pc-hours-day">
                {row.days}
                {today ? <span className="pc-today">Aujourd’hui</span> : null}
              </span>
              <span className="pc-hours-time">{closed ? <span className="pc-chip-closed">{row.hours}</span> : row.hours}</span>
              {intervals && intervals.length > 0 ? (
                <span className="pc-tape" aria-hidden="true" style={{ "--n": (max - min) / 60 } as React.CSSProperties}>
                  {intervals.map(([start, end], at) => (
                    <i key={at} className="pc-tape-seg" style={{ left: place(start), width: `${(((end - start) / (max - min)) * 100).toFixed(2)}%` }} />
                  ))}
                  {today && now && now.minutes >= min && now.minutes <= max ? <i className="pc-tape-now" style={{ left: place(now.minutes) }} /> : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {all.length > 0 ? (
        <div className="pc-hours-scale" aria-hidden="true">
          <span>{formatTime(min)}</span>
          <span>{formatTime(max)}</span>
        </div>
      ) : null}
      {note ? <p className="pc-hours-note">{note}</p> : null}
    </section>
  );
}

export const hoursBlock: ComponentConfig<HoursProps> = {
  label: "Horaires d’ouverture",
  defaultProps: {
    title: "Horaires d’ouverture",
    rows: [
      { days: "Lundi – Vendredi", hours: "8h30 – 12h30 · 14h – 18h" },
      { days: "Samedi", hours: "9h – 12h" },
      { days: "Dimanche", hours: "Fermé" },
    ],
    note: "",
    showStatus: true,
    timezone: "Europe/Paris",
    maxWidth: 560,
    spaceTop: 24,
    spaceBottom: 24,
  },
  fields: {
    title: { type: "text", label: "Titre" },
    rows: {
      type: "array",
      label: "Lignes",
      getItemSummary: (item) => item.days || "Jours",
      defaultItemProps: { days: "Jours", hours: "Horaires" },
      arrayFields: { days: { type: "text", label: "Jours (ex. Lundi – Vendredi)" }, hours: { type: "text", label: "Horaires (ex. 8h30 – 12h30 · 14h – 18h, ou Fermé)" } },
    },
    note: { type: "text", label: "Remarque (facultatif)" },
    showStatus: { type: "radio", label: "Indiquer « Ouvert maintenant »", options: [{ label: "Oui", value: true }, { label: "Non", value: false }] },
    timezone: { type: "text", label: "Fuseau horaire de la boutique (ex. Europe/Paris)" },
    maxWidth: widthField,
    ...spaceFields,
  },
  render: ({ maxWidth, spaceTop, spaceBottom, ...props }) => (
    <Wrap width={maxWidth} top={spaceTop} bottom={spaceBottom}>
      <HoursView {...props} maxWidth={maxWidth} spaceTop={spaceTop} spaceBottom={spaceBottom} />
    </Wrap>
  ),
};

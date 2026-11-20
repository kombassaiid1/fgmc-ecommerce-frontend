"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowUp, ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaPinterestP, FaSnapchat, FaTiktok, FaWhatsapp, FaXTwitter, FaYoutube } from "react-icons/fa6";

import { type FooterConfig, type FooterLink, type FooterSite, SOCIAL_ORDER, fillCopyright } from "@/lib/footer";

import "./footer.css";

const SOCIAL_ICONS: Record<(typeof SOCIAL_ORDER)[number], { label: string; icon: React.ReactNode }> = {
  facebook: { label: "Facebook", icon: <FaFacebookF className="size-[18px]" aria-hidden="true" /> },
  instagram: { label: "Instagram", icon: <FaInstagram className="size-5" aria-hidden="true" /> },
  x: { label: "X (Twitter)", icon: <FaXTwitter className="size-[18px]" aria-hidden="true" /> },
  youtube: { label: "YouTube", icon: <FaYoutube className="size-5" aria-hidden="true" /> },
  tiktok: { label: "TikTok", icon: <FaTiktok className="size-[18px]" aria-hidden="true" /> },
  linkedin: { label: "LinkedIn", icon: <FaLinkedinIn className="size-[18px]" aria-hidden="true" /> },
  pinterest: { label: "Pinterest", icon: <FaPinterestP className="size-[18px]" aria-hidden="true" /> },
  whatsapp: { label: "WhatsApp", icon: <FaWhatsapp className="size-5" aria-hidden="true" /> },
  snapchat: { label: "Snapchat", icon: <FaSnapchat className="size-5" aria-hidden="true" /> },
};

const isInternal = (url: string) => url.startsWith("/");

/** A footer link: a path on the site, or an address that leaves it. In the back office preview nothing navigates. */
function FooterAnchor({ link, className, preview }: { link: FooterLink; className?: string; preview: boolean }) {
  const stop = preview ? (event: React.MouseEvent) => event.preventDefault() : undefined;
  if (isInternal(link.url) && !link.newTab) {
    return <Link href={link.url} className={className} onClick={stop}>{link.label}</Link>;
  }
  return (
    <a href={link.url} className={className} onClick={stop} {...(link.newTab || !link.url.startsWith("mailto:") ? { target: link.newTab ? "_blank" : undefined, rel: "noopener noreferrer" } : {})}>
      {link.label}
    </a>
  );
}

export function FooterView({ config, site, preview = false }: { config: FooterConfig; site: FooterSite; preview?: boolean }) {
  const style = { "--ft-bg": config.backgroundColor, "--ft-fg": config.textColor, "--ft-accent": config.accentColor, "--ft-cols": Math.max(1, config.groups.length) } as CSSProperties;
  const address = [site.address, [site.postalCode, site.city].filter(Boolean).join(" "), site.country].filter(Boolean).join(", ");
  const social = SOCIAL_ORDER.filter((id) => site.socialLinks[id]?.trim());
  const hasContact = config.showContact && Boolean(site.phoneNumber || site.contactEmail || address);
  const stop = preview ? (event: React.MouseEvent) => event.preventDefault() : undefined;
  const name = site.siteName || config.wordmark;
  const logo = config.logo || site.logo;

  return (
    <footer className="ft" style={style} data-grid={config.showGrid} aria-label="Pied de page">
      {config.showEdge ? <div className="ft-edge" aria-hidden="true" /> : null}

      <div className="ft-body">
        <div className="ft-inner">
          <div className="ft-seam" aria-hidden="true" />

          {config.cta.enabled && config.cta.title ? (
            <section className="ft-cta" aria-label={config.cta.title}>
              <div>
                <h2>{config.cta.title}</h2>
                {config.cta.text ? <p>{config.cta.text}</p> : null}
              </div>
              {config.cta.buttonLabel ? (
                isInternal(config.cta.buttonUrl) ? (
                  <Link href={config.cta.buttonUrl} className="ft-cta-btn" onClick={stop}>{config.cta.buttonLabel}<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
                ) : (
                  <a href={config.cta.buttonUrl} className="ft-cta-btn" onClick={stop} target="_blank" rel="noopener noreferrer">{config.cta.buttonLabel}<ArrowUpRight className="size-4" aria-hidden="true" /></a>
                )
              ) : null}
            </section>
          ) : null}

          <div className="ft-grid">
            <div className="ft-brand">
              {logo ? (
                <span className="ft-logo-tag">
                  {/* The media library can sit on any storage host. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo.startsWith("http") || logo.startsWith("/") ? logo : `/${logo}`} alt={name} />
                </span>
              ) : (
                <p className="ft-name">{name}</p>
              )}
              {config.tagline ? <p className="ft-tagline">{config.tagline}</p> : null}

              {hasContact ? (
                <ul className="ft-contact" aria-label="Coordonnées">
                  {site.phoneNumber ? <li><Phone className="size-4" aria-hidden="true" /><a href={`tel:${site.phoneNumber.replace(/\s+/g, "")}`} onClick={stop}>{site.phoneNumber}</a></li> : null}
                  {site.contactEmail ? <li><Mail className="size-4" aria-hidden="true" /><a href={`mailto:${site.contactEmail}`} onClick={stop}>{site.contactEmail}</a></li> : null}
                  {address ? <li><MapPin className="size-4" aria-hidden="true" /><span>{address}</span></li> : null}
                </ul>
              ) : null}

              {config.showSocial && social.length > 0 ? (
                <ul className="ft-social" aria-label="Réseaux sociaux">
                  {social.map((id) => (
                    <li key={id}>
                      <a href={site.socialLinks[id]} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_ICONS[id].label} onClick={stop}>{SOCIAL_ICONS[id].icon}</a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {config.groups.map((group) => (
              <nav key={group.title} className="ft-col" aria-label={group.title}>
                <h3>{group.title}</h3>
                <ul>
                  {group.links.map((link) => (
                    <li key={`${link.label}-${link.url}`}><FooterAnchor link={link} className="ft-link" preview={preview} /></li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {config.showWordmark && config.wordmark ? <p className="ft-wordmark" aria-hidden="true">{config.wordmark}</p> : null}

          <div className="ft-bottom">
            <p>{fillCopyright(config.copyright, site.siteName)}</p>
            {config.legalLinks.length > 0 ? (
              <ul className="ft-legal" aria-label="Informations légales">
                {config.legalLinks.map((link) => (
                  <li key={`${link.label}-${link.url}`}><FooterAnchor link={link} preview={preview} /></li>
                ))}
              </ul>
            ) : null}
            {config.showBackToTop ? (
              <button type="button" className="ft-top" onClick={preview ? undefined : () => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}>
                Haut de page
                <span className="ft-top-knob"><ArrowUp className="size-5" aria-hidden="true" /></span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {config.showRuler ? (
        <div className="ft-ruler" aria-hidden="true">
          <div className="ft-ruler-nums">{Array.from({ length: 40 }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
        </div>
      ) : null}
    </footer>
  );
}

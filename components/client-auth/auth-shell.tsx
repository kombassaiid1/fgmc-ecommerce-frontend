import Image from "next/image";
import Link from "next/link";
import { PiArrowRightBold, PiPackageDuotone, PiReceiptDuotone, PiShieldCheckDuotone } from "react-icons/pi";

import "./auth.css";

type AuthShellProps = {
  title: string;
  subtitle: string;
  /** Headline and text of the navy panel, which change between sign-in and sign-up. */
  panelTitle: string;
  panelText: string;
  switchText: string;
  switchHref: string;
  switchLabel: string;
  /** Where the three benefits sit in the navy panel. */
  benefitsAt?: "top" | "bottom";
  children: React.ReactNode;
};

const BENEFITS = [
  { icon: PiPackageDuotone, title: "Suivi de commandes", text: "Où en est votre colis, à tout moment." },
  { icon: PiReceiptDuotone, title: "Devis et prix client", text: "Vos tarifs et vos documents au même endroit." },
  { icon: PiShieldCheckDuotone, title: "Espace sécurisé", text: "Vos informations restent chez FGMC." },
];

/** Shared frame of the client sign-in and sign-up pages. */
export function AuthShell({ title, subtitle, panelTitle, panelText, switchText, switchHref, switchLabel, benefitsAt = "bottom", children }: AuthShellProps) {
  const benefits = (
    <ul className={`relative z-10 hidden gap-1 lg:grid ${benefitsAt === "top" ? "mt-8" : ""}`}>
      {BENEFITS.map(({ icon: Icon, title: benefit, text }) => (
        <li key={benefit} className="flex items-start gap-4 border-t border-white/20 py-3.5 first:border-t-0">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold">{benefit}</span>
            <span className="block text-sm leading-6 text-white/70">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="auth-scope min-h-[calc(100dvh-5rem)] px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-3xl bg-[var(--auth-paper)] shadow-[0_30px_80px_-30px_rgba(11,31,77,0.45)] ring-1 ring-[var(--auth-line)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* ---------------------------------------------------------- the mat */}
        <aside className="auth-mat flex flex-col justify-between gap-8 px-6 pb-6 pt-10 sm:px-10 sm:pb-10 sm:pt-12 lg:min-h-[640px] lg:px-12">
          <div>
            <Link href="/" aria-label="France Général Machines à Coudre, accueil" className="inline-block rounded-xl bg-white p-3 shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <Image src="/brand/logo-fgmc.webp" alt="France Général Machines à Coudre" width={1452} height={460} priority className="h-auto w-[190px] sm:w-[230px]" />
            </Link>

            <h2 className="mt-8! max-w-sm text-3xl! font-bold! leading-[1.1]! sm:text-4xl!">{panelTitle}</h2>
            <p className="mt-4! hidden max-w-sm text-base! leading-7! text-white/80 sm:block">{panelText}</p>
            {benefitsAt === "top" ? benefits : null}
          </div>

          {benefitsAt === "bottom" ? benefits : null}

          {/* The thread of the logo, drawn once. */}
          <svg className="auth-thread" viewBox="0 0 600 260" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path className="thread-blue" pathLength={1} d="M-10 215 C 140 190, 300 215, 470 120 S 590 40, 640 28" />
            <path className="thread-red" pathLength={1} d="M-10 245 C 170 235, 330 255, 500 175 S 600 120, 640 98" />
            <path className="thread-stitch" pathLength={1} d="M-10 230 C 155 212, 315 236, 485 148 S 595 80, 640 63" />
          </svg>
        </aside>

        {/* ---------------------------------------------------------- the label */}
        <div className="relative px-5 py-8 sm:px-10 lg:px-14 lg:py-12">
          <div className="auth-label-frame" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-xl">
            <div className="mb-7 flex items-center justify-between gap-4">
              <p className="text-sm text-[var(--auth-muted)]">{switchText}</p>
              <Link
                href={switchHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-[var(--auth-ink)] px-5 text-sm font-bold text-[var(--auth-ink)] transition-colors hover:bg-[var(--auth-ink)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-blue)]">
                {switchLabel}
                <PiArrowRightBold className="size-4" aria-hidden="true" />
              </Link>
            </div>

            <h1 className="text-4xl! font-bold! leading-tight! text-[var(--auth-ink)] sm:text-5xl!">{title}</h1>
            <p className="mt-3! max-w-md text-base! leading-7! text-[var(--auth-muted)]">{subtitle}</p>

            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

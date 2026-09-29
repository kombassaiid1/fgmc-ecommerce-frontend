import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ShieldCheck, Truck } from "lucide-react";

type AuthShellProps = {
  title: string;
  eyebrow: string;
  subtitle: string;
  switchText: string;
  switchHref: string;
  switchLabel: string;
  children: React.ReactNode;
};

const BENEFITS = [
  {
    icon: Truck,
    label: "Suivi de commandes",
  },
  {
    icon: BadgeCheck,
    label: "Devis et prix client",
  },
  {
    icon: ShieldCheck,
    label: "Espace securise",
  },
];

export function AuthShell({
  title,
  eyebrow,
  subtitle,
  switchText,
  switchHref,
  switchLabel,
  children,
}: AuthShellProps) {
  return (
    <section className="min-h-[calc(100dvh-5rem)] bg-muted px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-lg border border-border bg-background shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/logo.png"
                alt="FGMC"
                width={170}
                height={70}
                priority
                className="h-auto w-40 rounded bg-white/95 px-3 py-2"
              />
            </Link>

            <div className="mt-12 max-w-sm">
              <p className="text-sm font-semibold uppercase tracking-normal text-primary-foreground/75">
                France General Machine a Coudre
              </p>
              <h2 className="mt-4 text-3xl font-bold leading-tight">
                Votre espace client pour acheter plus simplement.
              </h2>
              <p className="mt-4 text-base leading-7 text-primary-foreground/82">
                Retrouvez vos informations, preparez vos commandes et gardez un
                acces direct aux services FGMC.
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {BENEFITS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex min-h-12 items-center gap-3 rounded-md bg-white/10 px-4 py-3 text-sm font-medium">
                <Icon className="size-5" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="mx-auto w-full max-w-xl">
            <div className="mb-8 flex items-center justify-between gap-4">
              <Link href="/" className="inline-flex items-center lg:hidden">
                <Image
                  src="/logo.png"
                  alt="FGMC"
                  width={132}
                  height={54}
                  priority
                  className="h-auto w-32"
                />
              </Link>
              <Link
                href={switchHref}
                className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary">
                {switchLabel}
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-normal text-destructive">
                {eyebrow}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-normal text-foreground sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-lg text-base leading-7 text-muted-foreground">
                {subtitle}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {switchText}{" "}
                <Link
                  href={switchHref}
                  className="font-semibold text-primary hover:text-primary/80">
                  {switchLabel}
                </Link>
              </p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

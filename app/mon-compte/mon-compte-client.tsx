"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  FileText,
  LogOut,
  MapPin,
  Tag,
  UserCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  clearClientSession,
  getClientSession,
  subscribeToClientSession,
  type ClientSession,
} from "@/lib/client-auth";

type AccountTile = {
  id: string;
  title: ReactNode;
  description: ReactNode;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const accountTiles: AccountTile[] = [
  {
    id: "informations",
    title: "Informations",
    description: <>Identit&eacute;, e-mail et mot de passe</>,
    href: "/mon-compte/informations",
    icon: UserCircle,
  },
  {
    id: "adresses",
    title: "Adresses",
    description: "Livraison et facturation",
    href: "/mon-compte/adresses",
    icon: MapPin,
  },
  {
    id: "commandes",
    title: <>Historique et d&eacute;tails de mes commandes</>,
    description: <>Suivi, factures et achats pass&eacute;s</>,
    href: "/mon-compte/commandes",
    icon: CalendarDays,
  },
  {
    id: "avoirs",
    title: "Avoirs",
    description: <>Cr&eacute;dits disponibles sur votre compte</>,
    href: "/mon-compte/avoirs",
    icon: FileText,
  },
  {
    id: "reductions",
    title: <>Bons de r&eacute;duction</>,
    description: "Codes actifs et avantages client",
    href: "/mon-compte/reductions",
    icon: Tag,
  },
  {
    id: "alertes",
    title: "Mes alertes",
    description: <>Notifications produits et disponibilit&eacute;s</>,
    href: "/mon-compte/alertes",
    icon: Bell,
  },
];

function getServerSessionSnapshot() {
  return null;
}

let cachedSession: ClientSession | null = null;
let cachedSessionKey = "";

function getClientSessionSnapshot() {
  const nextSession = getClientSession();
  const nextKey = nextSession
    ? `${nextSession.token}:${JSON.stringify(nextSession.user)}`
    : "";

  if (nextKey === cachedSessionKey) {
    return cachedSession;
  }

  cachedSession = nextSession;
  cachedSessionKey = nextKey;
  return cachedSession;
}

function getDisplayName(session: ClientSession | null) {
  const user = session?.user;
  const fullName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || user?.username || user?.email || "Mon compte";
}

export function MonCompteClient() {
  const router = useRouter();
  const session = useSyncExternalStore(
    subscribeToClientSession,
    getClientSessionSnapshot,
    getServerSessionSnapshot,
  );

  function handleLogout() {
    clearClientSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f5f6f8] text-[#172033]">
      <div className="border-t-2 border-destructive bg-[#ededed]">
        <nav
          aria-label="Fil d'Ariane"
          className="mx-auto flex min-h-11 w-full max-w-[1740px] flex-wrap items-center gap-2 px-4 text-sm text-[#172033] sm:px-8 lg:px-12">
          <Link href="/" className="hover:text-primary hover:underline">
            Accueil
          </Link>
          <BreadcrumbSeparator />
          <Link href="/mon-compte" className="hover:text-primary hover:underline">
            Mon compte
          </Link>
          <BreadcrumbSeparator />
          <span>Votre compte</span>
          <BreadcrumbSeparator />
          <span aria-current="page">Mon compte</span>
        </nav>
      </div>

      <section className="mx-auto w-full max-w-[1740px] px-4 pt-6 pb-16 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-md border border-border bg-white shadow-[0_12px_28px_rgba(16,24,40,0.08)]">
          <div className="border-b border-border bg-linear-to-r from-primary/10 via-white to-destructive/10 px-5 py-6 sm:px-8">
            <div className="min-w-0">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-primary">
                  Votre compte
                </p>
                <h1 className="mt-2 text-2xl font-bold text-[#101828] sm:text-3xl">
                  Bonjour, {getDisplayName(session)}
                </h1>
                {session?.user?.email ? (
                  <p className="mt-2 break-words text-sm text-[#5b667a]">
                    {session.user.email}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 lg:gap-5 lg:p-8">
            {accountTiles.map((tile) => (
              <AccountTileLink key={tile.id} tile={tile} />
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-md border-[#d0d5dd] bg-white px-5 text-xs font-bold uppercase text-[#172033] shadow-sm hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive"
            onClick={handleLogout}>
            <LogOut className="size-4" />
            D&eacute;connexion
          </Button>
        </div>
      </section>
    </main>
  );
}

function BreadcrumbSeparator() {
  return (
    <span aria-hidden className="text-[#667085]">
      /
    </span>
  );
}

function AccountTileLink({ tile }: { tile: AccountTile }) {
  const Icon = tile.icon;

  return (
    <Link
      href={tile.href}
      className="group flex min-h-[138px] items-center gap-4 rounded-md border border-[#d8dde6] bg-white p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-[0_10px_22px_rgba(8,88,177,0.12)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <span className="grid size-12 shrink-0 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
        <Icon aria-hidden className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold uppercase leading-snug text-[#172033]">
          {tile.title}
        </span>
        <span className="mt-2 block text-sm leading-5 text-[#667085]">
          {tile.description}
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="size-5 shrink-0 text-[#98a2b3] transition-transform group-hover:translate-x-1 group-hover:text-primary"
      />
    </Link>
  );
}

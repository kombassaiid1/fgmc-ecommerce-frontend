"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search, ShoppingCart, User } from "lucide-react";

export function TopNavBar() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin_ben")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/90 text-blue-700 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 dark:text-blue-400">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/logo.png"
              alt="Logo"
              width={170}
              height={44}
              priority
              className="h-10 w-auto"
            />
          </Link>
          <div className="relative hidden w-96 md:block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={18} />
            </span>
            <input
              className="w-full rounded-full bg-slate-100 py-2 pr-4 pl-10 text-slate-700 placeholder:text-slate-400 outline-none transition-shadow focus:ring-2 focus:ring-blue-200 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
              placeholder="Rechercher une machine, une pièce..."
              type="text"
            />
          </div>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="#"
            className="border-b-2 border-blue-700 pb-1 text-sm font-bold text-blue-700 transition-colors hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">
            Machines
          </Link>
          <Link
            href="#"
            className="pb-1 text-sm font-medium text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300">
            Pièces Détachées
          </Link>
          <Link
            href="#"
            className="pb-1 text-sm font-medium text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300">
            Accessoires
          </Link>
          <Link
            href="#"
            className="pb-1 text-sm font-medium text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300">
            Occasion
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <button className="text-blue-700 transition-colors hover:text-blue-600 md:hidden">
            <Search size={20} />
          </button>
          <button className="text-blue-700 transition-colors hover:text-blue-600">
            <User size={20} />
          </button>
          <button className="relative text-blue-700 transition-colors hover:text-blue-600">
            <ShoppingCart size={20} />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              2
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

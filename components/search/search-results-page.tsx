"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";

import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import type { ProductListItem } from "@/lib/api/products";

const PAGE_SIZE = 24;
const SORT_OPTIONS = [
  { value: "relevance", label: "Pertinence" },
  { value: "newest", label: "Plus récents" },
  { value: "oldest", label: "Plus anciens" },
  { value: "price-low", label: "Prix croissant" },
  { value: "price-high", label: "Prix décroissant" },
  { value: "name-asc", label: "Nom A-Z" },
  { value: "name-desc", label: "Nom Z-A" },
];

type SearchResponse = {
  products: ProductListItem[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
};

export function SearchResultsPage({ term }: { term: string }) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("relevance");
  const productsQuery = useQuery({
    queryKey: ["search-results", term, page, sortBy],
    queryFn: () => {
      const params = new URLSearchParams({ search: term, page: String(page), limit: String(PAGE_SIZE), sortBy });
      return apiFetch<SearchResponse>(`/products/catalog?${params.toString()}`);
    },
    enabled: Boolean(term),
  });
  const products = productsQuery.data?.products ?? [];
  const total = productsQuery.data?.totalCount ?? 0;
  const totalPages = productsQuery.data?.totalPages ?? 1;
  const firstVisiblePage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const visiblePages = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => firstVisiblePage + index);

  return (
    <main className="min-h-[55vh] bg-[#f2f5fa] px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 border-b border-[#d8e0ed] pb-4">
          <h1 className="text-xl font-bold uppercase text-[#0a224f] sm:text-2xl">Résultats de la recherche</h1>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-[#d8e0ed] bg-white px-4 py-2">
            <p className="text-sm text-slate-600">{productsQuery.isLoading ? "Recherche en cours…" : `Il y a ${total} produit${total > 1 ? "s" : ""}.`}</p>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <label htmlFor="search-sort">Trier par :</label>
              <Select value={sortBy} onValueChange={(value) => { setSortBy(value); setPage(1); }}>
                <SelectTrigger id="search-sort" className="h-9 min-w-40 border-0 shadow-none focus-visible:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {productsQuery.isError ? (
          <div className="rounded-xl border border-red-200 bg-white p-8 text-center text-sm text-red-700">
            Une erreur est survenue pendant la recherche. Veuillez réessayer.
          </div>
        ) : productsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 12 }, (_, index) => <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-white" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-[#d8e0ed] bg-white px-5 py-14 text-center">
            <Search className="mx-auto mb-3 size-8 text-slate-400" />
            <h2 className="text-lg font-semibold text-[#0a224f]">Aucun produit trouvé</h2>
            <p className="mt-2 text-sm text-slate-600">Essayez avec un autre nom, une marque ou une référence.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
              {products.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
            {totalPages > 1 ? (
              <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination des résultats">
                <Button variant="outline" disabled={page <= 1} onClick={() => { setPage((current) => current - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Précédent</Button>
                {visiblePages.map((pageNumber) => (
                  <Button key={pageNumber} variant={pageNumber === page ? "default" : "outline"} aria-current={pageNumber === page ? "page" : undefined} onClick={() => { setPage(pageNumber); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{pageNumber}</Button>
                ))}
                <Button variant="outline" disabled={page >= totalPages} onClick={() => { setPage((current) => current + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Suivant</Button>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

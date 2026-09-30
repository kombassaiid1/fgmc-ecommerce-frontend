"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";

import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { getProducts } from "@/lib/api/products";

const PAGE_SIZE = 24;

export function SearchResultsPage({ term }: { term: string }) {
  const [page, setPage] = useState(1);
  const productsQuery = useQuery({
    queryKey: ["search-results", term, page],
    queryFn: () => getProducts({ search: term, page, limit: PAGE_SIZE, status: "PUBLIC" }),
    enabled: Boolean(term),
  });
  const products = productsQuery.data?.data ?? [];
  const total = productsQuery.data?.meta.total ?? 0;
  const totalPages = productsQuery.data?.meta.totalPages ?? 1;

  return (
    <main className="min-h-[55vh] bg-[#f2f5fa] px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 border-b border-[#d8e0ed] pb-5">
          <p className="mb-1 text-sm text-slate-500">Recherche</p>
          <h1 className="text-2xl font-bold text-[#0a224f] sm:text-3xl">Résultats pour « {term} »</h1>
          {!productsQuery.isLoading && !productsQuery.isError ? (
            <p className="mt-2 text-sm text-slate-600">{total} produit{total > 1 ? "s" : ""} trouvé{total > 1 ? "s" : ""}</p>
          ) : null}
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
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button variant="outline" disabled={page <= 1} onClick={() => { setPage((current) => current - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Précédent</Button>
                <span className="text-sm text-slate-600">Page {page} sur {totalPages}</span>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => { setPage((current) => current + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Suivant</Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

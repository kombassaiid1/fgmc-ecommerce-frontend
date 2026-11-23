export type ProductSeoProposal = {
  keyphrase: string;
  metaTitle: string;
  slug: string;
  metaDescription: string;
};

export type ProductSeoCallbacks = {
  onKeyphraseChange: (value: string) => void;
  onMetaTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseProductSeoProposal(value: unknown): ProductSeoProposal {
  if (!isRecord(value)) {
    throw new Error('Réponse de génération SEO invalide.');
  }
  if (value.success !== true) {
    const error = typeof value.error === 'string' ? value.error.trim() : '';
    throw new Error(error || 'La génération SEO a échoué.');
  }
  if (!isRecord(value.seo)) {
    throw new Error('Réponse de génération SEO incomplète.');
  }

  const fields = ['keyphrase', 'metaTitle', 'slug', 'metaDescription'] as const;
  for (const field of fields) {
    if (typeof value.seo[field] !== 'string' || !value.seo[field].trim()) {
      throw new Error('Réponse de génération SEO incomplète.');
    }
  }

  return {
    keyphrase: (value.seo.keyphrase as string).trim(),
    metaTitle: (value.seo.metaTitle as string).trim(),
    slug: (value.seo.slug as string).trim(),
    metaDescription: (value.seo.metaDescription as string).trim(),
  };
}

export function applyProductSeoProposal(
  value: unknown,
  callbacks: ProductSeoCallbacks,
): ProductSeoProposal {
  const seo = parseProductSeoProposal(value);
  callbacks.onKeyphraseChange(seo.keyphrase);
  callbacks.onMetaTitleChange(seo.metaTitle);
  callbacks.onSlugChange(seo.slug);
  callbacks.onMetaDescriptionChange(seo.metaDescription);
  return seo;
}

export function createSingleFlightAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<void>,
): (...args: Args) => Promise<boolean> {
  let inFlight = false;
  return async (...args: Args) => {
    if (inFlight) return false;
    inFlight = true;
    try {
      await action(...args);
      return true;
    } finally {
      inFlight = false;
    }
  };
}

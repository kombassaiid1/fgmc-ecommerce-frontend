export type ProductSeoContentOptimizationInput = {
  productId?: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  imageCount: number;
  metaTitle: string;
  metaDescription: string;
  keyphrase: string;
};

export type ProductSeoContentPreview = {
  shortDescription: { before: string; after: string };
  description: { before: string; after: string };
};

export type ProductSeoContentOptimizationResult = {
  success: true;
  preview: ProductSeoContentPreview;
  validation: { attempts: number; remainingIssues: string[] };
};

export type ProductSeoContentCallbacks = {
  onShortDescriptionChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseProductSeoContentPreview(
  value: unknown,
  current: Pick<ProductSeoContentOptimizationInput, 'shortDescription' | 'description'>,
): ProductSeoContentOptimizationResult {
  if (!isRecord(value) || value.success !== true) {
    const error = isRecord(value) && typeof value.error === 'string' ? value.error : '';
    throw new Error(error || 'La génération de l’aperçu SEO a échoué.');
  }
  if (!isRecord(value.preview) || !isRecord(value.validation)) {
    throw new Error('Réponse d’optimisation SEO incomplète.');
  }
  const pairs = ['shortDescription', 'description'] as const;
  const preview = {} as ProductSeoContentPreview;
  for (const field of pairs) {
    const pair = value.preview[field];
    if (!isRecord(pair) || typeof pair.before !== 'string' || typeof pair.after !== 'string' || !pair.after.trim()) {
      throw new Error('Réponse d’optimisation SEO incomplète.');
    }
    if (pair.before !== current[field]) {
      throw new Error('Le contenu a changé depuis la génération. Relancez l’optimisation.');
    }
    preview[field] = { before: pair.before, after: pair.after };
  }
  const attempts = value.validation.attempts;
  if (!Number.isInteger(attempts) || (attempts as number) < 1 || (attempts as number) > 3 ||
      !Array.isArray(value.validation.remainingIssues) ||
      !value.validation.remainingIssues.every((issue) => typeof issue === 'string')) {
    throw new Error('Bilan de validation SEO invalide.');
  }
  return {
    success: true,
    preview,
    validation: { attempts: attempts as number, remainingIssues: value.validation.remainingIssues as string[] },
  };
}

/** The only form callbacks used by this flow are the two description fields. */
export function applyProductSeoContentPreview(
  preview: ProductSeoContentPreview,
  callbacks: ProductSeoContentCallbacks,
): void {
  callbacks.onShortDescriptionChange(preview.shortDescription.after);
  callbacks.onDescriptionChange(preview.description.after);
}

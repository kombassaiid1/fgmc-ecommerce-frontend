import { apiRequest } from './http-client';

export type SeoLevel = 'good' | 'ok' | 'bad';

export type SeoCheck = {
  id: string;
  level: SeoLevel;
  text: string;
};

export type SeoValidationInput = {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  imageCount: number;
  metaTitle: string;
  metaDescription: string;
  keyphrase: string;
};

export type SeoValidationResult = {
  keyChecks: SeoCheck[];
  contentChecks: SeoCheck[];
  readChecks: SeoCheck[];
  seoLevel: SeoLevel;
  readLevel: SeoLevel | null;
  effTitle: string;
};

export type ProductSeoGenerationInput = {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  imageCount: number;
  metaTitle: string;
  metaDescription: string;
  keyphrase: string;
};

export function validateProductSeo(
  input: SeoValidationInput,
  signal?: AbortSignal,
) {
  return apiRequest<SeoValidationResult>({
    path: '/seo/validate',
    method: 'POST',
    body: JSON.stringify(input),
    signal,
  });
}

export function generateProductSeo(input: ProductSeoGenerationInput): Promise<unknown> {
  return apiRequest<unknown>({
    path: '/improve-product/generate-seo',
    method: 'POST',
    body: JSON.stringify(input),
    timeoutMs: 185_000,
  });
}

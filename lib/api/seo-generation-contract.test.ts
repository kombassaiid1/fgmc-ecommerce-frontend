import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyProductSeoProposal,
  createSingleFlightAction,
  parseProductSeoProposal,
} from './seo-generation-contract.ts';

const response = {
  success: true,
  seo: {
    keyphrase: 'PFAFF 1245 bordage',
    metaTitle: 'PFAFF 1245 – Machine pour bordage',
    slug: 'pfaff-1245-bordage',
    metaDescription: 'Machine PFAFF 1245 pour travaux de bordage.',
  },
};

test('parses all four SEO fields from a structured response', () => {
  assert.deepEqual(parseProductSeoProposal(response), response.seo);
});

test('rejects failed or incomplete responses before invoking callbacks', () => {
  assert.throws(() => parseProductSeoProposal({ success: false, error: 'FastAPI indisponible' }), /FastAPI indisponible/);
  let calls = 0;
  assert.throws(() => applyProductSeoProposal({ success: true, seo: { keyphrase: 'x' } }, {
    onKeyphraseChange: () => calls++,
    onMetaTitleChange: () => calls++,
    onSlugChange: () => calls++,
    onMetaDescriptionChange: () => calls++,
  }), /incomplète/);
  assert.equal(calls, 0);
});

test('applies each generated value through its existing form callback', () => {
  const calls: string[] = [];
  applyProductSeoProposal(response, {
    onKeyphraseChange: (value) => calls.push(`keyphrase:${value}`),
    onMetaTitleChange: (value) => calls.push(`metaTitle:${value}`),
    onSlugChange: (value) => calls.push(`slug:${value}`),
    onMetaDescriptionChange: (value) => calls.push(`metaDescription:${value}`),
  });
  assert.deepEqual(calls, [
    'keyphrase:PFAFF 1245 bordage',
    'metaTitle:PFAFF 1245 – Machine pour bordage',
    'slug:pfaff-1245-bordage',
    'metaDescription:Machine PFAFF 1245 pour travaux de bordage.',
  ]);
});

test('prevents a second request while the first one is pending', async () => {
  let resolveFirst!: () => void;
  let calls = 0;
  const action = createSingleFlightAction(async () => {
    calls++;
    await new Promise<void>((resolve) => { resolveFirst = resolve; });
  });
  const first = action();
  assert.equal(await action(), false);
  assert.equal(calls, 1);
  resolveFirst();
  assert.equal(await first, true);
});

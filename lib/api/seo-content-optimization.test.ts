import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyProductSeoContentPreview,
  parseProductSeoContentPreview,
} from './seo-content-optimization.ts';

const current = { shortDescription: '<p>Résumé actuel</p>', description: '<p>Description actuelle</p>' };
const response = {
  success: true,
  preview: {
    shortDescription: { before: current.shortDescription, after: '<p>Résumé optimisé</p>' },
    description: { before: current.description, after: '<p>Description optimisée</p>' },
  },
  validation: { attempts: 2, remainingIssues: ['paragraphs'] },
};

test('preview parsing retains both before and after values without applying them', () => {
  const preview = parseProductSeoContentPreview(response, current);
  assert.equal(preview.preview.shortDescription.before, current.shortDescription);
  assert.equal(preview.preview.description.after, '<p>Description optimisée</p>');
});

test('canceling a preview performs no form update', () => {
  const updates: string[] = [];
  parseProductSeoContentPreview(response, current);
  // Cancel only discards the local preview; apply callbacks are deliberately not called.
  assert.deepEqual(updates, []);
});

test('applying updates only shortDescription and description', () => {
  const preview = parseProductSeoContentPreview(response, current).preview;
  const updates: Array<[string, string]> = [];
  applyProductSeoContentPreview(preview, {
    onShortDescriptionChange: (value) => updates.push(['shortDescription', value]),
    onDescriptionChange: (value) => updates.push(['description', value]),
  });
  assert.deepEqual(updates, [
    ['shortDescription', '<p>Résumé optimisé</p>'],
    ['description', '<p>Description optimisée</p>'],
  ]);
});

test('preview is rejected if either source field changed after generation', () => {
  assert.throws(() => parseProductSeoContentPreview(response, { ...current, description: 'edited meanwhile' }), /changé depuis la génération/);
});

test('failure responses and malformed proposals are not applicable', () => {
  assert.throws(() => parseProductSeoContentPreview({ success: false, error: 'protected_media_integrity_failed' }, current), /protected_media_integrity_failed/);
  assert.throws(() => parseProductSeoContentPreview({ success: true }, current), /incomplète/);
});

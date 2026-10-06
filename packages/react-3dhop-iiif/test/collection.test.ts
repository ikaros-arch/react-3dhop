import { describe, expect, it, vi } from 'vitest';
import { loadCollection, parseCollection } from '../src/iiif/collection.js';
import type { Diagnostic, IIIFCollection } from '../src/iiif/types.js';

function collect(): { diagnostics: Diagnostic[]; onDiagnostic: (d: Diagnostic) => void } {
  const diagnostics: Diagnostic[] = [];
  return { diagnostics, onDiagnostic: (d) => diagnostics.push(d) };
}

describe('parseCollection', () => {
  it('reads the label, summary, and items of a minimal collection', () => {
    const parsed = parseCollection({
      type: 'Collection',
      label: { en: ['Demo Collection'] },
      summary: { en: ['A few objects'] },
      items: [{ id: 'https://example.org/manifests/a.json', type: 'Manifest', label: { en: ['Object A'] } }]
    });

    expect(parsed.label).toBe('Demo Collection');
    expect(parsed.summary).toBe('A few objects');
    expect(parsed.items).toEqual([
      {
        id: 'https://example.org/manifests/a.json',
        label: 'Object A',
        summary: undefined,
        thumbnail: undefined,
        fields: []
      }
    ]);
  });

  it('resolves an item\'s own metadata into fields, without dereferencing the manifest', () => {
    const parsed = parseCollection({
      items: [
        {
          id: 'https://example.org/manifests/a.json',
          label: { en: ['Object A'] },
          metadata: [
            { label: { en: ['Period'] }, value: { en: ['Viking age'] } },
            { label: { en: ['Museum'] }, value: { en: ['KHM'] } }
          ]
        }
      ]
    });

    expect(parsed.items[0].fields).toEqual([
      { label: 'Period', value: 'Viking age' },
      { label: 'Museum', value: 'KHM' }
    ]);
  });

  it('falls back to the item id when it has no label', () => {
    const parsed = parseCollection({ items: [{ id: 'https://example.org/manifests/a.json' }] });
    expect(parsed.items[0].label).toBe('https://example.org/manifests/a.json');
  });

  it('falls back to "Untitled Collection" when the collection has no label', () => {
    expect(parseCollection({ items: [] }).label).toBe('Untitled Collection');
  });

  it('takes the first thumbnail when several are given', () => {
    const parsed = parseCollection({
      items: [
        {
          id: 'https://example.org/manifests/a.json',
          thumbnail: [{ id: 'https://example.org/thumb-large.jpg' }, { id: 'https://example.org/thumb-small.jpg' }]
        }
      ]
    });
    expect(parsed.items[0].thumbnail).toBe('https://example.org/thumb-large.jpg');
  });

  it('accepts a single thumbnail object as well as an array', () => {
    const parsed = parseCollection({
      items: [{ id: 'https://example.org/manifests/a.json', thumbnail: { id: 'https://example.org/thumb.jpg' } }]
    });
    expect(parsed.items[0].thumbnail).toBe('https://example.org/thumb.jpg');
  });

  it('reports and skips an item with no id', () => {
    const { diagnostics, onDiagnostic } = collect();
    const parsed = parseCollection({ items: [{ label: { en: ['No id'] } } as never] }, { onDiagnostic });

    expect(parsed.items).toEqual([]);
    expect(diagnostics.some((d) => d.level === 'warning' && d.message.includes('no id'))).toBe(true);
  });

  it('reports and skips an item of an unsupported type', () => {
    const { diagnostics, onDiagnostic } = collect();
    const parsed = parseCollection(
      { items: [{ id: 'https://example.org/nested', type: 'Collection' }] },
      { onDiagnostic }
    );

    expect(parsed.items).toEqual([]);
    expect(diagnostics.some((d) => d.message.includes('"Collection"'))).toBe(true);
  });

  it('reports an empty collection', () => {
    const { diagnostics, onDiagnostic } = collect();
    parseCollection({ items: [] }, { onDiagnostic });
    expect(diagnostics.some((d) => d.message.includes('no items'))).toBe(true);
  });

  it('resolves labels in the requested language', () => {
    const parsed = parseCollection(
      { label: { en: ['English'], no: ['Norsk'] }, items: [] },
      { language: 'no' }
    );
    expect(parsed.label).toBe('Norsk');
  });
});

describe('loadCollection', () => {
  const ok = (body: unknown) =>
    vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => body })) as never;

  const sample: IIIFCollection = {
    type: 'Collection',
    label: { en: ['Fetched Collection'] },
    items: [{ id: 'https://example.org/manifests/a.json', label: { en: ['Object A'] } }]
  };

  it('fetches and parses', async () => {
    const parsed = await loadCollection('https://example.org/collection.json', { fetchImpl: ok(sample) });
    expect(parsed.label).toBe('Fetched Collection');
    expect(parsed.items).toHaveLength(1);
  });

  it('rejects with the status on an HTTP error', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) }));
    await expect(
      loadCollection('https://example.org/missing.json', { fetchImpl: fetchImpl as never })
    ).rejects.toThrow(/404 Not Found/);
  });

  it('rejects when the body is not an object', async () => {
    await expect(
      loadCollection('https://example.org/collection.json', { fetchImpl: ok('a string') })
    ).rejects.toThrow(/not a JSON object/);
  });
});

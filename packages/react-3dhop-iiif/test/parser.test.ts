import { describe, expect, it, vi } from 'vitest';
import { FORMAT_PREFERENCE, loadManifest, parseManifest, selectBestSource } from '../src/iiif/parser.js';
import { collectLanguages, resolveLanguageMap } from '../src/iiif/language.js';
import type { Diagnostic, IIIFAnnotation, IIIFManifest } from '../src/iiif/types.js';
import advanced from './fixtures/advanced.json' with { type: 'json' };
import astronaut from './fixtures/astronaut.json' with { type: 'json' };

/** Wraps annotations in the Manifest → Scene → AnnotationPage nesting the parser walks. */
function manifestWith(items: IIIFAnnotation[], extra: Partial<IIIFManifest> = {}): IIIFManifest {
  return {
    id: 'https://example.org/manifest.json',
    type: 'Manifest',
    label: { en: ['Test'] },
    ...extra,
    items: [
      {
        id: 'https://example.org/scene/1',
        type: 'Scene',
        items: [{ id: 'https://example.org/page/1', type: 'AnnotationPage', items }]
      }
    ]
  };
}

function modelAnnotation(overrides: Partial<IIIFAnnotation> = {}): IIIFAnnotation {
  return {
    id: 'https://example.org/anno/1',
    type: 'Annotation',
    motivation: ['painting'],
    body: { id: 'https://example.org/m.nxz', type: 'Model', format: 'Nexus' },
    ...overrides
  };
}

function collect(): { diagnostics: Diagnostic[]; onDiagnostic: (d: Diagnostic) => void } {
  const diagnostics: Diagnostic[] = [];
  return { diagnostics, onDiagnostic: (d) => diagnostics.push(d) };
}

describe('parseManifest — minimal manifest', () => {
  it('reads a single model with no target', () => {
    const parsed = parseManifest(manifestWith([modelAnnotation()]));

    expect(parsed.models).toHaveLength(1);
    expect(parsed.models[0]).toMatchObject({
      id: 'https://example.org/anno/1',
      url: 'https://example.org/m.nxz',
      format: 'Nexus',
      position: [0, 0, 0],
      transforms: []
    });
    expect(parsed.cameras).toEqual([]);
  });

  it('reads the manifest label', () => {
    expect(parseManifest(manifestWith([])).metadata.label).toBe('Test');
  });

  it('does not throw on a manifest with no items at all', () => {
    const { diagnostics, onDiagnostic } = collect();
    const parsed = parseManifest({ type: 'Manifest' }, { onDiagnostic });

    expect(parsed.models).toEqual([]);
    expect(parsed.cameras).toEqual([]);
    expect(diagnostics.some((d) => d.message.includes('no Scene'))).toBe(true);
  });
});

describe('parseManifest — point selector', () => {
  it('reads a PointSelector from an object target', () => {
    const parsed = parseManifest(
      manifestWith([
        modelAnnotation({
          target: { type: 'SpecificResource', selector: [{ type: 'PointSelector', x: 1, y: 2, z: 3 }] }
        })
      ])
    );
    expect(parsed.models[0].position).toEqual([1, 2, 3]);
  });

  it('reads a PointSelector from an array target with a non-array selector', () => {
    const parsed = parseManifest(
      manifestWith([
        modelAnnotation({
          target: [{ type: 'SpecificResource', selector: { type: 'PointSelector', x: -1, y: 0, z: 5 } }]
        })
      ])
    );
    expect(parsed.models[0].position).toEqual([-1, 0, 5]);
  });

  it('defaults omitted axes to zero', () => {
    const parsed = parseManifest(
      manifestWith([
        modelAnnotation({ target: { type: 'SpecificResource', selector: [{ type: 'PointSelector', y: 7 }] } })
      ])
    );
    expect(parsed.models[0].position).toEqual([0, 7, 0]);
  });

  it('ignores a plain string target', () => {
    const parsed = parseManifest(
      manifestWith([modelAnnotation({ target: 'https://example.org/scene/1' })])
    );
    expect(parsed.models[0].position).toEqual([0, 0, 0]);
  });
});

describe('parseManifest — transforms', () => {
  const withTransform = (transform: unknown[]) =>
    parseManifest(
      manifestWith([
        modelAnnotation({
          body: {
            type: 'SpecificResource',
            source: [{ id: 'https://example.org/m.nxz', type: 'Model', format: 'Nexus' }],
            transform: transform as never
          }
        })
      ])
    ).models[0].transforms;

  it('keeps a scale transform verbatim', () => {
    expect(withTransform([{ type: 'ScaleTransform', x: 2, y: 2, z: 2 }])).toEqual([
      { type: 'ScaleTransform', x: 2, y: 2, z: 2 }
    ]);
  });

  it('keeps a translate transform verbatim', () => {
    expect(withTransform([{ type: 'TranslateTransform', x: 1, y: 0, z: -1 }])).toEqual([
      { type: 'TranslateTransform', x: 1, y: 0, z: -1 }
    ]);
  });

  it('keeps a rotate transform verbatim', () => {
    expect(withTransform([{ type: 'RotateTransform', x: 90, y: 0, z: 0 }])).toEqual([
      { type: 'RotateTransform', x: 90, y: 0, z: 0 }
    ]);
  });

  it('preserves the authored order of a combined list', () => {
    const list = [
      { type: 'ScaleTransform', x: 2, y: 2, z: 2 },
      { type: 'RotateTransform', y: 45 },
      { type: 'TranslateTransform', x: 5 }
    ];
    expect(withTransform(list).map((t) => t.type)).toEqual([
      'ScaleTransform',
      'RotateTransform',
      'TranslateTransform'
    ]);
  });

  it('gives a bare Model body an empty transform list', () => {
    // Transforms live on the SpecificResource wrapper; a bare Model has nowhere to put them.
    expect(parseManifest(manifestWith([modelAnnotation()])).models[0].transforms).toEqual([]);
  });
});

describe('selectBestSource', () => {
  it('returns undefined for a missing source', () => {
    expect(selectBestSource(undefined)).toBeUndefined();
  });

  it('passes a single non-array source through', () => {
    const source = { id: 'a', format: 'ply' };
    expect(selectBestSource(source)).toBe(source);
  });

  it('prefers Nexus over PLY regardless of authored order', () => {
    const ply = { id: 'a.ply', format: 'PLY' };
    const nxz = { id: 'a.nxz', format: 'Nexus' };
    expect(selectBestSource([ply, nxz])).toBe(nxz);
    expect(selectBestSource([nxz, ply])).toBe(nxz);
  });

  it('ranks nexus > ply > obj > glb', () => {
    const sources = [
      { id: 'a.glb', format: 'glb' },
      { id: 'a.obj', format: 'obj' },
      { id: 'a.ply', format: 'ply' },
      { id: 'a.nxz', format: 'nxz' }
    ];
    expect(selectBestSource(sources)?.id).toBe('a.nxz');
    expect(selectBestSource(sources.slice(0, 3))?.id).toBe('a.ply');
    expect(selectBestSource(sources.slice(0, 2))?.id).toBe('a.obj');
  });

  it('understands MIME types as well as extensions', () => {
    expect(
      selectBestSource([
        { id: 'a.glb', format: 'model/gltf-binary' },
        { id: 'a.nxz', format: 'application/octet-stream+nexus' }
      ])?.id
    ).toBe('a.nxz');
  });

  it('ranks an unknown format below every known one', () => {
    expect(
      selectBestSource([{ id: 'a.xyz', format: 'xyz' }, { id: 'a.glb', format: 'glb' }])?.id
    ).toBe('a.glb');
    expect(FORMAT_PREFERENCE.xyz).toBeUndefined();
  });

  it('does not mutate the caller\'s array', () => {
    const sources = [{ id: 'a.ply', format: 'ply' }, { id: 'a.nxz', format: 'nxz' }];
    selectBestSource(sources);
    expect(sources[0].id).toBe('a.ply');
  });
});

describe('parseManifest — cameras', () => {
  it('reads a perspective camera with fieldOfView and an explicit lookAt', () => {
    const parsed = parseManifest(
      manifestWith([
        {
          id: 'https://example.org/anno/cam',
          type: 'Annotation',
          body: {
            id: 'https://example.org/cam/1',
            type: 'PerspectiveCamera',
            label: { en: ['Front'] },
            fieldOfView: 55,
            lookAt: { type: 'PointSelector', x: 1, y: 2, z: 3 }
          },
          target: { type: 'SpecificResource', selector: [{ type: 'PointSelector', x: 0, y: 0, z: -5 }] }
        }
      ])
    );

    expect(parsed.cameras).toHaveLength(1);
    expect(parsed.cameras[0]).toMatchObject({
      id: 'https://example.org/cam/1',
      type: 'PerspectiveCamera',
      fov: 55,
      position: [0, 0, -5],
      target: [1, 2, 3]
    });
  });

  it('accepts the shorthand fov spelling', () => {
    const parsed = parseManifest(
      manifestWith([
        { id: 'c', type: 'Annotation', body: { type: 'PerspectiveCamera', fov: 35 } }
      ])
    );
    expect(parsed.cameras[0].fov).toBe(35);
  });

  it('records a lookAt reference to another annotation', () => {
    const parsed = parseManifest(
      manifestWith([
        {
          id: 'c',
          type: 'Annotation',
          body: {
            type: 'OrthographicCamera',
            lookAt: { id: 'https://example.org/anno/model2', type: 'Annotation' }
          }
        }
      ])
    );
    expect(parsed.cameras[0].type).toBe('OrthographicCamera');
    expect(parsed.cameras[0].lookAtId).toBe('https://example.org/anno/model2');
    expect(parsed.cameras[0].target).toBeUndefined();
  });

  it('leaves fov unset when the manifest gives none', () => {
    const parsed = parseManifest(
      manifestWith([{ id: 'c', type: 'Annotation', body: { type: 'PerspectiveCamera' } }])
    );
    expect(parsed.cameras[0].fov).toBeUndefined();
  });
});

describe('parseManifest — multi-model', () => {
  it('keeps every model in manifest order', () => {
    const parsed = parseManifest(
      manifestWith([
        modelAnnotation({ id: 'a', body: { id: 'a.nxz', type: 'Model' } }),
        modelAnnotation({ id: 'b', body: { id: 'b.nxz', type: 'Model' } }),
        modelAnnotation({ id: 'c', body: { id: 'c.nxz', type: 'Model' } })
      ])
    );
    expect(parsed.models.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('merges models across several scenes and reports doing so', () => {
    const { diagnostics, onDiagnostic } = collect();
    const scene = (id: string, url: string) => ({
      id,
      type: 'Scene',
      items: [
        {
          type: 'AnnotationPage',
          items: [{ id: `${id}/anno`, type: 'Annotation', body: { id: url, type: 'Model' } }]
        }
      ]
    });

    const parsed = parseManifest(
      { type: 'Manifest', items: [scene('s1', 'a.nxz'), scene('s2', 'b.nxz')] },
      { onDiagnostic }
    );

    expect(parsed.models).toHaveLength(2);
    expect(diagnostics.some((d) => d.message.includes('2 scenes'))).toBe(true);
  });

  it('falls back to the source URL when an annotation has no id', () => {
    const parsed = parseManifest(
      manifestWith([{ type: 'Annotation', body: { id: 'https://example.org/m.nxz', type: 'Model' } }])
    );
    expect(parsed.models[0].id).toBe('https://example.org/m.nxz');
  });
});

describe('parseManifest — units', () => {
  it('lifts Measure Unit and Display Unit out of the metadata', () => {
    const parsed = parseManifest(
      manifestWith([], {
        metadata: [
          { label: { en: ['Measure Unit'] }, value: { en: ['mm'] } },
          { label: { en: ['Display Unit'] }, value: { en: ['cm'] } }
        ]
      })
    );
    expect(parsed.metadata.measureUnit).toBe('mm');
    expect(parsed.metadata.displayUnit).toBe('cm');
  });

  it('recognises the Norwegian labels too', () => {
    const parsed = parseManifest(
      manifestWith([], {
        metadata: [
          { label: { no: ['Måleenhet'] }, value: { no: ['mm'] } },
          { label: { no: ['Visningsenhet'] }, value: { no: ['m'] } }
        ]
      }),
      { language: 'no' }
    );
    expect(parsed.metadata.measureUnit).toBe('mm');
    expect(parsed.metadata.displayUnit).toBe('m');
  });

  it('reads a per-source measureUnit override', () => {
    const parsed = parseManifest(
      manifestWith([
        modelAnnotation({
          body: {
            type: 'SpecificResource',
            source: [{ id: 'm.nxz', type: 'Model', format: 'Nexus', measureUnit: 'mm' }]
          }
        })
      ])
    );
    expect(parsed.models[0].measureUnit).toBe('mm');
  });
});

describe('parseManifest — multilingual', () => {
  it('resolves metadata into the requested language', () => {
    const parsed = parseManifest(advanced as IIIFManifest, { language: 'no' });
    expect(parsed.metadata.label).toBe('Avansert fleremodellscene');
    expect(parsed.metadata.attribution).toBe('Modeller fra IIIF 3D Community Group. CC-BY 4.0');
  });

  it('matches known fields on the English label even in another language', () => {
    // The mapping must survive a language switch, so it keys off the canonical English label.
    const parsed = parseManifest(advanced as IIIFManifest, { language: 'no' });
    expect(parsed.metadata.objectId).toBe('multi_model_scene');
    expect(parsed.metadata.measureUnit).toBe('m');
  });

  it('lists every language the manifest uses, excluding "none"', () => {
    const parsed = parseManifest(advanced as IIIFManifest);
    expect(parsed.languages).toEqual(['en', 'no', 'se']);
  });

  it('falls back when the requested language is missing from a map', () => {
    // "se" appears only on some entries; the rest must still resolve.
    const parsed = parseManifest(advanced as IIIFManifest, { language: 'se' });
    expect(parsed.metadata.fields.find((f) => f.label === 'Sámáldu')?.value).toBe('IIIF 3D Exempela');
    expect(parsed.metadata.label).toBe('Advanced Multi-Model Scene');
  });
});

describe('resolveLanguageMap', () => {
  it('returns a bare string unchanged', () => {
    expect(resolveLanguageMap('plain', 'en')).toBe('plain');
  });

  it('returns an empty string for null or undefined', () => {
    expect(resolveLanguageMap(undefined, 'en')).toBe('');
    expect(resolveLanguageMap(null, 'en')).toBe('');
  });

  it('prefers the requested language', () => {
    expect(resolveLanguageMap({ en: ['E'], no: ['N'] }, 'no')).toBe('N');
  });

  it('walks the fallback chain in order', () => {
    expect(resolveLanguageMap({ nb: ['B'], no: ['N'] }, 'de')).toBe('N');
  });

  it('takes any remaining language rather than returning nothing', () => {
    expect(resolveLanguageMap({ se: ['S'] }, 'de')).toBe('S');
  });

  it('accepts a plain string value inside the map', () => {
    expect(resolveLanguageMap({ en: 'E' }, 'en')).toBe('E');
  });

  it('skips an empty array', () => {
    expect(resolveLanguageMap({ en: [], no: ['N'] }, 'en')).toBe('N');
  });
});

describe('collectLanguages', () => {
  it('excludes the "none" tag', () => {
    expect(Array.from(collectLanguages({ label: { en: ['a'], none: ['b'] } }))).toEqual(['en']);
  });

  it('recurses through arrays and nested objects', () => {
    const tags = collectLanguages({ items: [{ nested: { label: { de: ['x'] } } }] });
    expect(Array.from(tags)).toEqual(['de']);
  });

  it('returns nothing for a value with no language maps', () => {
    expect(Array.from(collectLanguages({ a: 1, b: { c: 2 } }))).toEqual([]);
  });

  it('does not mistake a model source for a language map', () => {
    // Regression: every value here is a string, so a shape-based check offered "id", "type" and
    // "format" to the user as languages.
    const tags = collectLanguages({
      body: { id: 'https://example.org/m.nxz', type: 'Model', format: 'Nexus', measureUnit: 'mm' }
    });
    expect(Array.from(tags)).toEqual([]);
  });

  it('only reads the properties IIIF defines as language maps', () => {
    const tags = collectLanguages({
      label: { en: ['a'] },
      value: { fr: ['b'] },
      summary: { de: ['c'] },
      format: { xx: ['not a language map'] }
    });
    expect(Array.from(tags).sort()).toEqual(['de', 'en', 'fr']);
  });
});

describe('parseManifest — malformed input', () => {
  it('skips a SpecificResource with no usable source and reports it', () => {
    const { diagnostics, onDiagnostic } = collect();
    const parsed = parseManifest(
      manifestWith([modelAnnotation({ body: { type: 'SpecificResource', source: [] } })]),
      { onDiagnostic }
    );

    expect(parsed.models).toEqual([]);
    expect(diagnostics.some((d) => d.level === 'warning' && d.message.includes('no usable source'))).toBe(
      true
    );
  });

  it('skips a model with no source URL and reports it', () => {
    const { diagnostics, onDiagnostic } = collect();
    const parsed = parseManifest(
      manifestWith([modelAnnotation({ body: { type: 'Model', format: 'Nexus' } })]),
      { onDiagnostic }
    );

    expect(parsed.models).toEqual([]);
    expect(diagnostics.some((d) => d.message.includes('no source URL'))).toBe(true);
  });

  it('keeps the good models when one annotation is broken', () => {
    const parsed = parseManifest(
      manifestWith([
        modelAnnotation({ id: 'bad', body: { type: 'Model' } }),
        modelAnnotation({ id: 'good', body: { id: 'g.nxz', type: 'Model' } })
      ])
    );
    expect(parsed.models.map((m) => m.id)).toEqual(['good']);
  });

  it.each([
    ['glb', 'glTF'],
    ['gltf', 'glTF'],
    ['model/gltf-binary', 'glTF'],
    ['model/gltf+json', 'glTF'],
    ['obj', 'OBJ'],
    ['model/obj', 'OBJ']
  ])('warns that %s cannot be rendered but still returns the model', (format, name) => {
    const { diagnostics, onDiagnostic } = collect();
    const parsed = parseManifest(
      manifestWith([modelAnnotation({ body: { id: `a.${format}`, type: 'Model', format } })]),
      { onDiagnostic }
    );

    expect(parsed.models).toHaveLength(1);
    expect(
      diagnostics.some((d) => d.level === 'warning' && d.message.includes(`is ${name}, which 3DHOP cannot render`))
    ).toBe(true);
  });

  it.each(['nexus', 'Nexus', 'nxz', 'ply', 'PLY'])('does not warn about %s', (format) => {
    const { diagnostics, onDiagnostic } = collect();
    parseManifest(manifestWith([modelAnnotation({ body: { id: 'a', type: 'Model', format } })]), {
      onDiagnostic
    });

    expect(diagnostics.some((d) => d.message.includes('cannot render'))).toBe(false);
  });

  it('reports an unsupported body type instead of failing', () => {
    const { diagnostics, onDiagnostic } = collect();
    const parsed = parseManifest(
      manifestWith([{ id: 'x', type: 'Annotation', body: { type: 'Light' } }]),
      { onDiagnostic }
    );

    expect(parsed.models).toEqual([]);
    expect(diagnostics.some((d) => d.message.includes('"Light"'))).toBe(true);
  });

  it('ignores items that are not Scenes', () => {
    const { onDiagnostic, diagnostics } = collect();
    const parsed = parseManifest(
      { type: 'Manifest', items: [{ id: 'c1', type: 'Canvas' } as never] },
      { onDiagnostic }
    );
    expect(parsed.models).toEqual([]);
    expect(diagnostics.some((d) => d.message.includes('no Scene'))).toBe(true);
  });

  it('ignores a scene child that is not an AnnotationPage', () => {
    const parsed = parseManifest({
      type: 'Manifest',
      items: [{ id: 's', type: 'Scene', items: [{ id: 'p', type: 'Canvas' } as never] }]
    });
    expect(parsed.models).toEqual([]);
  });
});

describe('loadManifest', () => {
  const ok = (body: unknown) =>
    vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => body })) as never;

  it('fetches and parses', async () => {
    const parsed = await loadManifest('https://example.org/m.json', {
      fetchImpl: ok(astronaut)
    });
    expect(parsed.metadata.label).toBe('Astronaut 3D Model');
    expect(parsed.models).toHaveLength(1);
    expect(parsed.cameras).toHaveLength(1);
  });

  it('forwards the abort signal to fetch', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => astronaut
    }));

    await loadManifest('https://example.org/m.json', {
      fetchImpl: fetchImpl as never,
      signal: controller.signal
    });

    expect(fetchImpl).toHaveBeenCalledWith('https://example.org/m.json', {
      signal: controller.signal
    });
  });

  it('rejects with the status on an HTTP error', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({})
    }));

    await expect(
      loadManifest('https://example.org/missing.json', { fetchImpl: fetchImpl as never })
    ).rejects.toThrow(/404 Not Found/);
  });

  it('rejects with the underlying reason on invalid JSON', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      }
    }));

    await expect(
      loadManifest('https://example.org/m.json', { fetchImpl: fetchImpl as never })
    ).rejects.toThrow(/not valid JSON: Unexpected token </);
  });

  it('rejects when the body is not an object', async () => {
    await expect(
      loadManifest('https://example.org/m.json', { fetchImpl: ok('a string') })
    ).rejects.toThrow(/not a JSON object/);
  });
});

describe('parseManifest — fixtures', () => {
  it('parses the astronaut manifest', () => {
    const parsed = parseManifest(astronaut as IIIFManifest);

    expect(parsed.metadata).toMatchObject({
      label: 'Astronaut 3D Model',
      museum: 'IIIF Example Collection',
      inventory: 'ASTRO-001',
      objectId: 'astronaut_glb',
      measureUnit: 'm',
      displayUnit: 'm',
      attribution: '© IIIF Consortium. CC-BY 4.0'
    });
    expect(parsed.models[0].url).toMatch(/astronaut\.nxz$/);
    expect(parsed.cameras[0]).toMatchObject({ fov: 45, position: [0, 1.5, -3] });
    expect(parsed.languages).toEqual(['en', 'no']);
  });

  it('parses the advanced manifest', () => {
    const { diagnostics, onDiagnostic } = collect();
    const parsed = parseManifest(advanced as IIIFManifest, { onDiagnostic });

    expect(parsed.models).toHaveLength(3);
    expect(parsed.cameras).toHaveLength(4);
    expect(diagnostics).toEqual([]);

    // Two of the three annotations carry ordered transform lists.
    expect(parsed.models.map((m) => m.transforms.length)).toEqual([0, 3, 3]);
    expect(parsed.models.map((m) => m.position)).toEqual([
      [-2, 0, 0],
      [2, 0, 0],
      [0, 0, 2]
    ]);
  });

  it('picks the Nexus source over the PLY listed before it', () => {
    const parsed = parseManifest(advanced as IIIFManifest);
    expect(parsed.models[2].url).toMatch(/astronaut\.nxz$/);
    expect(parsed.models[2].format).toBe('Nexus');
  });

  it('reads the per-model measureUnit override on the second model', () => {
    const parsed = parseManifest(advanced as IIIFManifest);
    expect(parsed.models[1].measureUnit).toBe('mm');
    expect(parsed.metadata.measureUnit).toBe('m');
  });

  it('reads the two body-as-array camera annotations', () => {
    const parsed = parseManifest(advanced as IIIFManifest);
    const saved = parsed.cameras.find((c) => c.id === 'https://example.org/iiif/3d/cameras/saved');
    expect(saved).toMatchObject({ fov: 60, target: [-1.375, -0.924, -0.952] });
    expect(saved?.position).toEqual([-4.465, 0.767, 5.813]);
  });
});

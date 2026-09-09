import { describe, expect, it } from 'vitest';
import { layoutManifests, sceneFromManifests } from '../src/iiif/toMultiModels.js';
import type { ParsedManifest, ParsedModel, Vector3 } from '../src/iiif/types.js';

function makeModel(id: string, url: string, position: Vector3 = [0, 0, 0]): ParsedModel {
  return { id, url, position, transforms: [] };
}

function makeManifest(id: string, models: ParsedModel[]): ParsedManifest {
  return {
    manifest: { id },
    metadata: { label: id, measureUnit: 'mm', displayUnit: 'mm' },
    models,
    cameras: [],
    languages: []
  };
}

function distance(a: Vector3, b: Vector3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe('layoutManifests', () => {
  it('separates equal-radius circles by at least 2r + gap', () => {
    const offsets = layoutManifests([10, 10, 10], { gap: 5, columns: 3 });
    for (let i = 0; i < offsets.length; i += 1) {
      for (let j = i + 1; j < offsets.length; j += 1) {
        expect(distance(offsets[i], offsets[j])).toBeGreaterThanOrEqual(2 * 10 + 5 - 1e-9);
      }
    }
  });

  it('wraps onto a new row after `columns` entries', () => {
    const offsets = layoutManifests([10, 10, 10, 10], { gap: 5, columns: 2 });
    // Rows differ in Z, so the third and fourth offsets shouldn't share the first row's Z value.
    const rowZValues = new Set(offsets.map((offset) => offset[2]));
    expect(rowZValues.size).toBe(2);
  });

  it('returns an empty array for no input', () => {
    expect(layoutManifests([], { gap: 5, columns: 1 })).toEqual([]);
  });
});

describe('sceneFromManifests', () => {
  it('never overlaps two single-point manifests, even when both sit at the origin', () => {
    const a = makeManifest('a', [makeModel('model-a', 'a.nxs')]);
    const b = makeManifest('b', [makeModel('model-b', 'b.nxs')]);

    const scene = sceneFromManifests([a, b], ['a', 'b'], { minRadius: 100, gap: 50 });

    expect(scene.manifests).toHaveLength(2);
    const [entryA, entryB] = scene.manifests;
    expect(distance(entryA.offset, entryB.offset)).toBeGreaterThanOrEqual(2 * 100 + 50 - 1e-9);
  });

  it('keeps a multi-part manifest\'s internal relative placement after the group offset', () => {
    const multiPart = makeManifest('multi', [
      makeModel('part-1', 'p1.nxs', [0, 0, 0]),
      makeModel('part-2', 'p2.nxs', [300, 0, 0])
    ]);
    const other = makeManifest('other', [makeModel('solo', 'solo.nxs')]);

    const scene = sceneFromManifests([multiPart, other], ['multi', 'other'], { minRadius: 100, gap: 50 });
    const multiEntry = scene.manifests.find((entry) => entry.key === 'multi')!;

    const part1Key = multiEntry.instanceIdsByModelId['part-1'];
    const part2Key = multiEntry.instanceIdsByModelId['part-2'];
    const part1Matrix = scene.models[part1Key].transform!.matrix!;
    const part2Matrix = scene.models[part2Key].transform!.matrix!;

    const part1Translation: Vector3 = [part1Matrix[12], part1Matrix[13], part1Matrix[14]];
    const part2Translation: Vector3 = [part2Matrix[12], part2Matrix[13], part2Matrix[14]];

    expect(distance(part1Translation, part2Translation)).toBeCloseTo(300, 6);
  });

  it('keeps model and mesh keys globally unique across manifests with colliding annotation ids', () => {
    const a = makeManifest('a', [makeModel('same-id', 'shared-name.nxs')]);
    const b = makeManifest('b', [makeModel('same-id', 'shared-name.nxs')]);

    const scene = sceneFromManifests([a, b], ['a', 'b']);

    const keys = Object.keys(scene.models);
    expect(new Set(keys).size).toBe(keys.length);

    const meshIds = Object.values(scene.models).map((model) => model.meshId);
    expect(new Set(meshIds).size).toBe(meshIds.length);
  });
});

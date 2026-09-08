import { describe, expect, it } from 'vitest';
import { getUnitScaleFactor, isKnownUnit, UNITS_IN_METRES } from '../src/iiif/units.js';

describe('isKnownUnit', () => {
  it.each(['km', 'm', 'cm', 'mm', 'um', 'µm', 'nm'])('recognises %s', (unit) => {
    expect(isKnownUnit(unit)).toBe(true);
  });

  it('trims before matching, since manifests are hand-authored', () => {
    expect(isKnownUnit(' mm ')).toBe(true);
  });

  it.each([undefined, null, '', 'metres', 'MM', 'inch'])('rejects %s', (unit) => {
    expect(isKnownUnit(unit)).toBe(false);
  });
});

describe('getUnitScaleFactor', () => {
  // Each row: [from, to, expected multiplier].
  const table: Array<[string, string, number]> = [
    ['mm', 'mm', 1],
    ['m', 'm', 1],
    ['mm', 'm', 0.001],
    ['m', 'mm', 1000],
    ['cm', 'mm', 10],
    ['mm', 'cm', 0.1],
    ['km', 'm', 1000],
    ['m', 'km', 0.001],
    ['km', 'mm', 1000000],
    ['cm', 'm', 0.01],
    ['m', 'cm', 100],
    ['um', 'mm', 0.001],
    ['mm', 'um', 1000],
    ['µm', 'um', 1],
    ['nm', 'um', 0.001],
    ['um', 'nm', 1000],
    ['nm', 'm', 1e-9],
    ['m', 'nm', 1e9]
  ];

  it.each(table)('converts %s → %s by %d', (from, to, expected) => {
    // Compared as a ratio: the factors span 18 orders of magnitude, so an absolute tolerance is
    // either meaningless at the top of the range or unreachable at the bottom.
    expect(getUnitScaleFactor(from, to) / expected).toBeCloseTo(1, 9);
  });

  it('is self-inverse across every known pair', () => {
    const units = Object.keys(UNITS_IN_METRES);
    for (const from of units) {
      for (const to of units) {
        const round = getUnitScaleFactor(from, to) * getUnitScaleFactor(to, from);
        expect(round).toBeCloseTo(1, 9);
      }
    }
  });

  it('treats an unknown unit as a factor of 1 rather than raising', () => {
    // A typo'd unit should still render the model, just unscaled.
    expect(getUnitScaleFactor('furlong', 'm')).toBe(1);
    expect(getUnitScaleFactor('m', 'furlong')).toBe(1);
    expect(getUnitScaleFactor('mm', 'furlong')).toBe(0.001);
  });

  it('treats missing units as a factor of 1', () => {
    expect(getUnitScaleFactor(undefined, undefined)).toBe(1);
    expect(getUnitScaleFactor(undefined, 'm')).toBe(1);
    expect(getUnitScaleFactor('m', null)).toBe(1);
  });

  it('ignores surrounding whitespace', () => {
    expect(getUnitScaleFactor(' mm', 'm ')).toBeCloseTo(0.001, 12);
  });
});

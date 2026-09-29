/**
 * Length units the viewer understands, expressed as their size in metres.
 *
 * `um` and `µm` are both accepted because manifests are hand-authored and the micro sign is
 * awkward to type.
 */
export const UNITS_IN_METRES: Record<string, number> = {
  km: 1000,
  m: 1,
  cm: 0.01,
  mm: 0.001,
  um: 0.000001,
  'µm': 0.000001,
  nm: 0.000000001
};

export type UnitName = keyof typeof UNITS_IN_METRES;

export function isKnownUnit(unit: string | undefined | null): boolean {
  return typeof unit === 'string' && Object.prototype.hasOwnProperty.call(UNITS_IN_METRES, unit.trim());
}

/**
 * Multiplier that converts a length in `fromUnit` to the same length in `toUnit`.
 *
 * Unknown units are treated as a factor of 1 rather than raising, matching the original viewer:
 * a manifest with a typo'd unit still renders, just unscaled.
 */
export function getUnitScaleFactor(fromUnit: string | undefined | null, toUnit: string | undefined | null): number {
  const from = typeof fromUnit === 'string' ? fromUnit.trim() : '';
  const to = typeof toUnit === 'string' ? toUnit.trim() : '';

  if (from === to) {
    return 1;
  }

  const fromFactor = UNITS_IN_METRES[from] ?? 1;
  const toFactor = UNITS_IN_METRES[to] ?? 1;

  return fromFactor / toFactor;
}

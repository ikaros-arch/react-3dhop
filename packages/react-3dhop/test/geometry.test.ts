import { describe, expect, it } from 'vitest';
import { IDENTITY, isMat4, maxScale, multiply, transformPoint } from '../src/geometry/mat4.js';
import { THEME_DEFAULTS, THEME_TOKENS, resolveThemeMode, themeStyle, themeVar } from '../src/theme.js';

describe('mat4', () => {
  it('identity leaves points alone', () => {
    expect(transformPoint(IDENTITY, [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('multiplies column-major (translate ∘ scale)', () => {
    const scale2 = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1];
    const translate = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1];
    // T * S: scale first, then translate
    expect(transformPoint(multiply(translate, scale2), [1, 1, 1])).toEqual([12, 22, 32]);
    // S * T: translate first, then scale
    expect(transformPoint(multiply(scale2, translate), [1, 1, 1])).toEqual([22, 42, 62]);
  });

  it('reports the largest axis scale', () => {
    expect(maxScale([1, 0, 0, 0, 0, 3, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1])).toBe(3);
  });

  it('validates matrices', () => {
    expect(isMat4(IDENTITY)).toBe(true);
    expect(isMat4([1, 2, 3])).toBe(false);
    expect(isMat4(undefined)).toBe(false);
  });
});

describe('theme', () => {
  it('emits var() with the light default as fallback', () => {
    expect(themeVar('accent')).toBe(`var(${THEME_TOKENS.accent}, ${THEME_DEFAULTS.light.accent})`);
    expect(themeVar('accent', 'red')).toBe(`var(${THEME_TOKENS.accent}, red)`);
  });

  it('declares no inline variables for light, all of them for dark', () => {
    expect(themeStyle('light')).toEqual({});
    const dark = themeStyle('dark');
    expect(Object.keys(dark).sort()).toEqual(Object.values(THEME_TOKENS).sort());
    expect(dark[THEME_TOKENS.panelBg]).toBe(THEME_DEFAULTS.dark.panelBg);
  });

  it('resolves system against the preference, defaulting to light', () => {
    expect(resolveThemeMode('dark')).toBe('dark');
    expect(resolveThemeMode('light', true)).toBe('light');
    expect(resolveThemeMode('system', true)).toBe('dark');
    expect(resolveThemeMode('system', false)).toBe('light');
    expect(resolveThemeMode(undefined, undefined)).toBe('light');
  });
});

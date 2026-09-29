import type { ThemeMode, ThemeName } from './viewer/types.js';

/**
 * Theme tokens the viewer's own UI is drawn with. Every token is a CSS custom property read via
 * `themeVar()`, which supplies the light-theme value as the `var()` fallback — so with no
 * `theme` prop and no stylesheet the viewer looks exactly as before, and a consumer can restyle it
 * by setting `--r3dhop-*` on any ancestor.
 */
export const THEME_TOKENS = {
  /** Toolbar sidecar panels (measurement output, sections, info). */
  panelBg: '--r3dhop-panel-bg',
  panelText: '--r3dhop-panel-text',
  /** Floating overlays (compass, cube, light widget). */
  overlayBg: '--r3dhop-overlay-bg',
  overlayBgStrong: '--r3dhop-overlay-bg-strong',
  overlayText: '--r3dhop-overlay-text',
  overlayBorder: '--r3dhop-overlay-border',
  overlayShadow: '--r3dhop-overlay-shadow',
  /** Interactive surfaces inside overlays (cube faces, buttons). */
  controlBg: '--r3dhop-control-bg',
  controlBgHover: '--r3dhop-control-bg-hover',
  controlBorder: '--r3dhop-control-border',
  /** Line/ink colour for drawn indicators. */
  ink: '--r3dhop-ink',
  accent: '--r3dhop-accent'
} as const;

export type ThemeToken = keyof typeof THEME_TOKENS;

export const THEME_DEFAULTS: Record<ThemeName, Record<ThemeToken, string>> = {
  // Matches the stock 3DHOP skin: translucent grey panels, dark translucent overlays.
  light: {
    panelBg: 'rgba(125, 125, 125, 0.5)',
    panelText: '#f8f8f8',
    overlayBg: 'rgba(0, 0, 0, 0.45)',
    overlayBgStrong: 'rgba(0, 0, 0, 0.55)',
    overlayText: '#FFFFFF',
    overlayBorder: 'rgba(255, 255, 255, 0.4)',
    overlayShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
    controlBg: 'rgba(255, 255, 255, 0.12)',
    controlBgHover: 'rgba(255, 255, 255, 0.25)',
    controlBorder: 'rgba(255, 255, 255, 0.35)',
    ink: 'rgba(255, 255, 255, 0.85)',
    accent: '#FFC20A'
  },
  dark: {
    panelBg: 'rgba(30, 30, 34, 0.85)',
    panelText: '#e8e8ea',
    overlayBg: 'rgba(20, 20, 24, 0.7)',
    overlayBgStrong: 'rgba(20, 20, 24, 0.85)',
    overlayText: '#e8e8ea',
    overlayBorder: 'rgba(255, 255, 255, 0.18)',
    overlayShadow: '0 6px 20px rgba(0, 0, 0, 0.6)',
    controlBg: 'rgba(255, 255, 255, 0.08)',
    controlBgHover: 'rgba(255, 255, 255, 0.18)',
    controlBorder: 'rgba(255, 255, 255, 0.22)',
    ink: 'rgba(232, 232, 234, 0.9)',
    accent: '#FFC20A'
  }
};

/** `var(--r3dhop-<token>, <light default>)` for use in inline styles. */
export function themeVar(token: ThemeToken, fallback: string = THEME_DEFAULTS.light[token]): string {
  return `var(${THEME_TOKENS[token]}, ${fallback})`;
}

/**
 * Inline custom-property declarations for a theme. Only the dark theme needs them: light is the
 * `var()` fallback, and declaring it inline would defeat consumer overrides.
 */
export function themeStyle(theme: ThemeName): Record<string, string> {
  if (theme === 'light') return {};
  const style: Record<string, string> = {};
  (Object.keys(THEME_TOKENS) as ThemeToken[]).forEach((token) => {
    style[THEME_TOKENS[token]] = THEME_DEFAULTS[theme][token];
  });
  return style;
}

/** Resolves `'system'` against `prefers-color-scheme`; defaults to light when unavailable. */
export function resolveThemeMode(mode: ThemeMode | undefined, prefersDark?: boolean): ThemeName {
  if (mode === 'dark' || mode === 'light') return mode;
  if (typeof prefersDark === 'boolean') return prefersDark ? 'dark' : 'light';
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Reads a token's effective value from the cascade at `element` — for canvas drawing, where
 * `var()` cannot be used. Falls back to the theme default.
 */
export function readThemeToken(element: Element | null, token: ThemeToken, theme: ThemeName = 'light'): string {
  if (element && typeof getComputedStyle === 'function') {
    const value = getComputedStyle(element).getPropertyValue(THEME_TOKENS[token]).trim();
    if (value) return value;
  }
  return THEME_DEFAULTS[theme][token];
}

import type { LanguageMap, LocalizableValue } from './types.js';

/**
 * Languages tried, in order, when the requested one is absent. Mirrors the behaviour of the
 * original viewer, which was authored for a Norwegian institution publishing in English.
 */
export const DEFAULT_FALLBACK_LANGUAGES = ['en', 'no', 'nb', 'nn'];

/**
 * Resolves an IIIF language map to a single string.
 *
 * Tries `language`, then each of `fallbacks`, then any remaining language in the map. Returns an
 * empty string when nothing is available, so callers can render without null checks.
 *
 * Unlike the original implementation this takes the language as an argument rather than reading a
 * module-level global, so two viewers on one page can show different languages.
 */
export function resolveLanguageMap(
  value: LocalizableValue | undefined | null,
  language: string,
  fallbacks: readonly string[] = DEFAULT_FALLBACK_LANGUAGES
): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value !== 'object') {
    return '';
  }

  const pick = (tag: string): string | undefined => {
    const entry = (value as LanguageMap)[tag];
    if (entry == null) {
      return undefined;
    }
    if (Array.isArray(entry)) {
      return entry.length > 0 ? entry[0] : undefined;
    }
    return entry.length > 0 ? entry : undefined;
  };

  const direct = pick(language);
  if (direct !== undefined) {
    return direct;
  }

  for (const fallback of fallbacks) {
    if (fallback === language) {
      continue;
    }
    const candidate = pick(fallback);
    if (candidate !== undefined) {
      return candidate;
    }
  }

  for (const tag of Object.keys(value)) {
    const candidate = pick(tag);
    if (candidate !== undefined) {
      return candidate;
    }
  }

  return '';
}

/**
 * The properties IIIF defines as language maps. Only these are inspected for language tags.
 *
 * Recognising a language map by shape alone does not work: `{ "id": "…", "type": "Model",
 * "format": "Nexus" }` is also an object whose every value is a string, and treating it as one
 * offers "id", "type" and "format" to the user as languages.
 */
const LANGUAGE_MAP_KEYS = new Set(['label', 'value', 'summary']);

function isLanguageMap(value: unknown): value is LanguageMap {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.every(
      ([, entry]) =>
        typeof entry === 'string' || (Array.isArray(entry) && entry.every((item) => typeof item === 'string'))
    )
  );
}

/**
 * Collects every language tag used by the language maps reachable from `value`.
 *
 * IIIF uses the tag `none` for values that carry no language; it is a valid key but not a language
 * a user would ever choose, so it is excluded.
 */
export function collectLanguages(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (value == null || typeof value !== 'object') {
    return into;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectLanguages(item, into));
    return into;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (LANGUAGE_MAP_KEYS.has(key) && isLanguageMap(entry)) {
      Object.keys(entry).forEach((tag) => {
        if (tag !== 'none') {
          into.add(tag);
        }
      });
      return;
    }

    collectLanguages(entry, into);
  });

  return into;
}

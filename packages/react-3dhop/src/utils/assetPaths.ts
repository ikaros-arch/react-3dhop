export function isAbsoluteAssetUrl(value: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/?\/)/i.test(value);
}

export function resolveRelativeAssetPath(provided: string | undefined, baseUrl: string, fallback: string): string {
  if (!provided) return fallback;
  if (isAbsoluteAssetUrl(provided)) {
    return provided;
  }
  const sanitized = provided.replace(/^\/+/, '');
  if (!sanitized) {
    return fallback;
  }
  return joinAssetPath(baseUrl, sanitized);
}

export function joinAssetPath(baseUrl: string, suffix: string): string {
  return baseUrl === '/' ? `/${suffix}` : `${baseUrl}/${suffix}`;
}

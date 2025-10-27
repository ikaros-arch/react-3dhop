import { isAbsoluteAssetUrl, joinAssetPath } from '../utils/assetPaths.js';

export function queryToolbarElements<T extends HTMLElement = HTMLElement>(dataId: string): T[] {
  if (typeof document === 'undefined') {
    return [];
  }
  return Array.from(document.querySelectorAll<T>(`[data-hop-id="${dataId}"]`));
}

export function queryToolbarSidecars<T extends HTMLElement = HTMLElement>(dataId: string): T[] {
  if (typeof document === 'undefined') {
    return [];
  }
  return Array.from(document.querySelectorAll<T>(`[data-hop-sidecar="${dataId}"]`));
}

export function resolveBackgroundUrl(provided: string | null | undefined, baseUrl: string): string | null {
  const fallback = joinAssetPath(baseUrl, 'skins/backgrounds/light.jpg');
  if (provided === null) return null;
  if (provided === undefined) return fallback;
  if (isAbsoluteAssetUrl(provided)) {
    return provided;
  }
  const sanitized = provided.replace(/^\/+/, '');
  if (!sanitized) {
    return fallback;
  }
  return joinAssetPath(baseUrl, sanitized);
}

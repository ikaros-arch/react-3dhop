import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadCollection, parseCollection } from './iiif/collection.js';
import type { Diagnostic, IIIFCollection, ParsedCollectionItem } from './iiif/types.js';

export type IIIFCollectionStatus = 'idle' | 'loading' | 'ready' | 'error';

export type IIIFCollectionContextValue = {
  status: IIIFCollectionStatus;
  error: Error | null;
  diagnostics: Diagnostic[];
  label: string;
  summary: string | null;
  items: ParsedCollectionItem[];
  /** id of the manifest currently selected, e.g. to pass straight into `<IIIFViewer manifest={...}>`. */
  selectedId: string | null;
  selectedIndex: number;
  selectedItem: ParsedCollectionItem | null;
  selectManifest: (id: string) => void;
  next: () => void;
  previous: () => void;
};

const IIIFCollectionContext = createContext<IIIFCollectionContextValue | null>(null);

/** Access the IIIF collection state. Must be called from inside an `<IIIFCollectionProvider>`. */
export function useIIIFCollection(): IIIFCollectionContextValue {
  const value = useContext(IIIFCollectionContext);
  if (!value) {
    throw new Error('useIIIFCollection must be used within an <IIIFCollectionProvider>.');
  }
  return value;
}

export type IIIFCollectionProviderProps = {
  /** A collection URL to fetch, or an already-fetched collection object. */
  collection: string | IIIFCollection;
  /** Language used for item labels. Defaults to `'en'`. */
  language?: string;
  /** Selects this manifest id once the collection loads, instead of the first item. */
  initialManifestId?: string;
  onLoad?: (items: ParsedCollectionItem[]) => void;
  onError?: (error: Error) => void;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  children?: React.ReactNode;
};

/**
 * Fetches and parses a IIIF Collection, and tracks which of its manifests is selected.
 *
 * Unlike `<IIIFViewer>`, this renders nothing itself — it only supplies `useIIIFCollection()` to
 * descendants, such as `<IIIFCollectionPicker>`, `<IIIFCollectionCarousel>`, and the `<IIIFViewer>`
 * that should render `selectedId`. Keeping it separate lets the collection state outlive remounts
 * of the viewer (e.g. `key={selectedId}`) that discard camera and visibility state per manifest.
 */
export const IIIFCollectionProvider: React.FC<IIIFCollectionProviderProps> = ({
  collection,
  language = 'en',
  initialManifestId,
  onLoad,
  onError,
  onDiagnostic,
  children
}) => {
  const [status, setStatus] = useState<IIIFCollectionStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [label, setLabel] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedCollectionItem[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialManifestId ?? null);

  useEffect(() => {
    const controller = new AbortController();
    const collected: Diagnostic[] = [];
    const handleDiagnostic = (diagnostic: Diagnostic) => {
      collected.push(diagnostic);
      onDiagnostic?.(diagnostic);
    };

    const finish = (parsed: { label: string; summary?: string; items: ParsedCollectionItem[] }) => {
      if (controller.signal.aborted) {
        return;
      }
      setLabel(parsed.label);
      setSummary(parsed.summary ?? null);
      setItems(parsed.items);
      setDiagnostics(collected);
      setStatus('ready');
      setError(null);
      // Only defaults to the first item on the initial load; later reloads keep whatever the caller
      // (or the user, via selectManifest) already picked.
      setSelectedId((current) => current ?? parsed.items[0]?.id ?? null);
      onLoad?.(parsed.items);
    };

    const fail = (cause: unknown) => {
      if (controller.signal.aborted) {
        return;
      }
      const normalized = cause instanceof Error ? cause : new Error(String(cause));
      setStatus('error');
      setError(normalized);
      setDiagnostics(collected);
      onError?.(normalized);
    };

    setStatus('loading');

    if (typeof collection === 'string') {
      loadCollection(collection, { language, signal: controller.signal, onDiagnostic: handleDiagnostic })
        .then(finish)
        .catch((cause) => {
          if (cause instanceof DOMException && cause.name === 'AbortError') {
            return;
          }
          fail(cause);
        });
    } else {
      try {
        finish(parseCollection(collection, { language, onDiagnostic: handleDiagnostic }));
      } catch (cause) {
        fail(cause);
      }
    }

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, language, onLoad, onError]);

  const selectedIndex = useMemo(() => items.findIndex((item) => item.id === selectedId), [items, selectedId]);
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : null;

  const selectManifest = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const step = useCallback(
    (delta: number) => {
      if (items.length === 0) {
        return;
      }
      const base = selectedIndex >= 0 ? selectedIndex : 0;
      const nextIndex = (base + delta + items.length) % items.length;
      setSelectedId(items[nextIndex].id);
    },
    [items, selectedIndex]
  );

  const next = useCallback(() => step(1), [step]);
  const previous = useCallback(() => step(-1), [step]);

  const value = useMemo<IIIFCollectionContextValue>(
    () => ({
      status,
      error,
      diagnostics,
      label,
      summary,
      items,
      selectedId,
      selectedIndex,
      selectedItem,
      selectManifest,
      next,
      previous
    }),
    [status, error, diagnostics, label, summary, items, selectedId, selectedIndex, selectedItem, selectManifest, next, previous]
  );

  return <IIIFCollectionContext.Provider value={value}>{children}</IIIFCollectionContext.Provider>;
};

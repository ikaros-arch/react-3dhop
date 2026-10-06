import { resolveLanguageMap } from './language.js';
import type {
  DiagnosticHandler,
  IIIFCollection,
  IIIFCollectionItem,
  ParsedCollection,
  ParsedCollectionItem
} from './types.js';

export type ParseCollectionOptions = {
  /** Language used to resolve labels and summaries. Defaults to `'en'`. */
  language?: string;
  onDiagnostic?: DiagnosticHandler;
};

/** The collection format only ever needs the first thumbnail; a carousel has no use for the rest. */
function firstThumbnail(item: IIIFCollectionItem): string | undefined {
  const thumbnail = Array.isArray(item.thumbnail) ? item.thumbnail[0] : item.thumbnail;
  return thumbnail?.id;
}

/**
 * Parses an already-fetched IIIF Collection into the listing a picker or carousel needs.
 *
 * Items are expected to be `Manifest` references; anything else (e.g. a nested `Collection`) is
 * reported through `onDiagnostic` and skipped rather than aborting the parse.
 */
export function parseCollection(collection: IIIFCollection, options: ParseCollectionOptions = {}): ParsedCollection {
  const { language = 'en', onDiagnostic } = options;
  const resolve = (value: IIIFCollectionItem['label']) => resolveLanguageMap(value, language);

  const rawItems = collection.items ?? [];
  if (rawItems.length === 0) {
    onDiagnostic?.({ level: 'warning', message: 'Collection contains no items.' });
  }

  const items: ParsedCollectionItem[] = [];

  rawItems.forEach((item) => {
    if (item?.type && item.type !== 'Manifest') {
      onDiagnostic?.({
        level: 'info',
        message: `Skipping collection item ${item.id ?? '(no id)'} of unsupported type "${item.type}".`
      });
      return;
    }

    if (!item?.id) {
      onDiagnostic?.({ level: 'warning', message: 'Collection item has no id; skipping.' });
      return;
    }

    const fields = (item.metadata ?? []).map((entry) => ({
      label: resolve(entry.label),
      value: resolve(entry.value)
    }));

    items.push({
      id: item.id,
      label: resolve(item.label) || item.id,
      summary: resolve(item.summary) || undefined,
      thumbnail: firstThumbnail(item),
      fields
    });
  });

  return {
    collection,
    label: resolve(collection.label) || 'Untitled Collection',
    summary: resolve(collection.summary) || undefined,
    items
  };
}

export type LoadCollectionOptions = ParseCollectionOptions & {
  signal?: AbortSignal;
  /** Injectable for testing and for consumers with their own HTTP stack. */
  fetchImpl?: typeof fetch;
};

/** Fetches a collection by URL and parses it. Rejects on network, JSON, or HTTP-status failures. */
export async function loadCollection(url: string, options: LoadCollectionOptions = {}): Promise<ParsedCollection> {
  const { signal, fetchImpl = fetch, ...parseOptions } = options;

  const response = await fetchImpl(url, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load IIIF collection (${response.status} ${response.statusText}): ${url}`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`IIIF collection at ${url} is not valid JSON: ${detail}`);
  }

  if (!json || typeof json !== 'object') {
    throw new Error(`IIIF collection at ${url} is not a JSON object.`);
  }

  return parseCollection(json as IIIFCollection, parseOptions);
}

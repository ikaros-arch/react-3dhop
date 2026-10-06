import React, { useEffect, useMemo, useState } from 'react';
import { ThreeDHopViewer, extractToolbar, type ThreeDHopViewerProps } from '@ikaros-arch/react-3dhop';
import { IIIFMultiManifestProvider, type IIIFMultiManifestStatus } from './multiManifestContext.js';
import { loadManifest, parseManifest } from './iiif/parser.js';
import { sceneFromManifests, type SceneFromManifests, type ToMultiModelsOptions } from './iiif/toMultiModels.js';
import type { Diagnostic, IIIFManifest, ParsedManifest, Vector3 } from './iiif/types.js';

export type IIIFMultiManifestViewerProps = Omit<ThreeDHopViewerProps, 'models' | 'modelUrl'> & {
  /** Manifest URLs to fetch, or already-fetched manifest objects, in display order. */
  manifests: Array<string | IIIFManifest>;
  /** Language used for labels. Defaults to the browser's, falling back to `'en'`. */
  language?: string;
  /** Overrides every manifest's `display unit`, converting them all onto one shared scale. */
  displayUnit?: string;
  /** Gap kept between adjacent manifests' layout circles, in the shared displayUnit. */
  gap?: number;
  /** Floor applied to every manifest's placement-spread radius. See `ToMultiModelsOptions.minRadius`. */
  minRadius?: number;
  /** Manifests per row before wrapping onto a new row. */
  columns?: number;
  /** Escape hatch: an explicit offset per manifest key, skipping automatic layout for that manifest. */
  layoutOverrides?: Record<string, Vector3>;
  onLoad?: (scene: SceneFromManifests) => void;
  /** Fired once per manifest that fails to load or parse. */
  onError?: (error: Error, sourceId: string) => void;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  /** Rendered instead of the viewer while the manifests are being fetched. */
  loadingFallback?: React.ReactNode;
  /** Rendered instead of the viewer when any manifest cannot be loaded or parsed. */
  errorFallback?: React.ReactNode | ((errors: Array<{ sourceId: string; error: Error }>) => React.ReactNode);
};

function defaultLanguage(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.split('-')[0];
  }
  return 'en';
}

function sourceIdFor(manifest: string | IIIFManifest, index: number): string {
  if (typeof manifest === 'string') {
    return manifest;
  }
  return manifest.id ?? `manifest_${index}`;
}

/**
 * Renders several IIIF 3D manifests together in one 3DHOP viewer, laid out side by side.
 *
 * A parallel component to `<IIIFViewer>` rather than an extension of it: this scene is a merge of
 * N independently-fetched manifests, and fails fast if any one of them can't be loaded — a mix of
 * "some succeeded, some didn't" isn't a state a shared scene can represent cleanly for v1.
 */
export const IIIFMultiManifestViewer: React.FC<IIIFMultiManifestViewerProps> = ({
  manifests,
  language: languageProp,
  displayUnit,
  gap,
  minRadius,
  columns,
  layoutOverrides,
  onLoad,
  onError,
  onDiagnostic,
  loadingFallback = null,
  errorFallback = null,
  space,
  config,
  trackball,
  toolbar: toolbarProp,
  children,
  ...viewerProps
}) => {
  const [language, setLanguage] = useState(() => languageProp ?? defaultLanguage());
  const [status, setStatus] = useState<IIIFMultiManifestStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [parsedList, setParsedList] = useState<ParsedManifest[] | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);

  useEffect(() => {
    if (languageProp) {
      setLanguage(languageProp);
    }
  }, [languageProp]);

  useEffect(() => {
    const controller = new AbortController();
    const collected: Diagnostic[] = [];
    const handleDiagnostic = (diagnostic: Diagnostic) => {
      collected.push(diagnostic);
      onDiagnostic?.(diagnostic);
    };

    setStatus('loading');

    Promise.all(
      manifests.map((manifest, index) => {
        if (typeof manifest === 'string') {
          return loadManifest(manifest, { language, signal: controller.signal, onDiagnostic: handleDiagnostic });
        }
        return Promise.resolve().then(() => parseManifest(manifest, { language, onDiagnostic: handleDiagnostic }));
      })
    )
      .then((results) => {
        if (controller.signal.aborted) {
          return;
        }
        setParsedList(results);
        setDiagnostics(collected);
        setStatus('ready');
        setError(null);
      })
      .catch((cause) => {
        if (controller.signal.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) {
          return;
        }
        const normalized = cause instanceof Error ? cause : new Error(String(cause));
        setParsedList(null);
        setDiagnostics(collected);
        setStatus('error');
        setError(normalized);
        onError?.(normalized, 'unknown');
      });

    return () => controller.abort();
    // `language` is deliberately excluded: switching language re-resolves labels below rather than
    // re-fetching every manifest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifests, onDiagnostic, onError]);

  const sourceIds = useMemo(() => manifests.map(sourceIdFor), [manifests]);

  // Re-resolving is cheap and keeps a single source of truth for language handling.
  const localizedList = useMemo(() => {
    if (!parsedList) {
      return null;
    }
    return parsedList.map((parsed) => parseManifest(parsed.manifest, { language }));
  }, [parsedList, language]);

  const scene = useMemo(() => {
    if (!localizedList || localizedList.length === 0) {
      return null;
    }
    return sceneFromManifests(localizedList, sourceIds, {
      displayUnit,
      space,
      config,
      trackball,
      gap,
      minRadius,
      columns,
      layoutOverrides
    } satisfies ToMultiModelsOptions);
  }, [localizedList, sourceIds, displayUnit, space, config, trackball, gap, minRadius, columns, layoutOverrides]);

  useEffect(() => {
    if (status === 'ready' && scene) {
      onLoad?.(scene);
    }
    // Firing only when the merged scene changes; `onLoad` identity is the caller's concern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, scene]);

  if (status === 'error' && error) {
    return <>{typeof errorFallback === 'function' ? errorFallback([{ sourceId: 'unknown', error }]) : errorFallback}</>;
  }

  if (!scene) {
    return <>{loadingFallback}</>;
  }

  // See the matching comment in IIIFViewer.tsx: `<IIIFMultiManifestProvider>` must stay a descendant
  // of `<ThreeDHopViewer>`, which would otherwise hide a `<Toolbar>` in `children` from it. An
  // explicit `toolbar` prop wins over one found in `children`.
  const { toolbar: extractedToolbar, rest } = extractToolbar(children);
  const toolbar = toolbarProp ?? extractedToolbar;

  return (
    <ThreeDHopViewer
      {...viewerProps}
      models={scene.models}
      space={scene.space}
      config={scene.config}
      trackball={scene.trackball}
      measurementUnits={viewerProps.measurementUnits ?? scene.displayUnit}
      toolbar={toolbar}
    >
      <IIIFMultiManifestProvider status={status} error={error} diagnostics={diagnostics} scene={scene}>
        {rest}
      </IIIFMultiManifestProvider>
    </ThreeDHopViewer>
  );
};

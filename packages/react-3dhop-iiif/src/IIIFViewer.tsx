import React, { useEffect, useMemo, useState } from 'react';
import { ThreeDHopViewer, type ThreeDHopViewerProps } from '@ikaros-arch/react-3dhop';
import { IIIFProvider, useIIIFManifest, type IIIFStatus } from './context.js';
import { loadManifest, parseManifest } from './iiif/parser.js';
import { sceneFromManifest, type SceneFromManifest, type ToModelsOptions } from './iiif/toModels.js';
import type { Diagnostic, IIIFManifest, ParsedManifest } from './iiif/types.js';

export type IIIFViewerProps = Omit<ThreeDHopViewerProps, 'models' | 'modelUrl'> & {
  /** A manifest URL to fetch, or an already-fetched manifest object. */
  manifest: string | IIIFManifest;
  /** Language used for labels and metadata. Defaults to the browser's, falling back to `'en'`. */
  language?: string;
  /** Overrides the manifest's `display unit`, changing the scale the scene is rendered at. */
  displayUnit?: string;
  /** Applies the manifest's first camera as the initial view once the scene is ready. */
  applyInitialCamera?: boolean;
  onLoad?: (parsed: ParsedManifest, scene: SceneFromManifest) => void;
  onError?: (error: Error) => void;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  /** Rendered instead of the viewer while the manifest is being fetched. */
  loadingFallback?: React.ReactNode;
  /** Rendered instead of the viewer when the manifest cannot be loaded or parsed. */
  errorFallback?: React.ReactNode | ((error: Error) => React.ReactNode);
};

function defaultLanguage(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.split('-')[0];
  }
  return 'en';
}

/**
 * Renders a IIIF 3D manifest with 3DHOP.
 *
 * Fetches and parses the manifest, derives the scene, and makes the result available to any
 * descendant through `useIIIFManifest()`. Everything `<ThreeDHopViewer>` accepts can be passed
 * through, except the model props this component supplies itself.
 */
export const IIIFViewer: React.FC<IIIFViewerProps> = ({
  manifest,
  language: languageProp,
  displayUnit,
  applyInitialCamera = true,
  onLoad,
  onError,
  onDiagnostic,
  loadingFallback = null,
  errorFallback = null,
  space,
  config,
  trackball,
  children,
  ...viewerProps
}) => {
  const [language, setLanguage] = useState(() => languageProp ?? defaultLanguage());
  const [status, setStatus] = useState<IIIFStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [parsed, setParsed] = useState<ParsedManifest | null>(null);
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

    const finish = (result: ParsedManifest) => {
      if (controller.signal.aborted) {
        return;
      }
      setParsed(result);
      setDiagnostics(collected);
      setStatus('ready');
      setError(null);
    };

    const fail = (cause: unknown) => {
      if (controller.signal.aborted) {
        return;
      }
      const normalized = cause instanceof Error ? cause : new Error(String(cause));
      setParsed(null);
      setDiagnostics(collected);
      setStatus('error');
      setError(normalized);
      onError?.(normalized);
    };

    setStatus('loading');

    if (typeof manifest === 'string') {
      loadManifest(manifest, { language, signal: controller.signal, onDiagnostic: handleDiagnostic })
        .then(finish)
        .catch((cause) => {
          if (cause instanceof DOMException && cause.name === 'AbortError') {
            return;
          }
          fail(cause);
        });
    } else {
      try {
        finish(parseManifest(manifest, { language, onDiagnostic: handleDiagnostic }));
      } catch (cause) {
        fail(cause);
      }
    }

    return () => controller.abort();
    // `language` is deliberately excluded: switching language re-resolves labels below rather than
    // re-fetching the manifest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, onDiagnostic, onError]);

  // Re-resolving is cheap and keeps a single source of truth for language handling.
  const localized = useMemo(() => {
    if (!parsed) {
      return null;
    }
    return parseManifest(parsed.manifest, { language });
  }, [parsed, language]);

  const scene = useMemo(() => {
    if (!localized) {
      return null;
    }
    return sceneFromManifest(localized, { displayUnit, space, config, trackball } satisfies ToModelsOptions);
  }, [localized, displayUnit, space, config, trackball]);

  useEffect(() => {
    if (status === 'ready' && localized && scene) {
      onLoad?.(localized, scene);
    }
    // Firing only when the parsed result changes; `onLoad` identity is the caller's concern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, localized, scene]);

  if (status === 'error' && error) {
    return <>{typeof errorFallback === 'function' ? errorFallback(error) : errorFallback}</>;
  }

  if (!scene || !localized) {
    return <>{loadingFallback}</>;
  }

  return (
    <ThreeDHopViewer
      {...viewerProps}
      models={scene.models}
      space={scene.space}
      config={scene.config}
      trackball={scene.trackball}
      measurementUnits={viewerProps.measurementUnits ?? scene.displayUnit}
    >
      <IIIFProvider
        status={status}
        error={error}
        diagnostics={diagnostics}
        parsed={localized}
        scene={scene}
        language={language}
        setLanguage={setLanguage}
      >
        {applyInitialCamera && localized.cameras.length > 0 ? <InitialCamera /> : null}
        {children}
      </IIIFProvider>
    </ThreeDHopViewer>
  );
};

/**
 * Applies the manifest's first camera as the opening view.
 *
 * This waits for the scene framing rather than running on mount: the presenter only knows the
 * scene's centre and radius after the scene has been set, and `goToCamera` is a no-op until then.
 */
const InitialCamera: React.FC = () => {
  const [applied, setApplied] = useState(false);
  const { goToCamera, cameras, isSceneReady } = useIIIFManifest();

  useEffect(() => {
    if (applied || !isSceneReady || cameras.length === 0) {
      return;
    }
    goToCamera(0, 0);
    setApplied(true);
  }, [applied, cameras.length, goToCamera, isSceneReady]);

  return null;
};

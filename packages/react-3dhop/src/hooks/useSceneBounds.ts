import { useCallback, useEffect, useRef, useState } from 'react';
import { computeSceneBounds } from '../geometry/bounds.js';
import { useThreeDHopViewer } from '../viewer/context.js';
import type { SceneBounds } from '../viewer/types.js';

export type UseSceneBoundsOptions = {
  /**
   * Nexus meshes report their bounding sphere as soon as the header arrives but only expose real
   * vertices once the base level has streamed in, which is after 3DHOP's "ready" signal. While
   * the result is sphere-based the hook keeps re-checking at this interval (ms) until it can
   * upgrade to vertex-based bounds or `maxRetries` is exhausted.
   */
  retryIntervalMs?: number;
  maxRetries?: number;
};

export type UseSceneBoundsResult = {
  bounds: SceneBounds | null;
  /** Recomputes from the presenter's current state. */
  refresh: () => SceneBounds | null;
};

/**
 * Axis-aligned bounds of the visible scene, kept current across scene applies and mesh loading.
 * `null` until any geometry is available. See `SceneBounds.source` to tell tight vertex bounds
 * from the coarser bounding-sphere fallback.
 */
export function useSceneBounds({ retryIntervalMs = 250, maxRetries = 12 }: UseSceneBoundsOptions = {}): UseSceneBoundsResult {
  const { presenter, registerSceneObserver, registerSceneReadyObserver } = useThreeDHopViewer();
  const [bounds, setBounds] = useState<SceneBounds | null>(null);
  const retryTimerRef = useRef<number | null>(null);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const refresh = useCallback((): SceneBounds | null => {
    if (!presenter) {
      setBounds(null);
      return null;
    }
    const next = computeSceneBounds(presenter);
    setBounds(next);
    return next;
  }, [presenter]);

  useEffect(() => {
    if (!presenter) {
      setBounds(null);
      return;
    }

    const scheduleUpgrade = (attempt: number) => {
      clearRetry();
      if (attempt >= maxRetries || typeof window === 'undefined') return;
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        const next = refresh();
        if (next && next.source === 'spheres') {
          scheduleUpgrade(attempt + 1);
        }
      }, retryIntervalMs);
    };

    const onScene = () => {
      clearRetry();
      refresh();
    };
    const onReady = () => {
      const next = refresh();
      if (next && next.source === 'spheres') {
        scheduleUpgrade(0);
      }
    };

    refresh();
    const disposeScene = registerSceneObserver(onScene);
    const disposeReady = registerSceneReadyObserver(onReady);
    return () => {
      disposeScene();
      disposeReady();
      clearRetry();
    };
  }, [clearRetry, maxRetries, presenter, refresh, registerSceneObserver, registerSceneReadyObserver, retryIntervalMs]);

  return { bounds, refresh };
}

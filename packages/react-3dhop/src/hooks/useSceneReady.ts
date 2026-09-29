import { useEffect, useState } from 'react';
import { useThreeDHopViewer } from '../viewer/context.js';

/**
 * `true` once every mesh of the current scene has loaded; drops back to `false` on each scene
 * apply until the new scene is ready.
 */
export function useSceneReady(): boolean {
  const { presenter, registerSceneObserver, registerSceneReadyObserver } = useThreeDHopViewer();
  const [ready, setReady] = useState<boolean>(() => Boolean(presenter?._isSceneReady?.()));

  useEffect(() => {
    if (!presenter) {
      setReady(false);
      return;
    }
    setReady(Boolean(presenter._isSceneReady?.()));
    const disposeScene = registerSceneObserver((p) => setReady(Boolean(p._isSceneReady?.())));
    const disposeReady = registerSceneReadyObserver(() => setReady(true));
    return () => {
      disposeScene();
      disposeReady();
    };
  }, [presenter, registerSceneObserver, registerSceneReadyObserver]);

  return ready;
}

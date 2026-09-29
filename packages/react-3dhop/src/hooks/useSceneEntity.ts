import { useEffect, useRef } from 'react';
import type React from 'react';
import { useThreeDHopViewer } from '../viewer/context.js';
import type { PresenterInstance, SceneEntitySpec } from '../viewer/types.js';

export type SceneEntityFactory = (presenter: PresenterInstance) => SceneEntitySpec | null | undefined;

/**
 * Applies a spec to a live entity. 3DHOP's `createEntity` returns the entity but never repaints
 * (the call after `return` is unreachable), so callers must repaint themselves.
 */
export function applyEntitySpec(presenter: PresenterInstance, name: string, spec: SceneEntitySpec): boolean {
  if (!presenter._scene || typeof presenter.createEntity !== 'function' || spec.vertices.length === 0) {
    return false;
  }
  const entity = presenter.createEntity(name, spec.type, spec.vertices);
  if (spec.color) entity.color = [...spec.color];
  if (typeof spec.useTransparency === 'boolean') entity.useTransparency = spec.useTransparency;
  if (typeof spec.pointSize === 'number') entity.pointSize = spec.pointSize;
  if (typeof spec.zOff === 'number') entity.zOff = spec.zOff;
  if (typeof spec.visible === 'boolean') entity.visible = spec.visible;
  return true;
}

export function removeEntity(presenter: PresenterInstance, name: string): void {
  if (presenter._scene?.entities && name in presenter._scene.entities) {
    presenter.deleteEntity?.(name);
  }
}

/**
 * Keeps one named helper-geometry entity (grid, axes, measurement guide, …) alive on the
 * presenter for as long as the calling component is mounted.
 *
 * 3DHOP wipes `_scene.entities` on every `setScene`, and the viewer calls `setScene` whenever a
 * scene contribution changes. This hook re-runs `factory` on mount, on every scene apply, once the
 * scene's meshes have loaded (when bounds become available), and whenever `deps` change; it
 * removes the entity on unmount. Return `null` from `factory` to draw nothing for now.
 *
 * The factory receives the live presenter so it can read `sceneRadiusInv`, `_scene`, etc.; use
 * `useSceneBounds()` for geometry-derived extents.
 */
export function useSceneEntity(name: string, factory: SceneEntityFactory, deps: React.DependencyList = []): void {
  const { presenter, registerSceneObserver, registerSceneReadyObserver } = useThreeDHopViewer();
  const factoryRef = useRef(factory);
  factoryRef.current = factory;

  useEffect(() => {
    if (!presenter) return;

    const rebuild = (target: PresenterInstance) => {
      removeEntity(target, name);
      const spec = factoryRef.current(target);
      const created = spec ? applyEntitySpec(target, name, spec) : false;
      if (created || spec === null) {
        target.repaint?.();
      }
    };

    // Registering the ready observer calls back immediately when the scene is already ready, so
    // only build eagerly when it isn't.
    const disposeReady = registerSceneReadyObserver(rebuild);
    if (!presenter._isSceneReady?.()) {
      rebuild(presenter);
    }
    const disposeScene = registerSceneObserver(rebuild);

    return () => {
      disposeScene();
      disposeReady();
      removeEntity(presenter, name);
      presenter.repaint?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenter, name, registerSceneObserver, registerSceneReadyObserver, ...deps]);
}

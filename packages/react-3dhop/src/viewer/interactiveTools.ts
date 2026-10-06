/**
 * interactiveTools.ts keeps the viewer's mutually exclusive canvas tools in one place: a registry
 * of tool descriptors (built-in `measure` and `pick`, plus anything registered at runtime) and a
 * hook that toggles them so at most one is active, keeping presenter state and UI in step.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type {
  InteractiveTool,
  InteractiveToolConfig,
  InteractiveToolPickContext,
  PresenterInstance,
  Vector3
} from './types.js';

export type { InteractiveTool, InteractiveToolConfig, InteractiveToolPickContext };

export type UseInteractiveToolsOptions = {
  presenterRef: React.MutableRefObject<PresenterInstance | null>;
  activeInteractiveToolRef: React.MutableRefObject<InteractiveTool | null>;
  syncMeasurementUi: (enabled?: boolean) => void;
  syncPickpointUi: (enabled?: boolean) => void;
  setPickpointValue: React.Dispatch<React.SetStateAction<Vector3 | null>>;
  /** Current pick-point value, so the built-in `pick` tool can capture it. */
  pickpointValue: Vector3 | null;
  setMeasurementValue: React.Dispatch<React.SetStateAction<number | null>>;
  /** The last completed measurement's two points, so the built-in `measure` tool can capture them. */
  measurementPoints: [Vector3, Vector3] | null;
};

export type UseInteractiveToolsResult = {
  activeInteractiveTool: InteractiveTool | null;
  registerInteractiveTool: (config: InteractiveToolConfig) => () => void;
  toggleTool: (toolId: InteractiveTool, presenter?: PresenterInstance | null) => void;
  deactivateTool: (toolId: InteractiveTool, presenter?: PresenterInstance | null) => boolean;
  captureToolState: (toolId?: InteractiveTool) => { toolId: InteractiveTool; state: unknown } | null;
  restoreToolState: (toolId: InteractiveTool, state: unknown) => void;
  resetActiveTool: () => void;
  /**
   * Re-enables the active tool on the presenter. 3DHOP's `setScene` clears its measurement and
   * pick-point flags, so the lifecycle calls this after every scene apply.
   */
  reassertActiveTool: (presenter?: PresenterInstance | null) => void;
  /** Routes a pick-point result to the active tool, or to the pick tool's output when none. */
  dispatchPick: (context: InteractiveToolPickContext) => void;
  hasTool: (toolId: InteractiveTool) => boolean;
};

/**
 * Manages mutually exclusive canvas tools for a presenter.
 *
 * - The built-in `measure` and `pick` tools are always registered; further tools are added with
 *   `registerInteractiveTool`, which returns a disposer.
 * - `toggleTool` enables a tool, first deactivating whichever other tool is active; toggling the
 *   active tool deactivates it.
 * - `activeInteractiveToolRef` mirrors the active id for non-React callers; `activeInteractiveTool`
 *   is the React state.
 * - `dispatchPick` is what the presenter's `_onEndPickingPoint` should call: pick results go to
 *   the active tool's `onPick` when it has one, otherwise into the shared `pickpointValue`.
 */
export function useInteractiveTools({
  presenterRef,
  activeInteractiveToolRef,
  syncMeasurementUi,
  syncPickpointUi,
  setPickpointValue,
  pickpointValue,
  setMeasurementValue,
  measurementPoints
}: UseInteractiveToolsOptions): UseInteractiveToolsResult {
  const [activeInteractiveTool, setActiveInteractiveTool] = useState<InteractiveTool | null>(null);

  // So `pick`/`measure`'s captureState always read the latest value without forcing the registry
  // below to be rebuilt (and re-keyed in any Map callers hold) on every pick/measurement.
  const pickpointValueRef = useRef(pickpointValue);
  pickpointValueRef.current = pickpointValue;
  const measurementPointsRef = useRef(measurementPoints);
  measurementPointsRef.current = measurementPoints;

  // Held in a Map rather than state: registration happens in effects and must not re-render.
  const registry = useMemo(() => {
    const map = new Map<InteractiveTool, InteractiveToolConfig>();
    map.set('measure', {
      id: 'measure',
      enable: (presenter, enabled) => presenter.enableMeasurementTool?.(enabled),
      isEnabled: (presenter) => presenter.isMeasurementToolEnabled?.(),
      syncUi: syncMeasurementUi,
      captureState: () => measurementPointsRef.current,
      restoreState: (state) => {
        const points = state as [Vector3, Vector3] | null;
        if (!points) return;
        const [a, b] = points;
        presenterRef.current?.restoreMeasurement?.(a, b);
        setMeasurementValue(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
      }
    });
    map.set('pick', {
      id: 'pick',
      enable: (presenter, enabled) => presenter.enablePickpointMode?.(enabled),
      isEnabled: (presenter) => presenter.isPickpointModeEnabled?.(),
      syncUi: syncPickpointUi,
      onPick: ({ corrected }) => setPickpointValue(corrected),
      captureState: () => pickpointValueRef.current,
      restoreState: (state) => setPickpointValue(Array.isArray(state) ? (state as Vector3) : null)
    });
    return map;
  }, [presenterRef, setMeasurementValue, setPickpointValue, syncMeasurementUi, syncPickpointUi]);

  const isActive = useCallback(
    (config: InteractiveToolConfig, presenter: PresenterInstance) => {
      // Several tools may share one presenter mode (angle rides on pick-point mode), so the
      // presenter can only confirm activity for the tool the registry recorded as active.
      const recorded = activeInteractiveToolRef.current;
      if (recorded && recorded !== config.id) return false;
      if (typeof config.isEnabled === 'function') {
        const reported = config.isEnabled(presenter);
        if (typeof reported === 'boolean') return reported;
      }
      return recorded === config.id;
    },
    [activeInteractiveToolRef]
  );

  const deactivateTool = useCallback(
    (toolId: InteractiveTool, presenterOverride?: PresenterInstance | null) => {
      const presenter = presenterOverride ?? presenterRef.current;
      const config = registry.get(toolId);
      if (!presenter || !config) return false;
      if (!isActive(config, presenter)) return false;

      config.enable?.(presenter, false);
      config.syncUi?.(false);

      if (activeInteractiveToolRef.current === toolId) {
        activeInteractiveToolRef.current = null;
      }
      setActiveInteractiveTool((current) => (current === toolId ? null : current));
      return true;
    },
    [activeInteractiveToolRef, isActive, presenterRef, registry]
  );

  const toggleTool = useCallback(
    (toolId: InteractiveTool, presenterOverride?: PresenterInstance | null) => {
      const presenter = presenterOverride ?? presenterRef.current;
      const config = registry.get(toolId);
      if (!presenter || !config) return;

      if (isActive(config, presenter)) {
        void deactivateTool(toolId, presenter);
        return;
      }

      const activeTool = activeInteractiveToolRef.current;
      if (activeTool && activeTool !== toolId) {
        deactivateTool(activeTool, presenter);
      }

      config.enable?.(presenter, true);
      config.syncUi?.(true);
      activeInteractiveToolRef.current = toolId;
      setActiveInteractiveTool(toolId);
    },
    [activeInteractiveToolRef, deactivateTool, isActive, presenterRef, registry]
  );

  const registerInteractiveTool = useCallback(
    (config: InteractiveToolConfig) => {
      registry.set(config.id, config);
      return () => {
        // Only forget the tool if it hasn't been re-registered under the same id meanwhile.
        if (registry.get(config.id) === config) {
          if (activeInteractiveToolRef.current === config.id) {
            deactivateTool(config.id);
          }
          registry.delete(config.id);
        }
      };
    },
    [activeInteractiveToolRef, deactivateTool, registry]
  );

  const resetActiveTool = useCallback(() => {
    activeInteractiveToolRef.current = null;
    setActiveInteractiveTool(null);
  }, [activeInteractiveToolRef]);

  const reassertActiveTool = useCallback(
    (presenterOverride?: PresenterInstance | null) => {
      const presenter = presenterOverride ?? presenterRef.current;
      const activeId = activeInteractiveToolRef.current;
      const config = activeId ? registry.get(activeId) : undefined;
      if (!presenter || !config) return;
      config.enable?.(presenter, true);
    },
    [activeInteractiveToolRef, presenterRef, registry]
  );

  const dispatchPick = useCallback(
    (context: InteractiveToolPickContext) => {
      const activeId = activeInteractiveToolRef.current;
      const active = activeId ? registry.get(activeId) : undefined;
      if (active?.onPick) {
        active.onPick(context);
        return;
      }
      // A pick with no owning tool (e.g. 3DHOP's own pickpoint mode toggled elsewhere) still
      // surfaces in the shared output.
      setPickpointValue(context.corrected);
    },
    [activeInteractiveToolRef, registry, setPickpointValue]
  );

  const hasTool = useCallback((toolId: InteractiveTool) => registry.has(toolId), [registry]);

  const captureToolState = useCallback(
    (toolId?: InteractiveTool) => {
      const id = toolId ?? activeInteractiveToolRef.current;
      if (!id) return null;
      const config = registry.get(id);
      if (!config?.captureState) return null;
      return { toolId: id, state: config.captureState() };
    },
    [activeInteractiveToolRef, registry]
  );

  const restoreToolState = useCallback(
    (toolId: InteractiveTool, state: unknown) => {
      const presenter = presenterRef.current;
      const config = registry.get(toolId);
      if (!presenter || !config) return;
      if (activeInteractiveToolRef.current !== toolId) {
        toggleTool(toolId, presenter);
      }
      config.restoreState?.(state);
    },
    [activeInteractiveToolRef, presenterRef, registry, toggleTool]
  );

  return {
    activeInteractiveTool,
    registerInteractiveTool,
    toggleTool,
    deactivateTool,
    resetActiveTool,
    reassertActiveTool,
    dispatchPick,
    hasTool,
    captureToolState,
    restoreToolState
  };
}

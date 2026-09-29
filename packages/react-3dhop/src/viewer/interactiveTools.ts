/**
 * interactiveTools.ts keeps the viewer's mutually exclusive canvas tools in one place: a registry
 * of tool descriptors (built-in `measure` and `pick`, plus anything registered at runtime) and a
 * hook that toggles them so at most one is active, keeping presenter state and UI in step.
 */
import { useCallback, useMemo, useState } from 'react';
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
};

export type UseInteractiveToolsResult = {
  activeInteractiveTool: InteractiveTool | null;
  registerInteractiveTool: (config: InteractiveToolConfig) => () => void;
  toggleTool: (toolId: InteractiveTool, presenter?: PresenterInstance | null) => void;
  deactivateTool: (toolId: InteractiveTool, presenter?: PresenterInstance | null) => boolean;
  resetActiveTool: () => void;
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
  setPickpointValue
}: UseInteractiveToolsOptions): UseInteractiveToolsResult {
  const [activeInteractiveTool, setActiveInteractiveTool] = useState<InteractiveTool | null>(null);

  // Held in a Map rather than state: registration happens in effects and must not re-render.
  const registry = useMemo(() => {
    const map = new Map<InteractiveTool, InteractiveToolConfig>();
    map.set('measure', {
      id: 'measure',
      enable: (presenter, enabled) => presenter.enableMeasurementTool?.(enabled),
      isEnabled: (presenter) => presenter.isMeasurementToolEnabled?.(),
      syncUi: syncMeasurementUi
    });
    map.set('pick', {
      id: 'pick',
      enable: (presenter, enabled) => presenter.enablePickpointMode?.(enabled),
      isEnabled: (presenter) => presenter.isPickpointModeEnabled?.(),
      syncUi: syncPickpointUi,
      onPick: ({ corrected }) => setPickpointValue(corrected)
    });
    return map;
  }, [setPickpointValue, syncMeasurementUi, syncPickpointUi]);

  const isActive = useCallback(
    (config: InteractiveToolConfig, presenter: PresenterInstance) => {
      if (typeof config.isEnabled === 'function') {
        const reported = config.isEnabled(presenter);
        if (typeof reported === 'boolean') return reported;
      }
      return activeInteractiveToolRef.current === config.id;
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

  return {
    activeInteractiveTool,
    registerInteractiveTool,
    toggleTool,
    deactivateTool,
    resetActiveTool,
    dispatchPick,
    hasTool
  };
}

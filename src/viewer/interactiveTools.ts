/**
 * interactiveTools.ts keeps the viewer's mutually exclusive presenter tools in one place,
 * exposing a hook that coordinates presenter method calls with UI state tracking.
 *
 * The module defines shared tool metadata plus the React-facing helpers that callers use when
 * toggling measurement or pickpoint modes, ensuring state stays consistent across refs and UI.
 */
import { useCallback, useMemo, useState } from 'react';
import type React from 'react';
import type { PresenterInstance } from './types.js';

export type InteractiveTool = 'measure' | 'pick';

export type InteractiveToolConfig = {
  id: InteractiveTool;
  enable?: (presenter: PresenterInstance, enabled: boolean) => void;
  isEnabled?: (presenter: PresenterInstance) => boolean | undefined;
  syncUi: (enabled?: boolean) => void;
};

export type UseInteractiveToolsOptions = {
  presenterRef: React.MutableRefObject<PresenterInstance | null>;
  activeInteractiveToolRef: React.MutableRefObject<InteractiveTool | null>;
  syncMeasurementUi: (enabled?: boolean) => void;
  syncPickpointUi: (enabled?: boolean) => void;
};

export type UseInteractiveToolsResult = {
  activeInteractiveTool: InteractiveTool | null;
  toggleTool: (toolId: InteractiveTool, presenter?: PresenterInstance | null) => void;
  deactivateTool: (toolId: InteractiveTool, presenter?: PresenterInstance | null) => boolean;
  resetActiveTool: () => void;
};

/**
 * Custom React hook that manages mutually exclusive interactive tools (e.g. measurement, pickpoint)
 * for a 3D viewer presenter instance.
 *
 * The hook:
 * - Maintains a local React state `activeInteractiveTool` for the currently active tool (or null).
 * - Uses the provided presenter reference and interactive-tool config callbacks to enable/disable tools
 *   on the presenter and to keep external UI in sync.
 * - Mutates and respects an external ref `activeInteractiveToolRef` that mirrors the active tool state.
 *
 * Notes on behavior:
 * - Tool configurations are built from the supplied sync callbacks and presenter methods (e.g.
 *   `enableMeasurementTool`, `isMeasurementToolEnabled`, `enablePickpointMode`, `isPickpointModeEnabled`).
 * - Only one interactive tool is active at a time; enabling a tool will attempt to deactivate any other
 *   currently active tool.
 * - UI synchronization callbacks (`syncMeasurementUi`, `syncPickpointUi`) are invoked with the new enabled
 *   state whenever a tool is toggled or deactivated.
 *
 * @param options - Options object
 * @param options.presenterRef - Mutable ref to the presenter instance used to enable/disable tools.
 *   If a presenter override is passed to the returned functions, that override will be used instead.
 * @param options.activeInteractiveToolRef - Mutable ref that mirrors the currently active tool id (or null).
 *   This ref will be read to determine active state when presenter query functions are not available,
 *   and will be updated when tools are activated/deactivated.
 * @param options.syncMeasurementUi - Callback to synchronize the measurement UI when its enabled state changes.
 *   Called with `true` when the measurement tool is enabled and `false` when disabled.
 * @param options.syncPickpointUi - Callback to synchronize the pickpoint UI when its enabled state changes.
 *   Called with `true` when the pick tool is enabled and `false` when disabled.
 *
 * @returns An object with:
 * - `activeInteractiveTool`: the currently active tool id or `null`.
 * - `toggleTool(toolId, presenterOverride?)`: toggles the requested tool. If `presenterOverride` is provided it
 *   will be used instead of `presenterRef.current`. When enabling a tool, any other active tool will be
 *   deactivated first. No value is returned.
 * - `deactivateTool(toolId, presenterOverride?)`: deactivates the specified tool if it is active. Returns
 *   `true` if the tool was active and was deactivated, otherwise `false`. Uses `presenterOverride` if provided.
 * - `resetActiveTool()`: clears both the external `activeInteractiveToolRef.current` and the local
 *   `activeInteractiveTool` state to `null`.
 */
export function useInteractiveTools({
  presenterRef,
  activeInteractiveToolRef,
  syncMeasurementUi,
  syncPickpointUi
}: UseInteractiveToolsOptions): UseInteractiveToolsResult {
  const [activeInteractiveTool, setActiveInteractiveTool] = useState<InteractiveTool | null>(null);

  const interactiveToolConfigs = useMemo(() => {
    const configs: Map<InteractiveTool, InteractiveToolConfig> = new Map();

    configs.set('measure', {
      id: 'measure',
      enable: (presenter, enabled) => presenter.enableMeasurementTool?.(enabled),
      isEnabled: (presenter) => presenter.isMeasurementToolEnabled?.(),
      syncUi: syncMeasurementUi
    });

    configs.set('pick', {
      id: 'pick',
      enable: (presenter, enabled) => presenter.enablePickpointMode?.(enabled),
      isEnabled: (presenter) => presenter.isPickpointModeEnabled?.(),
      syncUi: syncPickpointUi
    });

    return configs;
  }, [syncMeasurementUi, syncPickpointUi]);

  const deactivateTool = useCallback(
    (toolId: InteractiveTool, presenterOverride?: PresenterInstance | null) => {
      const presenter = presenterOverride ?? presenterRef.current;
      if (!presenter) {
        return false;
      }

      const config = interactiveToolConfigs.get(toolId);
      if (!config || typeof config.enable !== 'function') {
        return false;
      }

      const isActive =
        typeof config.isEnabled === 'function'
          ? Boolean(config.isEnabled(presenter))
          : activeInteractiveToolRef.current === toolId;

      if (!isActive) {
        return false;
      }

      config.enable(presenter, false);
      config.syncUi(false);

      if (activeInteractiveToolRef.current === toolId) {
        activeInteractiveToolRef.current = null;
      }
      setActiveInteractiveTool((current) => (current === toolId ? null : current));

      return true;
    },
    [activeInteractiveToolRef, interactiveToolConfigs, presenterRef]
  );

  const toggleTool = useCallback(
    (toolId: InteractiveTool, presenterOverride?: PresenterInstance | null) => {
      const presenter = presenterOverride ?? presenterRef.current;
      if (!presenter) {
        return;
      }

      const config = interactiveToolConfigs.get(toolId);
      if (!config || typeof config.enable !== 'function') {
        return;
      }

      const currentlyEnabled =
        typeof config.isEnabled === 'function'
          ? Boolean(config.isEnabled(presenter))
          : activeInteractiveToolRef.current === toolId;
      const nextEnabled = !currentlyEnabled;

      if (nextEnabled) {
        const { current: activeTool } = activeInteractiveToolRef;
        if (activeTool && activeTool !== toolId) {
          deactivateTool(activeTool, presenter);
        }

        config.enable(presenter, true);
        config.syncUi(true);
        activeInteractiveToolRef.current = toolId;
        setActiveInteractiveTool(toolId);
      } else {
        void deactivateTool(toolId, presenter);
      }
    },
    [activeInteractiveToolRef, deactivateTool, interactiveToolConfigs, presenterRef]
  );

  const resetActiveTool = useCallback(() => {
    activeInteractiveToolRef.current = null;
    setActiveInteractiveTool(null);
  }, [activeInteractiveToolRef]);

  return {
    activeInteractiveTool,
    toggleTool,
    deactivateTool,
    resetActiveTool
  };
}

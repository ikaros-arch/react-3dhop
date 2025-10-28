// Centralized toolbar/DOM sync behavior via toolbarSync.ts:
// the hook encapsulates the previous UI helpers
// (alignment, toggle syncing, info panel state, etc.)
// and reports reusable controls back to the viewer.

import { useCallback, useRef } from 'react';
import type React from 'react';
import { getHopAllTag } from '../utils/hopTags.js';
import { queryToolbarElements, queryToolbarSidecars } from './dom.js';
import type { InteractiveTool } from './interactiveTools.js';
import type { PresenterInstance } from './types.js';

export type ToolbarSyncOptions = {
  presenterRef: React.MutableRefObject<PresenterInstance | null>;
  activeInteractiveToolRef: React.MutableRefObject<InteractiveTool | null>;
  setMeasurementValue: React.Dispatch<React.SetStateAction<number | null>>;
  setPickpointValue: React.Dispatch<React.SetStateAction<[number, number, number] | null>>;
};

export type ToolbarSync = {
  alignToolbarSidecars: () => void;
  syncMeasurementUi: (override?: boolean) => void;
  syncPickpointUi: (override?: boolean) => void;
  syncSectionsUi: () => void;
  syncLightSwitch: (override?: boolean) => boolean;
  syncLightingSwitch: (override?: boolean) => boolean;
  syncColorSwitch: (override?: boolean) => boolean;
  syncTransparencySwitch: (override?: boolean) => boolean;
  syncSpecularUi: (override?: boolean) => boolean;
  syncCameraSwitch: (override?: boolean) => boolean;
  syncHotspotSwitch: (override?: boolean) => boolean;
  syncFullscreenUi: (isFullscreen: boolean) => void;
  syncInfoUi: (override?: boolean) => boolean;
  setInfoVisibility: (visible: boolean) => void;
  toggleInfoVisibility: () => void;
  isControlVisible: (controlId: string) => boolean | null;
  infoBoxVisibleRef: React.MutableRefObject<boolean>;
};

export type { InteractiveTool };

export function useToolbarSync({
  presenterRef,
  activeInteractiveToolRef,
  setMeasurementValue,
  setPickpointValue
}: ToolbarSyncOptions): ToolbarSync {
  const infoBoxVisibleRef = useRef(false);

  const clearSelectionRange = useCallback(() => {
    const selection = window.getSelection?.();
    if (selection && selection.toString() !== '') {
      selection.removeAllRanges();
      return;
    }

    const legacySelection = (document as Document & {
      selection?: {
        empty?: () => void;
      };
    }).selection;

    legacySelection?.empty?.();
  }, []);

  const alignToolbarSidecars = useCallback(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const container = document.querySelector<HTMLElement>('[data-hop-toolbar-container="true"]');
    if (!container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const containerMidX = containerRect.left + containerRect.width / 2;
    const toolbars = Array.from(container.querySelectorAll<HTMLElement>('[data-hop-toolbar]'));

    toolbars.forEach((toolbar) => {
      const toolbarId = toolbar.getAttribute('data-hop-toolbar');
      if (!toolbarId) {
        return;
      }

      const toolbarRect = toolbar.getBoundingClientRect();
      const toolbarCenterX = toolbarRect.left + toolbarRect.width / 2;
      const isRightAligned = toolbarCenterX >= containerMidX;

      const anchorMap: Record<string, string[]> = {
        'measure-box': ['measure', 'measure_on'],
        'pickpoint-box': ['pick', 'pick_on'],
        'sections-box': ['sections', 'sections_on'],
        'info-box': ['info', 'info_on']
      };

      Object.entries(anchorMap).forEach(([sidecarId, anchorIds]) => {
        const sidecar = container.querySelector<HTMLElement>(
          `[data-hop-sidecar="${sidecarId}"][data-hop-toolbar-owner="${toolbarId}"]`
        );
        if (!sidecar) {
          return;
        }

        const anchor = anchorIds
          .map((candidate) => toolbar.querySelector<HTMLElement>(`[data-hop-id="${candidate}"]`))
          .find((element): element is HTMLElement => Boolean(element));
        if (!anchor) {
          return;
        }

        const anchorRect = anchor.getBoundingClientRect();
        const anchorTop = anchorRect.top - containerRect.top;
        const anchorRight = anchorRect.right - containerRect.left;

        sidecar.style.left = 'auto';
        sidecar.style.right = 'auto';

        if (isRightAligned) {
          const rightOffset = containerRect.right - anchorRect.left + 5;
          sidecar.style.right = `${Math.max(rightOffset, 0)}px`;
        } else {
          const leftOffset = anchorRight + 5;
          sidecar.style.left = `${Math.max(leftOffset, 0)}px`;
        }

        const top = anchorTop;
        sidecar.style.top = `${top}px`;
      });
    });
  }, []);

  const setControlVisibility = useCallback((controlId: string, visible: boolean) => {
    queryToolbarElements<HTMLElement>(controlId).forEach((element) => {
      element.style.visibility = visible ? 'visible' : 'hidden';
    });
  }, []);

  const setTogglePairVisibility = useCallback(
    (enabledControlId: string, disabledControlId: string, enabled: boolean) => {
      setControlVisibility(enabledControlId, enabled);
      setControlVisibility(disabledControlId, !enabled);
    },
    [setControlVisibility]
  );

  const isControlVisible = useCallback((controlId: string): boolean | null => {
    const element = queryToolbarElements<HTMLElement>(controlId)[0];
    if (!element) {
      return null;
    }
    return getComputedStyle(element).visibility !== 'hidden';
  }, []);

  const syncMeasurementUi = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const shouldEnable =
        typeof override === 'boolean'
          ? override
          : presenter?.isMeasurementToolEnabled?.() ?? activeInteractiveToolRef.current === 'measure';

      const measureElements = queryToolbarElements<HTMLImageElement>('measure');
      const measureOnElements = queryToolbarElements<HTMLImageElement>('measure_on');
      const measureBoxes = queryToolbarSidecars<HTMLDivElement>('measure-box');
      const canvas = document.getElementById('draw-canvas') as HTMLCanvasElement | null;

      if (shouldEnable) {
        measureElements.forEach((element) => {
          element.style.visibility = 'hidden';
        });
        measureOnElements.forEach((element) => {
          element.style.visibility = 'visible';
        });
        measureBoxes.forEach((element) => {
          element.style.display = 'table';
        });
        if (canvas) canvas.style.cursor = 'crosshair';
      } else {
        clearSelectionRange();
        measureOnElements.forEach((element) => {
          element.style.visibility = 'hidden';
        });
        measureElements.forEach((element) => {
          element.style.visibility = 'visible';
        });
        measureBoxes.forEach((element) => {
          element.style.display = 'none';
        });
        const anyMeasurementEnabled = presenter?.isAnyMeasurementEnabled?.() ?? false;
        if (canvas && !anyMeasurementEnabled) {
          canvas.style.cursor = 'default';
        }
        setMeasurementValue(null);
      }
      alignToolbarSidecars();
    },
    [
      activeInteractiveToolRef,
      alignToolbarSidecars,
      clearSelectionRange,
      presenterRef,
      setMeasurementValue
    ]
  );

  const syncPickpointUi = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const shouldEnable =
        typeof override === 'boolean'
          ? override
          : presenter?.isPickpointModeEnabled?.() ?? activeInteractiveToolRef.current === 'pick';

      const pickElements = queryToolbarElements<HTMLImageElement>('pick');
      const pickOnElements = queryToolbarElements<HTMLImageElement>('pick_on');
      const pickBoxes = queryToolbarSidecars<HTMLDivElement>('pickpoint-box');
      const canvas = document.getElementById('draw-canvas') as HTMLCanvasElement | null;

      if (shouldEnable) {
        pickElements.forEach((element) => {
          element.style.visibility = 'hidden';
        });
        pickOnElements.forEach((element) => {
          element.style.visibility = 'visible';
        });
        pickBoxes.forEach((element) => {
          element.style.display = 'table';
        });
        if (canvas) canvas.style.cursor = 'crosshair';
      } else {
        clearSelectionRange();
        pickOnElements.forEach((element) => {
          element.style.visibility = 'hidden';
        });
        pickElements.forEach((element) => {
          element.style.visibility = 'visible';
        });
        pickBoxes.forEach((element) => {
          element.style.display = 'none';
        });
        const anyMeasurementEnabled = presenter?.isAnyMeasurementEnabled?.() ?? false;
        if (canvas && !anyMeasurementEnabled) {
          canvas.style.cursor = 'default';
        }
        setPickpointValue(null);
      }
      alignToolbarSidecars();
    },
    [
      activeInteractiveToolRef,
      alignToolbarSidecars,
      clearSelectionRange,
      presenterRef,
      setPickpointValue
    ]
  );

  const syncSectionsUi = useCallback(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const reference = document.querySelector<HTMLElement>('[data-hop-id="sections_on"]');
    const isActive = reference ? getComputedStyle(reference).visibility !== 'hidden' : false;

    setTogglePairVisibility('sections_on', 'sections', isActive);

    const sectionBoxes = queryToolbarSidecars<HTMLDivElement>('sections-box');
    sectionBoxes.forEach((element) => {
      element.style.display = isActive ? 'table' : 'none';
    });

    alignToolbarSidecars();
  }, [alignToolbarSidecars, setTogglePairVisibility]);

  const syncLightSwitch = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const enabled =
        typeof override === 'boolean'
          ? override
          : presenter?.isLightTrackballEnabled?.() ?? false;

      setTogglePairVisibility('light_on', 'light', enabled);
      if (enabled) {
        setControlVisibility('lighting_off', false);
        setControlVisibility('lighting', true);
      }

      return enabled;
    },
    [presenterRef, setControlVisibility, setTogglePairVisibility]
  );

  const syncInfoUi = useCallback(
    (override?: boolean) => {
      const shouldShow = typeof override === 'boolean' ? override : infoBoxVisibleRef.current;

      const infoElements = queryToolbarElements<HTMLImageElement>('info');
      const infoOnElements = queryToolbarElements<HTMLImageElement>('info_on');
      const infoBoxes = queryToolbarSidecars<HTMLDivElement>('info-box');

      if (shouldShow) {
        infoElements.forEach((element) => {
          element.style.visibility = 'hidden';
        });
        infoOnElements.forEach((element) => {
          element.style.visibility = 'visible';
        });
        infoBoxes.forEach((element) => {
          element.style.display = 'table';
        });
      } else {
        infoOnElements.forEach((element) => {
          element.style.visibility = 'hidden';
        });
        infoElements.forEach((element) => {
          element.style.visibility = 'visible';
        });
        infoBoxes.forEach((element) => {
          element.style.display = 'none';
        });
      }

      alignToolbarSidecars();
      return shouldShow;
    },
    [alignToolbarSidecars]
  );

  const setInfoVisibility = useCallback(
    (visible: boolean) => {
      infoBoxVisibleRef.current = visible;
      syncInfoUi(visible);
    },
    [syncInfoUi]
  );

  const toggleInfoVisibility = useCallback(() => {
    setInfoVisibility(!infoBoxVisibleRef.current);
  }, [setInfoVisibility]);

  const syncLightingSwitch = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const enabled =
        typeof override === 'boolean'
          ? override
          : presenter?.isSceneLightingEnabled?.() ?? (isControlVisible('lighting') ?? false);

      setTogglePairVisibility('lighting', 'lighting_off', enabled);
      if (!enabled) {
        setControlVisibility('light_on', false);
        setControlVisibility('light', true);
      }

      return enabled;
    },
    [
      isControlVisible,
      presenterRef,
      setControlVisibility,
      setTogglePairVisibility
    ]
  );

  const syncColorSwitch = useCallback(
    (override?: boolean) => {
      const fallback = isControlVisible('color');
      const enabled = typeof override === 'boolean' ? override : fallback ?? true;

      setControlVisibility('color', !enabled);
      setControlVisibility('color_on', enabled);

      return enabled;
    },
    [isControlVisible, setControlVisibility]
  );

  const syncTransparencySwitch = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const presenterState =
        typeof presenter?.isInstanceTransparencyEnabled === 'function'
          ? presenter.isInstanceTransparencyEnabled(getHopAllTag())
          : undefined;

      const enabled =
        typeof override === 'boolean'
          ? override
          : typeof presenterState === 'boolean'
            ? presenterState
            : isControlVisible('transparency_on') ?? false;

      setControlVisibility('transparency_on', enabled);
      setControlVisibility('transparency', !enabled);

      return enabled;
    },
    [isControlVisible, presenterRef, setControlVisibility]
  );

  const syncSpecularUi = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const instances = presenter?._scene?.modelInstances as
        | Record<string, { specularColor?: number[] }>
        | undefined;

      const presenterState = instances
        ? Object.values(instances).some((instance) => {
            if (!instance) {
              return false;
            }
            const specular = instance.specularColor;
            if (!Array.isArray(specular) || specular.length < 3) {
              return false;
            }
            const [r = 0, g = 0, b = 0] = specular;
            return Math.abs(r) > 1e-3 || Math.abs(g) > 1e-3 || Math.abs(b) > 1e-3;
          })
        : undefined;

      const enabled =
        typeof override === 'boolean'
          ? override
          : typeof presenterState === 'boolean'
            ? presenterState
            : isControlVisible('specular_on') ?? false;

      setControlVisibility('specular_on', enabled);
      setControlVisibility('specular', !enabled);

      return enabled;
    },
    [isControlVisible, presenterRef, setControlVisibility]
  );

  const syncCameraSwitch = useCallback(
    (override?: boolean) => {
      const fallback = isControlVisible('perspective');
      const enabled = typeof override === 'boolean' ? override : fallback ?? true;

      setControlVisibility('perspective', !enabled);
      setControlVisibility('orthographic', enabled);

      return enabled;
    },
    [isControlVisible, setControlVisibility]
  );

  const syncHotspotSwitch = useCallback(
    (override?: boolean) => {
      const presenter = presenterRef.current;
      const enabled =
        typeof override === 'boolean'
          ? override
          : presenter?.isSpotVisibilityEnabled?.(getHopAllTag()) ?? (isControlVisible('hotspot_on') ?? false);

      setTogglePairVisibility('hotspot_on', 'hotspot', enabled);

      return enabled;
    },
    [isControlVisible, presenterRef, setTogglePairVisibility]
  );

  const syncFullscreenUi = useCallback(
    (isFullscreen: boolean) => {
      setControlVisibility('full', !isFullscreen);
      setControlVisibility('full_on', isFullscreen);
    },
    [setControlVisibility]
  );

  return {
    alignToolbarSidecars,
    syncMeasurementUi,
    syncPickpointUi,
    syncSectionsUi,
    syncLightSwitch,
    syncLightingSwitch,
    syncColorSwitch,
    syncTransparencySwitch,
    syncSpecularUi,
    syncCameraSwitch,
    syncHotspotSwitch,
    syncFullscreenUi,
    syncInfoUi,
    setInfoVisibility,
    toggleInfoVisibility,
    isControlVisible,
    infoBoxVisibleRef
  };
}

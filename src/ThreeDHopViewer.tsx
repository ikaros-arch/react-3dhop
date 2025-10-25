import React, { useEffect, useMemo, useRef } from 'react';
import {
  FullscreenControl,
  HomeControl,
  LightControl,
  Toolbar,
  ToolbarAssetsProvider,
  ZoomInControl,
  ZoomOutControl
} from './Toolbar';

const CSS_RESOURCES = ['stylesheet/3dhop.css'];

const SCRIPT_RESOURCES = [
  'js/spidergl.js',
  'js/jquery.js',
  'js/presenter.js',
  'js/nexus.js',
  'js/ply.js',
  'js/trackball_turntable.js',
  'js/trackball_turntable_pan.js',
  'js/trackball_pantilt.js',
  'js/trackball_sphere.js',
  'js/init.js'
];

const cssPromises = new Map<string, Promise<void>>();
const scriptPromises = new Map<string, Promise<void>>();

type PresenterInstance = {
  setScene: (scene: unknown) => void;
  resetTrackball: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  enableLightTrackball: (enabled: boolean) => void;
  isLightTrackballEnabled: () => boolean;
  destroy?: () => void;
} & Record<string, unknown>;

declare global {
  interface Window {
    Presenter: new (canvasId: string) => PresenterInstance;
    TurnTableTrackball: unknown;
    init3dhop?: () => void;
    lightSwitch?: (on?: boolean) => void;
    fullscreenSwitch?: () => void;
    actionsToolbar?: (action: string) => void;
    presenter: PresenterInstance | null | undefined;
  }
}

export type ThreeDHopViewerProps = {
  assetBaseUrl?: string;
  modelUrl?: string;
  className?: string;
  style?: React.CSSProperties;
  width?: number | string;
  height?: number | string;
  showToolbar?: boolean;
  children?: React.ReactNode;
};

function loadCssOnce(href: string): Promise<void> {
  if (cssPromises.has(href)) {
    return cssPromises.get(href)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    if (document.querySelector(`link[data-3dhop-source="${href}"]`)) {
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-3dhop-source', href);
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
    document.head.appendChild(link);
  });

  cssPromises.set(href, promise);
  return promise;
}

function loadScriptOnce(src: string): Promise<void> {
  if (scriptPromises.has(src)) {
    return scriptPromises.get(src)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[data-3dhop-source="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = src;
    script.async = false;
    script.setAttribute('data-3dhop-source', src);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });

  scriptPromises.set(src, promise);
  return promise;
}

async function ensureAssets(baseUrl: string): Promise<void> {
  await Promise.all(CSS_RESOURCES.map((file) => loadCssOnce(`${baseUrl}/${file}`)));
  for (const file of SCRIPT_RESOURCES) {
    // Sequential load keeps execution order identical to the static HTML bootstrap.
    // eslint-disable-next-line no-await-in-loop
    await loadScriptOnce(`${baseUrl}/${file}`);
  }
}

export const ThreeDHopViewer: React.FC<ThreeDHopViewerProps> = ({
  assetBaseUrl = '/node_modules/react-3dhop/dist/3dhop',
  modelUrl,
  className,
  style,
  width = '100%',
  height = '100%',
  showToolbar = true,
  children
}) => {
  const presenterRef = useRef<PresenterInstance | null>(null);
  const previousActionsRef = useRef<typeof window.actionsToolbar>();
  const previousPresenterRef = useRef<typeof window.presenter>();

  const normalizedBaseUrl = useMemo(() => {
    if (assetBaseUrl.endsWith('/') && assetBaseUrl !== '/') {
      return assetBaseUrl.slice(0, -1);
    }
    return assetBaseUrl;
  }, [assetBaseUrl]);

  const resolvedModelUrl = useMemo(
    () => modelUrl ?? `${normalizedBaseUrl}/models/gargo.nxz`,
    [modelUrl, normalizedBaseUrl]
  );

  const hasCustomToolbar = React.Children.count(children ?? []) > 0;

  useEffect(() => {
    let disposed = false;

    const toolbarHandler = (action: string) => {
      const presenter = presenterRef.current;
      if (!presenter) return;

      switch (action) {
        case 'home':
          presenter.resetTrackball();
          break;
        case 'zoomin':
          presenter.zoomIn();
          break;
        case 'zoomout':
          presenter.zoomOut();
          break;
        case 'light':
        case 'light_on':
          presenter.enableLightTrackball(!presenter.isLightTrackballEnabled());
          window.lightSwitch?.();
          break;
        case 'full':
        case 'full_on':
          window.fullscreenSwitch?.();
          break;
        default:
          break;
      }
    };

    const setup = async () => {
      try {
        previousActionsRef.current = window.actionsToolbar;
        previousPresenterRef.current = window.presenter;

        await ensureAssets(normalizedBaseUrl);
        if (disposed) return;

        window.actionsToolbar = toolbarHandler;

        if (typeof window.init3dhop === 'function') {
          window.init3dhop();
        }

        const presenter = new window.Presenter('draw-canvas');
        presenterRef.current = presenter;
        window.presenter = presenter;

        presenter.setScene({
          meshes: {
            mesh_1: { url: resolvedModelUrl }
          },
          modelInstances: {
            model_1: { mesh: 'mesh_1' }
          },
          trackball: {
            type: window.TurnTableTrackball,
            trackOptions: {
              startPhi: 35.0,
              startTheta: 15.0,
              startDistance: 2.5,
              minMaxPhi: [-180, 180],
              minMaxTheta: [-30.0, 70.0],
              minMaxDist: [0.5, 3.0]
            }
          }
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize 3DHOP viewer', error);
      }
    };

    setup();

    return () => {
      disposed = true;

      if (presenterRef.current && typeof presenterRef.current.destroy === 'function') {
        presenterRef.current.destroy();
      }

      if (window.actionsToolbar === toolbarHandler) {
        window.actionsToolbar = previousActionsRef.current;
      }

      if (window.presenter === presenterRef.current) {
        window.presenter = previousPresenterRef.current ?? null;
      }

      presenterRef.current = null;
    };
    // `assetBaseUrl` and `resolvedModelUrl` are captured intentionally for first render only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const presenter = presenterRef.current;
    if (!presenter) {
      return;
    }

    presenter.setScene({
      meshes: {
        mesh_1: { url: resolvedModelUrl }
      },
      modelInstances: {
        model_1: { mesh: 'mesh_1' }
      },
      trackball: {
        type: window.TurnTableTrackball,
        trackOptions: {
          startPhi: 35.0,
          startTheta: 15.0,
          startDistance: 2.5,
          minMaxPhi: [-180, 180],
          minMaxTheta: [-30.0, 70.0],
          minMaxDist: [0.5, 3.0]
        }
      }
    });
  }, [resolvedModelUrl]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        ...style
      }}
    >
      <div
        id="3dhop"
        className="tdhop"
        onMouseDown={(event: React.MouseEvent<HTMLDivElement>) => {
          if (event.preventDefault) {
            event.preventDefault();
          }
        }}
      >
        <div id="tdhlg" />
        {showToolbar ? (
          <ToolbarAssetsProvider assetBaseUrl={normalizedBaseUrl}>
            {hasCustomToolbar ? (
              children
            ) : (
              <Toolbar>
                <HomeControl />
                <ZoomInControl />
                <ZoomOutControl />
                <LightControl />
                <FullscreenControl />
              </Toolbar>
            )}
          </ToolbarAssetsProvider>
        ) : null}
        <canvas
          id="draw-canvas"
          style={{ backgroundImage: `url(${normalizedBaseUrl}/skins/backgrounds/light.jpg)` }}
        />
      </div>
    </div>
  );
};

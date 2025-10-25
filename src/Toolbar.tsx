import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { joinAssetPath, resolveRelativeAssetPath } from './utils/assetPaths';

type ToolbarAssetsContextValue = {
  assetBaseUrl: string;
};

const ToolbarAssetsContext = createContext<ToolbarAssetsContextValue>({ assetBaseUrl: '' });

type SidecarRegistry = {
  register: (key: string, element: React.ReactNode) => void;
  unregister: (key: string) => void;
};

const ToolbarSidecarContext = createContext<SidecarRegistry | null>(null);

export const ToolbarAssetsProvider: React.FC<{ assetBaseUrl: string; children: React.ReactNode }> = ({
  assetBaseUrl,
  children
}) => (
  <ToolbarAssetsContext.Provider value={{ assetBaseUrl }}>{children}</ToolbarAssetsContext.Provider>
);

function useToolbarAssets(): ToolbarAssetsContextValue {
  return useContext(ToolbarAssetsContext);
}

type ToolbarPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const POSITION_STYLES: Record<ToolbarPosition, React.CSSProperties> = {
  'top-left': { top: '12px', left: '12px', right: 'auto', bottom: 'auto' },
  'top-right': { top: '12px', right: '12px', left: 'auto', bottom: 'auto' },
  'bottom-left': { bottom: '12px', left: '12px', top: 'auto', right: 'auto' },
  'bottom-right': { bottom: '12px', right: '12px', top: 'auto', left: 'auto' }
};

export type ToolbarProps = {
  position?: ToolbarPosition;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const Toolbar: React.FC<ToolbarProps> = ({ position, style, children, ...rest }) => {
  const [sidecars, setSidecars] = useState<Map<string, React.ReactNode>>(new Map());

  const register = useCallback((key: string, element: React.ReactNode) => {
    setSidecars((prev) => {
      const next = new Map(prev);
      next.set(key, element);
      return next;
    });
  }, []);

  const unregister = useCallback((key: string) => {
    setSidecars((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const sidecarContext = useMemo<SidecarRegistry>(() => ({ register, unregister }), [register, unregister]);

  const inlineStyle: React.CSSProperties | undefined = position
    ? { position: 'absolute', ...POSITION_STYLES[position], ...style }
    : style;

  return (
    <ToolbarSidecarContext.Provider value={sidecarContext}>
      <div id="toolbar" {...rest} style={inlineStyle}>
        {children}
      </div>
      {Array.from(sidecars.entries()).map(([key, element]) => (
        <React.Fragment key={key}>{element}</React.Fragment>
      ))}
    </ToolbarSidecarContext.Provider>
  );
};

type BasicControlProps = {
  title?: string;
  icon?: string;
  imgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
};

const ToolbarImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ alt, ...rest }) => (
  <img alt={alt ?? ''} {...rest} />
);

export const ToolbarSeparator: React.FC = () => <br />;

function useToolbarSidecar(key: string, element: React.ReactNode | null) {
  const sidecar = useContext(ToolbarSidecarContext);

  useEffect(() => {
    if (!sidecar || element == null) return;
    sidecar.register(key, element);
    return () => {
      sidecar.unregister(key);
    };
  }, [sidecar, key, element]);
}

export const HomeControl: React.FC<BasicControlProps> = ({ title, icon, imgProps }) => {
  const { assetBaseUrl } = useToolbarAssets();
  const resolvedTitle = title ?? 'Home';
  const resolvedIcon = resolveRelativeAssetPath(icon, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/home.png'));

  return (
    <>
      <ToolbarImage id="home" title={resolvedTitle} src={resolvedIcon} {...imgProps} />
      <ToolbarSeparator />
    </>
  );
};

export const ZoomInControl: React.FC<BasicControlProps> = ({ title, icon, imgProps }) => {
  const { assetBaseUrl } = useToolbarAssets();
  const resolvedTitle = title ?? 'Zoom In';
  const resolvedIcon = resolveRelativeAssetPath(icon, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/zoomin.png'));

  return (
    <>
      <ToolbarImage id="zoomin" title={resolvedTitle} src={resolvedIcon} {...imgProps} />
      <ToolbarSeparator />
    </>
  );
};

export const ZoomOutControl: React.FC<BasicControlProps> = ({ title, icon, imgProps }) => {
  const { assetBaseUrl } = useToolbarAssets();
  const resolvedTitle = title ?? 'Zoom Out';
  const resolvedIcon = resolveRelativeAssetPath(icon, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/zoomout.png'));

  return (
    <>
      <ToolbarImage id="zoomout" title={resolvedTitle} src={resolvedIcon} {...imgProps} />
      <ToolbarSeparator />
    </>
  );
};

type ToggleLabels = {
  enabled?: string;
  disabled?: string;
};

type ToggleIcons = {
  enabled?: string;
  disabled?: string;
};

type ToggleImgProps = {
  enabledImgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
  disabledImgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
};

export type LightControlProps = {
  title?: ToggleLabels;
  icon?: ToggleIcons;
} & ToggleImgProps;

export const LightControl: React.FC<LightControlProps> = ({ title, icon, enabledImgProps, disabledImgProps }) => {
  const { assetBaseUrl } = useToolbarAssets();
  const enabledTitle = title?.enabled ?? 'Disable Light Control';
  const disabledTitle = title?.disabled ?? 'Enable Light Control';
  const enabledIcon = resolveRelativeAssetPath(icon?.enabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/lightcontrol_on.png'));
  const disabledIcon = resolveRelativeAssetPath(icon?.disabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/lightcontrol.png'));
  const { style: enabledStyle, ...restEnabledProps } = enabledImgProps ?? {};
  const { style: disabledStyle, ...restDisabledProps } = disabledImgProps ?? {};

  return (
    <>
      <ToolbarImage
        id="light_on"
        title={enabledTitle}
        src={enabledIcon}
        style={{ position: 'absolute', visibility: 'hidden', ...enabledStyle }}
        {...restEnabledProps}
      />
      <ToolbarImage
        id="light"
        title={disabledTitle}
        src={disabledIcon}
        style={disabledStyle}
        {...restDisabledProps}
      />
      <ToolbarSeparator />
    </>
  );
};

export type FullscreenControlProps = {
  title?: ToggleLabels;
  icon?: ToggleIcons;
} & ToggleImgProps;

export const FullscreenControl: React.FC<FullscreenControlProps> = ({
  title,
  icon,
  enabledImgProps,
  disabledImgProps
}) => {
  const { assetBaseUrl } = useToolbarAssets();
  const enabledTitle = title?.enabled ?? 'Exit Full Screen';
  const disabledTitle = title?.disabled ?? 'Full Screen';
  const enabledIcon = resolveRelativeAssetPath(icon?.enabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/full_on.png'));
  const disabledIcon = resolveRelativeAssetPath(icon?.disabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/full.png'));
  const { style: enabledStyle, ...restEnabledProps } = enabledImgProps ?? {};
  const { style: disabledStyle, ...restDisabledProps } = disabledImgProps ?? {};

  return (
    <>
      <ToolbarImage
        id="full_on"
        title={enabledTitle}
        src={enabledIcon}
        style={{ position: 'absolute', visibility: 'hidden', ...enabledStyle }}
        {...restEnabledProps}
      />
      <ToolbarImage id="full" title={disabledTitle} src={disabledIcon} style={disabledStyle} {...restDisabledProps} />
    </>
  );
};

export type LightingControlProps = {
  title?: ToggleLabels;
  icon?: ToggleIcons;
} & ToggleImgProps;

export const LightingControl: React.FC<LightingControlProps> = ({
  title,
  icon,
  enabledImgProps,
  disabledImgProps
}) => {
  const { assetBaseUrl } = useToolbarAssets();
  const enabledTitle = title?.enabled ?? 'Disable Lighting';
  const disabledTitle = title?.disabled ?? 'Enable Lighting';
  const enabledIcon = resolveRelativeAssetPath(icon?.enabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/lighting.png'));
  const disabledIcon = resolveRelativeAssetPath(icon?.disabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/lighting_off.png'));
  const { style: enabledStyle, ...restEnabledProps } = enabledImgProps ?? {};
  const { style: disabledStyle, ...restDisabledProps } = disabledImgProps ?? {};

  return (
    <>
      <ToolbarImage
        id="lighting_off"
        title={disabledTitle}
        src={disabledIcon}
        style={{ position: 'absolute', visibility: 'hidden', ...disabledStyle }}
        {...restDisabledProps}
      />
      <ToolbarImage
        id="lighting"
        title={enabledTitle}
        src={enabledIcon}
        style={enabledStyle}
        {...restEnabledProps}
      />
      <ToolbarSeparator />
    </>
  );
};

export type ColorControlProps = {
  title?: ToggleLabels;
  icon?: ToggleIcons;
} & ToggleImgProps;

export const ColorControl: React.FC<ColorControlProps> = ({ title, icon, enabledImgProps, disabledImgProps }) => {
  const { assetBaseUrl } = useToolbarAssets();
  const enabledTitle = title?.enabled ?? 'Disable Solid Color';
  const disabledTitle = title?.disabled ?? 'Enable Solid Color';
  const enabledIcon = resolveRelativeAssetPath(icon?.enabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/color_on.png'));
  const disabledIcon = resolveRelativeAssetPath(icon?.disabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/color.png'));
  const { style: enabledStyle, ...restEnabledProps } = enabledImgProps ?? {};
  const { style: disabledStyle, ...restDisabledProps } = disabledImgProps ?? {};

  return (
    <>
      <ToolbarImage
        id="color_on"
        title={enabledTitle}
        src={enabledIcon}
        style={{ position: 'absolute', visibility: 'hidden', ...enabledStyle }}
        {...restEnabledProps}
      />
      <ToolbarImage id="color" title={disabledTitle} src={disabledIcon} style={disabledStyle} {...restDisabledProps} />
      <ToolbarSeparator />
    </>
  );
};

export type CameraControlProps = {
  title?: ToggleLabels;
  icon?: ToggleIcons;
} & ToggleImgProps;

export const CameraControl: React.FC<CameraControlProps> = ({ title, icon, enabledImgProps, disabledImgProps }) => {
  const { assetBaseUrl } = useToolbarAssets();
  const enabledTitle = title?.enabled ?? 'Perspective Camera';
  const disabledTitle = title?.disabled ?? 'Orthographic Camera';
  const enabledIcon = resolveRelativeAssetPath(icon?.enabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/perspective.png'));
  const disabledIcon = resolveRelativeAssetPath(icon?.disabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/orthographic.png'));
  const { style: enabledStyle, ...restEnabledProps } = enabledImgProps ?? {};
  const { style: disabledStyle, ...restDisabledProps } = disabledImgProps ?? {};

  return (
    <>
      <ToolbarImage
        id="perspective"
        title={enabledTitle}
        src={enabledIcon}
        style={{ position: 'absolute', visibility: 'hidden', ...enabledStyle }}
        {...restEnabledProps}
      />
      <ToolbarImage
        id="orthographic"
        title={disabledTitle}
        src={disabledIcon}
        style={disabledStyle}
        {...restDisabledProps}
      />
      <ToolbarSeparator />
    </>
  );
};

export type ScreenshotControlProps = {
  title?: string;
  icon?: string;
  imgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
};

export const ScreenshotControl: React.FC<ScreenshotControlProps> = ({ title, icon, imgProps }) => {
  const { assetBaseUrl } = useToolbarAssets();
  const resolvedTitle = title ?? 'Save Screenshot';
  const resolvedIcon = resolveRelativeAssetPath(icon, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/screenshot.png'));

  return (
    <>
      <ToolbarImage id="screenshot" title={resolvedTitle} src={resolvedIcon} {...imgProps} />
      <ToolbarSeparator />
    </>
  );
};

export type MeasureControlProps = {
  title?: ToggleLabels;
  icon?: ToggleIcons;
  label?: string;
  initialDisplayValue?: string;
} & ToggleImgProps;

export const MeasureControl: React.FC<MeasureControlProps> = ({
  title,
  icon,
  label,
  initialDisplayValue,
  enabledImgProps,
  disabledImgProps
}) => {
  const { assetBaseUrl } = useToolbarAssets();
  const enabledTitle = title?.enabled ?? 'Disable Measure Tool';
  const disabledTitle = title?.disabled ?? 'Enable Measure Tool';
  const enabledIcon = resolveRelativeAssetPath(icon?.enabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/measure_on.png'));
  const disabledIcon = resolveRelativeAssetPath(icon?.disabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/measure.png'));
  const { style: enabledStyle, ...restEnabledProps } = enabledImgProps ?? {};
  const { style: disabledStyle, ...restDisabledProps } = disabledImgProps ?? {};

  useToolbarSidecar(
    'measure-box',
    (
      <div id="measure-box" className="output-box">
        {label ?? 'Measured length'}
        <hr />
        <span
          id="measure-output"
          className="output-text"
          onMouseDown={(event) => event.stopPropagation()}
        >
          {initialDisplayValue ?? '0.0'}
        </span>
      </div>
    )
  );

  return (
    <>
      <ToolbarImage
        id="measure_on"
        title={enabledTitle}
        src={enabledIcon}
        style={{ position: 'absolute', visibility: 'hidden', ...enabledStyle }}
        {...restEnabledProps}
      />
      <ToolbarImage id="measure" title={disabledTitle} src={disabledIcon} style={disabledStyle} {...restDisabledProps} />
      <ToolbarSeparator />
    </>
  );
};

export type PickControlProps = {
  title?: ToggleLabels;
  icon?: ToggleIcons;
  label?: string;
  initialDisplayValue?: string;
} & ToggleImgProps;

export const PickControl: React.FC<PickControlProps> = ({
  title,
  icon,
  label,
  initialDisplayValue,
  enabledImgProps,
  disabledImgProps
}) => {
  const { assetBaseUrl } = useToolbarAssets();
  const enabledTitle = title?.enabled ?? 'Disable PickPoint Mode';
  const disabledTitle = title?.disabled ?? 'Enable PickPoint Mode';
  const enabledIcon = resolveRelativeAssetPath(icon?.enabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/pick_on.png'));
  const disabledIcon = resolveRelativeAssetPath(icon?.disabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/pick.png'));
  const { style: enabledStyle, ...restEnabledProps } = enabledImgProps ?? {};
  const { style: disabledStyle, ...restDisabledProps } = disabledImgProps ?? {};

  useToolbarSidecar(
    'pickpoint-box',
    (
      <div id="pickpoint-box" className="output-box">
        {label ?? 'XYZ picked point'}
        <hr />
        <span
          id="pickpoint-output"
          className="output-text"
          onMouseDown={(event) => event.stopPropagation()}
        >
          {initialDisplayValue ?? '[ 0 , 0 , 0 ]'}
        </span>
      </div>
    )
  );

  return (
    <>
      <ToolbarImage
        id="pick_on"
        title={enabledTitle}
        src={enabledIcon}
        style={{ position: 'absolute', visibility: 'hidden', ...enabledStyle }}
        {...restEnabledProps}
      />
      <ToolbarImage id="pick" title={disabledTitle} src={disabledIcon} style={disabledStyle} {...restDisabledProps} />
      <ToolbarSeparator />
    </>
  );
};

export type SectionsControlProps = {
  title?: ToggleLabels;
  icon?: ToggleIcons;
  planeLabels?: {
    x?: string;
    y?: string;
    z?: string;
  };
  showPlanesLabel?: string;
  showEdgesLabel?: string;
} & ToggleImgProps;

export const SectionsControl: React.FC<SectionsControlProps> = ({
  title,
  icon,
  planeLabels,
  showPlanesLabel,
  showEdgesLabel,
  enabledImgProps,
  disabledImgProps
}) => {
  const { assetBaseUrl } = useToolbarAssets();
  const enabledTitle = title?.enabled ?? 'Disable Plane Sections';
  const disabledTitle = title?.disabled ?? 'Enable Plane Sections';
  const enabledIcon = resolveRelativeAssetPath(icon?.enabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/sections_on.png'));
  const disabledIcon = resolveRelativeAssetPath(icon?.disabled, assetBaseUrl, joinAssetPath(assetBaseUrl, 'skins/dark/sections.png'));
  const { style: enabledStyle, ...restEnabledProps } = enabledImgProps ?? {};
  const { style: disabledStyle, ...restDisabledProps } = disabledImgProps ?? {};

  useToolbarSidecar(
    'sections-box',
    (
      <div id="sections-box" className="output-box">
        <table className="output-table" onMouseDown={(event) => event.stopPropagation()}>
          <tbody>
            <tr>
              <td>Plane</td>
              <td>Position</td>
              <td>Flip</td>
            </tr>
            <tr>
              <td>
                <img
                  id="xplane_on"
                  title={`Disable ${planeLabels?.x ?? 'X Axis'} Section`}
                  src={`${assetBaseUrl}/skins/icons/sectionX_on.png`}
                  onClick={() => window.sectionxSwitch?.()}
                  style={{ position: 'absolute', visibility: 'hidden', border: '1px inset' }}
                />
                <img
                  id="xplane"
                  title={`Enable ${planeLabels?.x ?? 'X Axis'} Section`}
                  src={`${assetBaseUrl}/skins/icons/sectionX.png`}
                  onClick={() => window.sectionxSwitch?.()}
                />
                <br />
              </td>
              <td>
                <input
                  id="xplaneSlider"
                  className="output-input"
                  type="range"
                  title={`Move ${planeLabels?.x ?? 'X Axis'} Section Position`}
                  defaultValue={0.5}
                />
              </td>
              <td>
                <input
                  id="xplaneFlip"
                  className="output-input"
                  type="checkbox"
                  title={`Flip ${planeLabels?.x ?? 'X Axis'} Section Direction`}
                />
              </td>
            </tr>
            <tr>
              <td>
                <img
                  id="yplane_on"
                  title={`Disable ${planeLabels?.y ?? 'Y Axis'} Section`}
                  src={`${assetBaseUrl}/skins/icons/sectionY_on.png`}
                  onClick={() => window.sectionySwitch?.()}
                  style={{ position: 'absolute', visibility: 'hidden', border: '1px inset' }}
                />
                <img
                  id="yplane"
                  title={`Enable ${planeLabels?.y ?? 'Y Axis'} Section`}
                  src={`${assetBaseUrl}/skins/icons/sectionY.png`}
                  onClick={() => window.sectionySwitch?.()}
                />
                <br />
              </td>
              <td>
                <input
                  id="yplaneSlider"
                  className="output-input"
                  type="range"
                  title={`Move ${planeLabels?.y ?? 'Y Axis'} Section Position`}
                  defaultValue={0.5}
                />
              </td>
              <td>
                <input
                  id="yplaneFlip"
                  className="output-input"
                  type="checkbox"
                  title={`Flip ${planeLabels?.y ?? 'Y Axis'} Section Direction`}
                />
              </td>
            </tr>
            <tr>
              <td>
                <img
                  id="zplane_on"
                  title={`Disable ${planeLabels?.z ?? 'Z Axis'} Section`}
                  src={`${assetBaseUrl}/skins/icons/sectionZ_on.png`}
                  onClick={() => window.sectionzSwitch?.()}
                  style={{ position: 'absolute', visibility: 'hidden', border: '1px inset' }}
                />
                <img
                  id="zplane"
                  title={`Enable ${planeLabels?.z ?? 'Z Axis'} Section`}
                  src={`${assetBaseUrl}/skins/icons/sectionZ.png`}
                  onClick={() => window.sectionzSwitch?.()}
                />
                <br />
              </td>
              <td>
                <input
                  id="zplaneSlider"
                  className="output-input"
                  type="range"
                  title={`Move ${planeLabels?.z ?? 'Z Axis'} Section Position`}
                  defaultValue={0.5}
                />
              </td>
              <td>
                <input
                  id="zplaneFlip"
                  className="output-input"
                  type="checkbox"
                  title={`Flip ${planeLabels?.z ?? 'Z Axis'} Section Direction`}
                />
              </td>
            </tr>
          </tbody>
        </table>
        <table
          className="output-table"
          onMouseDown={(event) => event.stopPropagation()}
          style={{ textAlign: 'right' }}
        >
          <tbody>
            <tr>
              <td>
                {showPlanesLabel ?? 'Show planes'}
                <input
                  id="showPlane"
                  className="output-input"
                  type="checkbox"
                  title="Show Section Planes"
                  style={{ bottom: '-3px' }}
                />
              </td>
              <td>
                {showEdgesLabel ?? 'Show edges'}
                <input
                  id="showBorder"
                  className="output-input"
                  type="checkbox"
                  title="Show Section Edges"
                  style={{ bottom: '-3px' }}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  );

  return (
    <>
      <ToolbarImage
        id="sections_on"
        title={enabledTitle}
        src={enabledIcon}
        style={{ position: 'absolute', visibility: 'hidden', ...enabledStyle }}
        {...restEnabledProps}
      />
      <ToolbarImage id="sections" title={disabledTitle} src={disabledIcon} style={disabledStyle} {...restDisabledProps} />
      <ToolbarSeparator />
    </>
  );
};

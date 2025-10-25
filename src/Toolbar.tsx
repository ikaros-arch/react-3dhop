import React, { createContext, useContext } from 'react';

type ToolbarAssetsContextValue = {
  assetBaseUrl: string;
};

const ToolbarAssetsContext = createContext<ToolbarAssetsContextValue>({ assetBaseUrl: '' });

export const ToolbarAssetsProvider: React.FC<{ assetBaseUrl: string; children: React.ReactNode }> = ({
  assetBaseUrl,
  children
}) => (
  <ToolbarAssetsContext.Provider value={{ assetBaseUrl }}>{children}</ToolbarAssetsContext.Provider>
);

function useToolbarAssets(): ToolbarAssetsContextValue {
  return useContext(ToolbarAssetsContext);
}

function isAbsoluteUrl(value: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/?\/)/i.test(value);
}

function resolveAssetPath(provided: string | undefined, baseUrl: string, fallback: string): string {
  if (!provided) return fallback;
  if (isAbsoluteUrl(provided)) {
    return provided;
  }
  const sanitized = provided.replace(/^\/+/, '');
  if (!sanitized) {
    return fallback;
  }
  return `${baseUrl}/${sanitized}`;
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
  const inlineStyle: React.CSSProperties | undefined = position
    ? { position: 'absolute', ...POSITION_STYLES[position], ...style }
    : style;

  return (
    <div id="toolbar" {...rest} style={inlineStyle}>
      {children}
    </div>
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

export const HomeControl: React.FC<BasicControlProps> = ({ title, icon, imgProps }) => {
  const { assetBaseUrl } = useToolbarAssets();
  const resolvedTitle = title ?? 'Home';
  const resolvedIcon = resolveAssetPath(icon, assetBaseUrl, `${assetBaseUrl}/skins/dark/home.png`);

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
  const resolvedIcon = resolveAssetPath(icon, assetBaseUrl, `${assetBaseUrl}/skins/dark/zoomin.png`);

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
  const resolvedIcon = resolveAssetPath(icon, assetBaseUrl, `${assetBaseUrl}/skins/dark/zoomout.png`);

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
  const enabledIcon = resolveAssetPath(icon?.enabled, assetBaseUrl, `${assetBaseUrl}/skins/dark/lightcontrol_on.png`);
  const disabledIcon = resolveAssetPath(icon?.disabled, assetBaseUrl, `${assetBaseUrl}/skins/dark/lightcontrol.png`);
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
      <ToolbarImage id="light" title={disabledTitle} src={disabledIcon} style={disabledStyle} {...restDisabledProps} />
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
  const enabledIcon = resolveAssetPath(icon?.enabled, assetBaseUrl, `${assetBaseUrl}/skins/dark/full_on.png`);
  const disabledIcon = resolveAssetPath(icon?.disabled, assetBaseUrl, `${assetBaseUrl}/skins/dark/full.png`);
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

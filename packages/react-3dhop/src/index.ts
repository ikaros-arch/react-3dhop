export { ThreeDHopViewer, useThreeDHopViewer } from './ThreeDHopViewer.js';
export type {
	ThreeDHopViewerProps,
	ModelDefinition,
	ModelInstanceConfiguration,
	ModelTransparencyOptions,
	ModelTransformConfig,
	SceneConfiguration,
	SceneContribution,
	SceneMeshDefinition,
	SceneMeshes,
	SceneRenderConfig,
	SceneSpaceConfig,
	CameraType,
	CoordinateCorrections,
	AnnotationPickEvent,
	AnnotationPickHandler,
	PresenterInstance,
	ThreeDHopViewerContextValue,
	ToolbarActionHandler,
	SceneObserver,
	SceneReadyObserver,
	LightObserver,
	InteractiveTool,
	InteractiveToolConfig,
	InteractiveToolPickContext,
	SceneBounds,
	SceneEntity,
	SceneEntitySpec,
	SceneEntityType,
	ThemeMode,
	ThemeName,
	Vector3,
	TrackballConfig,
	TrackballName,
	TrackballObserver,
	TrackOptions
} from './ThreeDHopViewer.js';

// Extension hooks: build tools and overlays on the same primitives the built-ins use.
export { useSceneEntity, applyEntitySpec, removeEntity } from './hooks/useSceneEntity.js';
export type { SceneEntityFactory } from './hooks/useSceneEntity.js';
export { useSceneBounds } from './hooks/useSceneBounds.js';
export type { UseSceneBoundsOptions, UseSceneBoundsResult } from './hooks/useSceneBounds.js';
export { useSceneReady } from './hooks/useSceneReady.js';
export { useLightDirection } from './hooks/useLightDirection.js';
export type { UseLightDirectionResult } from './hooks/useLightDirection.js';
export { computeSceneBounds } from './geometry/bounds.js';
export { transformPoint, multiply as multiplyMat4, IDENTITY as IDENTITY_MAT4 } from './geometry/mat4.js';
export type { Mat4 } from './geometry/mat4.js';
export { THEME_TOKENS, THEME_DEFAULTS, themeVar, themeStyle, readThemeToken, resolveThemeMode } from './theme.js';
export type { ThemeToken } from './theme.js';

export { Annotations } from './Annotations.js';
export type { AnnotationDefinition, AnnotationsProps } from './Annotations.js';
export { CompassNavigation } from './CompassNavigation.js';
export type { CompassNavigationProps, CompassNavigationPosition } from './CompassNavigation.js';
export { CubeNavigation } from './CubeNavigation.js';
export type { CubeNavigationProps, CubeNavigationPosition } from './CubeNavigation.js';
export {
	Toolbar,
	ToolbarAssetsProvider,
	ToolbarSeparator,
	HomeControl,
	ZoomInControl,
	ZoomOutControl,
	LightControl,
	LightingControl,
	ColorControl,
	TransparencyControl,
	SpecularControl,
	CameraControl,
	MeasureControl,
	PickControl,
	SectionsControl,
	ScreenshotControl,
	FullscreenControl,
	HotspotControl,
	InfoControl
} from './Toolbar.js';
export type {
	ToolbarProps,
	LightControlProps,
	LightingControlProps,
	ColorControlProps,
 	TransparencyControlProps,
 	SpecularControlProps,
	CameraControlProps,
	MeasureControlProps,
	PickControlProps,
	SectionsControlProps,
	ScreenshotControlProps,
	FullscreenControlProps,
	HotspotControlProps,
	InfoControlProps
} from './Toolbar.js';

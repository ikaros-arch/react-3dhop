import { degToRad, radToDeg, multiply, rotationAngleAxis, transformPoint } from './mat4.js';
import type { ParsedCamera, ParsedModel, Vector3, View } from './types.js';

/**
 * 3DHOP's turntable trackball state: `[phi, theta, panX, panY, panZ, distance]`.
 *
 * `phi` (heading) and `theta` (elevation) are degrees; the pan and distance components are in
 * scene-radius units, i.e. already divided by the scene radius.
 */
export type TrackballState = [number, number, number, number, number, number];

/**
 * The scene framing the presenter derives once a scene is loaded. Both values are needed to move
 * between world coordinates and the normalised space the trackball operates in.
 */
export type SceneFraming = {
  sceneCenter: Vector3;
  /** Reciprocal of the scene radius, as the presenter stores it. */
  sceneRadiusInv: number;
};

const Y_AXIS: Vector3 = [0, 1, 0];
const NEGATIVE_X_AXIS: Vector3 = [-1, 0, 0];

/** Below this, a vector's horizontal component carries no reliable heading. */
const DEGENERATE = 1e-9;

/**
 * Converts a world-space camera to a trackball state. The exact inverse of {@link track2view}.
 *
 * Heading is recovered from the view direction, falling back to the up vector only when the camera
 * looks straight up or straight down and the direction has no horizontal component left to read.
 * The fallback is deliberately narrow: a camera parsed out of a manifest has no authored up vector
 * — {@link cameraToView} synthesises world up — so leaning on it for any merely steep view would
 * lose the heading entirely.
 *
 * Both branches use `atan2` rather than `asin`. An `asin` only spans a half-turn and needs a
 * quadrant correction, which is easy to get wrong below the horizon, and it divides by a cosine
 * that vanishes exactly where the input is already ill-conditioned.
 */
export function view2track(view: View, framing: SceneFraming): TrackballState {
  const { sceneCenter, sceneRadiusInv } = framing;

  const panX = (view.target[0] - sceneCenter[0]) * sceneRadiusInv;
  const panY = (view.target[1] - sceneCenter[1]) * sceneRadiusInv;
  const panZ = (view.target[2] - sceneCenter[2]) * sceneRadiusInv;

  const direction: Vector3 = [
    view.target[0] - view.position[0],
    view.target[1] - view.position[1],
    view.target[2] - view.position[2]
  ];
  const length = Math.hypot(direction[0], direction[1], direction[2]);

  if (length === 0) {
    return [0, 0, panX, panY, panZ, 0];
  }

  const unit: Vector3 = [direction[0] / length, direction[1] / length, direction[2] / length];
  const distance = length * sceneRadiusInv;

  const theta = radToDeg(-Math.asin(clamp(unit[1], -1, 1)));

  // `theta` comes from an `asin`, so it is always within [-90, 90] and `cos(theta)` is never
  // negative — the view-direction branch needs no sign correction. The up vector's horizontal part
  // is scaled by `sin(theta)` instead, which is negative below the horizon and would otherwise
  // mirror the heading.
  let phi: number;
  if (Math.hypot(unit[0], unit[2]) > DEGENERATE) {
    phi = radToDeg(Math.atan2(-unit[0], -unit[2]));
  } else if (view.up && Math.hypot(view.up[0], view.up[2]) > DEGENERATE) {
    const sign = theta >= 0 ? 1 : -1;
    phi = radToDeg(Math.atan2(sign * -view.up[0], sign * -view.up[2]));
  } else {
    // Looking straight down the Y axis with no usable up vector: every heading is equivalent.
    phi = 0;
  }

  return [phi, theta, panX, panY, panZ, distance];
}

/** Inverse of {@link view2track}. */
export function track2view(trackState: TrackballState, framing: SceneFraming, fov = 60): View {
  const { sceneCenter, sceneRadiusInv } = framing;
  const [phi, theta, panX, panY, panZ, normalizedDistance] = trackState;

  const target: Vector3 = [
    panX / sceneRadiusInv + sceneCenter[0],
    panY / sceneRadiusInv + sceneCenter[1],
    panZ / sceneRadiusInv + sceneCenter[2]
  ];

  // The camera sits at [0, 0, distance] tilted about -X and then swung about Y, relative to target.
  const orientation = multiply(
    rotationAngleAxis(degToRad(phi), Y_AXIS),
    rotationAngleAxis(degToRad(theta), NEGATIVE_X_AXIS)
  );

  const distance = normalizedDistance / sceneRadiusInv;
  const offset = transformPoint(orientation, [0, 0, distance]);
  const up = transformPoint(orientation, [0, 1, 0]);

  return {
    position: [offset[0] + target[0], offset[1] + target[1], offset[2] + target[2]],
    target,
    up,
    fov
  };
}

/**
 * Builds the world-space view a manifest camera describes.
 *
 * The look-at point is resolved in priority order: an explicit `lookAt` point, then the position of
 * the model the camera's `lookAt` refers to, then the scene centre.
 */
export function cameraToView(camera: ParsedCamera, framing: SceneFraming, models: readonly ParsedModel[] = []): View {
  let target: Vector3 = [...framing.sceneCenter];

  if (camera.target) {
    target = camera.target;
  } else if (camera.lookAtId) {
    const referenced = models.find((model) => model.id === camera.lookAtId);
    if (referenced) {
      target = referenced.position;
    }
  }

  return {
    position: camera.position,
    target,
    up: [0, 1, 0],
    // An orthographic camera has no field of view; 0 is the sentinel 3DHOP's own tooling uses.
    fov: camera.type === 'OrthographicCamera' ? 0 : camera.fov ?? 60
  };
}

export type CameraAnnotationOptions = {
  /** Base for the generated `@id`s. */
  idBase?: string;
  label?: string;
  /** Id of the `Scene` the camera annotation targets. */
  sceneId?: string;
};

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Serialises a view as an IIIF camera annotation, ready to be pasted into a manifest's
 * `AnnotationPage`. The inverse of what {@link cameraToView} consumes.
 */
export function viewToCameraAnnotation(
  view: View,
  { idBase = 'https://example.org/iiif/3d', label, sceneId = 'https://example.org/iiif/scene/1' }: CameraAnnotationOptions = {}
): Record<string, unknown> {
  const timestamp = Date.now();
  const isOrthographic = view.fov === 0;

  return {
    id: `${idBase}/camera_${timestamp}`,
    type: 'Annotation',
    motivation: ['painting'],
    body: [
      {
        id: `${idBase}/cameras/${timestamp}`,
        type: isOrthographic ? 'OrthographicCamera' : 'PerspectiveCamera',
        label: { en: [label ?? `Saved View ${new Date().toLocaleString()}`] },
        lookAt: {
          type: 'PointSelector',
          x: round(view.target[0], 3),
          y: round(view.target[1], 3),
          z: round(view.target[2], 3)
        },
        ...(isOrthographic ? {} : { fieldOfView: round(view.fov, 1) })
      }
    ],
    target: [
      {
        type: 'SpecificResource',
        source: { id: sceneId, type: 'Scene' },
        selector: [
          {
            type: 'PointSelector',
            x: round(view.position[0], 3),
            y: round(view.position[1], 3),
            z: round(view.position[2], 3)
          }
        ]
      }
    ]
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

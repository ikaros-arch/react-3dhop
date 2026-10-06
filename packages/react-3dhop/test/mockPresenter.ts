import { vi } from 'vitest';
import type { PresenterInstance, SceneEntity, SceneEntityType, SceneMeshRuntime, SceneInstanceRuntime } from '../src/viewer/types.js';

export type MockScene = {
  meshes: Record<string, SceneMeshRuntime>;
  modelInstances: Record<string, SceneInstanceRuntime>;
  entities: Record<string, SceneEntity>;
  space?: { transform?: { matrix?: number[] } };
  config: Record<string, unknown>;
};

export type MockPresenter = PresenterInstance & {
  _scene: MockScene;
  /** Test control: simulate every mesh having loaded. */
  __finishLoading: () => void;
  __ready: boolean;
  __measureEnabled: boolean;
  __pickEnabled: boolean;
  __trackball: number[];
  __measurementPoints?: [number[], number[]];
};

/**
 * A presenter double covering the surface the wrapper touches. `setScene` mimics 3DHOP by
 * wiping entities and resetting readiness; `__finishLoading` flips readiness via `_testReady`
 * exactly the way 3DHOP does, so lifecycle wrappers can be exercised.
 */
export function createMockPresenter(scene?: Partial<MockScene>): MockPresenter {
  const presenter = {
    _scene: {
      meshes: {},
      modelInstances: {},
      entities: {},
      config: {},
      ...scene
    },
    __ready: false,
    __measureEnabled: false,
    __pickEnabled: false,
    __trackball: [35, 15, 0, 0, 0, 2.5],
    _lightDirection: [0, 0, -1],
    ui: { postDrawEvent: vi.fn(), gl: {} },

    setScene: vi.fn(function (this: MockPresenter, next: unknown) {
      const incoming = (next ?? {}) as Partial<MockScene>;
      this._scene = {
        meshes: incoming.meshes ?? {},
        modelInstances: incoming.modelInstances ?? {},
        entities: {},
        config: incoming.config ?? {},
        space: incoming.space
      };
      this.__ready = false;
      // Like 3DHOP: a new scene clears the measurement / pick-point modes.
      this.__measureEnabled = false;
      this.__pickEnabled = false;
    }),
    _testReady: vi.fn(function (this: MockPresenter) {
      this.__ready = true;
    }),
    _isSceneReady: vi.fn(function (this: MockPresenter) {
      return this.__ready;
    }),
    __finishLoading(this: MockPresenter) {
      this._testReady?.();
    },

    createEntity: vi.fn(function (this: MockPresenter, name: string, type: SceneEntityType, vertices: number[][]) {
      const entity: SceneEntity = {
        visible: true,
        type,
        color: [1, 0, 1, 1],
        useTransparency: false,
        pointSize: 6,
        zOff: 0,
        transform: { matrix: [] },
        renderable: { vertexCount: vertices.length }
      };
      this._scene.entities[name] = entity;
      return entity;
    }),
    deleteEntity: vi.fn(function (this: MockPresenter, name: string) {
      delete this._scene.entities[name];
    }),
    clearEntities: vi.fn(function (this: MockPresenter) {
      this._scene.entities = {};
    }),
    repaint: vi.fn(),

    resetTrackball: vi.fn(function (this: MockPresenter) {
      this._lightDirection = [0, 0, -1];
    }),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    getTrackballPosition: vi.fn(function (this: MockPresenter) {
      return [...this.__trackball];
    }),
    setTrackballPosition: vi.fn(function (this: MockPresenter, state: number[]) {
      this.__trackball = [...state];
    }),

    enableLightTrackball: vi.fn(),
    isLightTrackballEnabled: vi.fn(() => false),
    rotateLight: vi.fn(function (this: MockPresenter, x: number, y: number) {
      const r = Math.hypot(2 * x, 2 * y);
      const z = Math.sqrt(Math.max(0, 1 - r * r));
      this._lightDirection = [-2 * x, -2 * y, -z];
    }),

    enableMeasurementTool: vi.fn(function (this: MockPresenter, on: boolean) {
      this.__measureEnabled = on;
    }),
    isMeasurementToolEnabled: vi.fn(function (this: MockPresenter) {
      return this.__measureEnabled;
    }),
    restoreMeasurement: vi.fn(function (this: MockPresenter, pointA, pointB) {
      this.__measureEnabled = true;
      this.__measurementPoints = [pointA, pointB];
    }),
    enablePickpointMode: vi.fn(function (this: MockPresenter, on: boolean) {
      this.__pickEnabled = on;
    }),
    isPickpointModeEnabled: vi.fn(function (this: MockPresenter) {
      return this.__pickEnabled;
    }),
    isAnyMeasurementEnabled: vi.fn(function (this: MockPresenter) {
      return this.__measureEnabled || this.__pickEnabled;
    })
  } as unknown as MockPresenter;

  return presenter;
}

/** A Nexus-like mesh whose base vertices are the given points. */
export function nexusMesh(points: number[][], matrix?: number[]): SceneMeshRuntime {
  return {
    mType: 'nexus',
    transform: matrix ? { matrix } : undefined,
    renderable: {
      isReady: true,
      mesh: { basev: new Float32Array(points.flat()) }
    }
  };
}

/** A Nexus-like mesh that has only reported its bounding sphere so far. */
export function sphereOnlyMesh(center: number[], radius: number): SceneMeshRuntime {
  return {
    mType: 'nexus',
    renderable: { isReady: true, datasetCenter: center, datasetRadius: radius, mesh: {} }
  };
}

/** A PLY-like mesh with a precomputed bounding box. */
export function plyMesh(min: number[], max: number[]): SceneMeshRuntime {
  return {
    mType: 'ply',
    renderable: { isReady: true, boundingBox: { min, max } }
  };
}

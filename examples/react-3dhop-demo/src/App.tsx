import { useCallback, useEffect, useState } from 'react'
import {
  ThreeDHopViewer,
  Toolbar,
  HomeControl,
  ZoomInControl,
  ZoomOutControl,
  LightingControl,
  LightControl,
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
  InfoControl,
  CompassNavigation,
  CubeNavigation,
  useThreeDHopViewer,
  type AnnotationDefinition,
  type AnnotationPickEvent,
  type AnnotationPickHandler
} from '@ikaros-arch/react-3dhop'
import { IIIFDemo } from './IIIFDemo'
import './App.css'

const demoAnnotations: AnnotationDefinition[] = [
  {
    id: 'spot-1',
    label: 'Statue Base',
    comment: 'Lower plinth detail',
    position: [-113.6, 11.54, -48.16],
    radius: 5.4,
    color: [1, 0.3, 0.3]
  },
  {
    id: 'spot-2',
    label: 'Shoulder',
    comment: 'Surface abrasion',
    position: [-52.06, 180.34, -5.91],
    radius: 2.35,
    color: [0.2, 0.7, 1]
  }
]

function AnnotationEventBridge({ onPick }: { onPick: AnnotationPickHandler }) {
  const { registerAnnotationHandler } = useThreeDHopViewer()

  useEffect(() => {
    return registerAnnotationHandler(onPick)
  }, [onPick, registerAnnotationHandler])

  return null
}

/**
 * Which demo to show. Kept in the query string rather than behind a router, since two views do not
 * justify the dependency. `?manifest=` implies the IIIF view.
 */
function useDemoRoute(): 'core' | 'iiif' {
  if (typeof window === 'undefined') {
    return 'core'
  }
  const params = new URLSearchParams(window.location.search)
  return params.get('view') === 'iiif' || params.has('manifest') ? 'iiif' : 'core'
}

function DemoNav({ active }: { active: 'core' | 'iiif' }) {
  return (
    <nav className="demo-nav">
      <a href="?" aria-current={active === 'core' ? 'page' : undefined}>
        Core viewer
      </a>
      <a href="?view=iiif" aria-current={active === 'iiif' ? 'page' : undefined}>
        IIIF viewer
      </a>
    </nav>
  )
}

function App() {
  const route = useDemoRoute()
  const [picked, setPicked] = useState<AnnotationPickEvent | null>(null)
  const handleAnnotationPick = useCallback<AnnotationPickHandler>((event) => {
    setPicked(event)
  }, [])

  if (route === 'iiif') {
    return (
      <>
        <DemoNav active="iiif" />
        <IIIFDemo />
      </>
    )
  }

  return (
    <div className="viewer-wrapper">
      <DemoNav active="core" />
      <h1>react-3dhop Demo</h1>
      <p className="description">
        Minimal integration of the 3DHOP viewer in a React + Vite environment. The scene renders two
        instances of the same mesh to showcase per-model configuration such as transforms, colors,
        transparency and annotations.
      </p>
      {picked ? (
        <div className="annotation-output">
          Last annotation: {picked.annotation.label ?? picked.id}
        </div>
      ) : null}
      <div className="viewer-container">
        <ThreeDHopViewer
          assetBaseUrl="/3dhop"
          models={{
            primary: {
              url: '/models/C42183_sID-576_mID-913.nxz',
              annotations: demoAnnotations
            },
            ghost: {
              url: '/models/C42183_sID-576_mID-913.nxz',
              transform: {
                translation: [0, 0, -85]
              },
              scale: 0.94,
              tags: ['ghost'],
              useSolidColor: true,
              color: [0.6, 0.75, 1],
              transparency: { enabled: true, alpha: 0.28 }
            }
          }}
          width={1000}
          height={800}
          backgroundUrl="skins/backgrounds/cyan_gradient.jpg"
          coordinateCorrections={{ x: 10000, y: 440000, z: 0 }}
        >
          <Toolbar position="top-left">
            <HomeControl
              title="Heim"
              icon='skins/dark/home.png'
            />
            <ZoomInControl
              title="Zoom Inn"
              icon='skins/dark/zoomin.png'
            />
            <ZoomOutControl
              title="Zoom Ut"
              icon='skins/dark/zoomout.png'
            />
            <LightingControl
              title={{ enabled: 'Skru av lyssimulering', disabled: 'Skru på lyssimulering' }}
            />
            <LightControl
              title={{ enabled: 'Slå av lysstyring', disabled: 'Styr lysvinkel' }}
              icon={{ enabled: 'skins/dark/lightcontrol_on.png', disabled: 'skins/dark/lightcontrol.png' }}
            />
            <ColorControl
              title={{ enabled: 'Vis tekstur', disabled: 'Vis ensfarget' }}
            />
            <TransparencyControl
              title={{ enabled: 'Skru av transparens', disabled: 'Skru på transparens' }}
            />
            <SpecularControl
              title={{ enabled: 'Skru av speilglans', disabled: 'Skru på speilglans' }}
            />
            <CameraControl
              title={{ enabled: 'Perspektivkamera', disabled: 'Ortograft kamera' }}
            />
            <MeasureControl
              title={{ enabled: 'Fjern måleverktøy', disabled: 'Aktiver måleverktøy' }}
              label="Målt lengde"
              units='meter'
            />
            <PickControl
              title={{ enabled: 'Skru av punktvalg', disabled: 'Velg punkt' }}
              label="XYZ punkt"
            />
            <InfoControl
              label="Modellinfo"
              content={(
                <>
                  <span>Objekt: C42183_sID-576_mID-913</span>
                  <span>Skannet av: Kulturhistorisk Museum</span>
                </>
              )}
            />
            <HotspotControl />
            <SectionsControl
              title={{ enabled: 'Skru av snitt', disabled: 'Skru på snitt' }}
              planeLabels={{ x: 'X-akse', y: 'Y-akse', z: 'Z-akse' }}
              showPlanesLabel="Vis plan"
              showEdgesLabel="Vis kant"
            />
            <ScreenshotControl title="Lagre skjermbilde" />
            <FullscreenControl
              title={{ enabled: 'Avslutt Fullskjerm', disabled: 'Gå til Fullskjerm' }}
              icon={{ enabled: 'skins/dark/full_on.png', disabled: 'skins/dark/full.png' }}
            />
          </Toolbar>
          <AnnotationEventBridge onPick={handleAnnotationPick} />
          <CompassNavigation position="bottom-right" />
          <CubeNavigation position="top-right" />
        </ThreeDHopViewer>
      </div>
    </div>
  )
}

export default App

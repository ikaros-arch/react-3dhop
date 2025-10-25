import {
  ThreeDHopViewer,
  Toolbar,
  HomeControl,
  ZoomInControl,
  ZoomOutControl,
  LightingControl,
  LightControl,
  ColorControl,
  CameraControl,
  MeasureControl,
  PickControl,
  SectionsControl,
  ScreenshotControl,
  FullscreenControl
} from 'react-3dhop'
import './App.css'

function App() {
  return (
    <div className="viewer-wrapper">
      <h1>react-3dhop Demo</h1>
      <p className="description">
        Minimal integration of the 3DHOP viewer in a React + Vite environment. Use the toolbar inside the
        viewer to interact with the sample model.
      </p>
      <div className="viewer-container">
        <ThreeDHopViewer
          modelUrl="/models/C42183_sID-576_mID-913.nxz"
          width={1000}
          height={800}
          backgroundUrl="skins/backgrounds/cyan_gradient.jpg"
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
            <CameraControl
              title={{ enabled: 'Perspektivkamera', disabled: 'Ortograft kamera' }}
            />
            <MeasureControl
              title={{ enabled: 'Fjern måleverktøy', disabled: 'Aktiver måleverktøy' }}
              label="Målt lengde"
            />
            <PickControl
              title={{ enabled: 'Skru av punktvalg', disabled: 'Velg punkt' }}
              label="XYZ punkt"
            />
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
        </ThreeDHopViewer>
      </div>
    </div>
  )
}

export default App

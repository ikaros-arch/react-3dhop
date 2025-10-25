import {
  ThreeDHopViewer,
  Toolbar,
  HomeControl,
  ZoomInControl,
  ZoomOutControl,
  LightControl,
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
          width={640}
          height={480}
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
            <LightControl
              title={{ enabled: 'Slå av lysstyring', disabled: 'Styr lysvinkel' }}
              icon={{ enabled: 'skins/dark/lightcontrol_on.png', disabled: 'skins/dark/lightcontrol.png' }}
            />
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

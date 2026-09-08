import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Toolbar,
  HomeControl,
  ZoomInControl,
  ZoomOutControl,
  LightingControl,
  ColorControl,
  MeasureControl,
  PickControl,
  SectionsControl,
  ScreenshotControl,
  FullscreenControl,
  CompassNavigation
} from 'react-3dhop'
import {
  IIIFViewer,
  IIIFSummary,
  IIIFMetadataPanel,
  IIIFModelsPanel,
  IIIFSavedViewsPanel,
  IIIFLanguageSwitcher,
  useIIIFManifest
} from 'react-3dhop-iiif'
import './IIIFDemo.css'

const MANIFESTS = [
  { url: '/manifests/local.json', label: 'Local demo object (no network needed)' },
  { url: '/manifests/astronaut.json', label: 'Astronaut — single model' },
  { url: '/manifests/advanced.json', label: 'Advanced — multi-model with transforms' },
  { url: '/manifests/broken.json', label: 'Deliberately malformed manifest' }
]

/**
 * The local manifest is the default because it is the only one whose mesh ships with this demo;
 * the IIIF 3D examples stream theirs from a remote host.
 */
const DEFAULT_MANIFEST = MANIFESTS[0].url

function manifestFromQuery(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_MANIFEST
  }
  return new URLSearchParams(window.location.search).get('manifest') || DEFAULT_MANIFEST
}

/** Surfaces the non-fatal notes the parser emitted, which are otherwise easy to miss. */
function Diagnostics() {
  const { diagnostics } = useIIIFManifest()

  if (diagnostics.length === 0) {
    return null
  }

  return (
    <section className="iiif-diagnostics">
      <h2>Parser notes</h2>
      <ul>
        {diagnostics.map((diagnostic, index) => (
          <li key={index} className={`iiif-diagnostics__${diagnostic.level}`}>
            {diagnostic.message}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The panels have to sit inside `<IIIFViewer>` to reach its context, but the viewer renders its
 * children into a fixed-size, clipped box meant for canvas overlays. A portal keeps them in the
 * React tree while putting them in the page layout, where they can scroll.
 */
function Sidebar({ host }: { host: HTMLElement | null }) {
  if (!host) {
    return null
  }

  return createPortal(
    <>
      <IIIFLanguageSwitcher />
      <IIIFSummary />
      <IIIFModelsPanel />
      <IIIFSavedViewsPanel />
      <IIIFMetadataPanel />
      <Diagnostics />
    </>,
    host
  )
}

export function IIIFDemo() {
  const [manifest, setManifest] = useState(manifestFromQuery)
  const [sidebarHost, setSidebarHost] = useState<HTMLElement | null>(null)

  const selectManifest = useCallback((url: string) => {
    setManifest(url)
    // Keep the address bar shareable without pulling in a router.
    const next = new URL(window.location.href)
    next.searchParams.set('manifest', url)
    window.history.replaceState(null, '', next)
  }, [])

  const renderError = useCallback(
    (error: Error) => (
      <div className="iiif-error">
        <h2>Could not load this manifest</h2>
        <p>{error.message}</p>
      </div>
    ),
    []
  )

  const isKnown = MANIFESTS.some((entry) => entry.url === manifest)

  return (
    <div className="viewer-wrapper">
      <h1>react-3dhop-iiif Demo</h1>
      <p className="description">
        Renders a IIIF Presentation 4.0 / IIIF 3D manifest with 3DHOP. Pick a manifest below, or
        point the <code>?manifest=</code> query parameter at any manifest URL.
      </p>

      <div className="iiif-picker">
        <label htmlFor="manifest-select">Manifest</label>
        <select
          id="manifest-select"
          value={isKnown ? manifest : ''}
          onChange={(event) => selectManifest(event.target.value)}
        >
          {isKnown ? null : <option value="">{manifest}</option>}
          {MANIFESTS.map((entry) => (
            <option key={entry.url} value={entry.url}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>

      <div className="iiif-layout">
        <div className="viewer-container">
          <IIIFViewer
            // Remounting on manifest change avoids carrying one scene's camera into the next.
            key={manifest}
            manifest={manifest}
            assetBaseUrl="/3dhop"
            width={760}
            height={620}
            backgroundUrl="skins/backgrounds/cyan_gradient.jpg"
            loadingFallback={<div className="iiif-loading">Loading manifest…</div>}
            errorFallback={renderError}
          >
            <Toolbar position="top-left">
              <HomeControl title="Home" icon="skins/dark/home.png" />
              <ZoomInControl title="Zoom in" icon="skins/dark/zoomin.png" />
              <ZoomOutControl title="Zoom out" icon="skins/dark/zoomout.png" />
              <LightingControl title={{ enabled: 'Disable lighting', disabled: 'Enable lighting' }} />
              <ColorControl title={{ enabled: 'Show texture', disabled: 'Show solid colour' }} />
              <MeasureControl
                title={{ enabled: 'Clear measurement', disabled: 'Measure' }}
                label="Measured length"
              />
              <PickControl title={{ enabled: 'Stop picking', disabled: 'Pick a point' }} label="XYZ point" />
              <SectionsControl title={{ enabled: 'Hide sections', disabled: 'Show sections' }} />
              <ScreenshotControl title="Save screenshot" />
              <FullscreenControl
                title={{ enabled: 'Leave fullscreen', disabled: 'Go fullscreen' }}
                icon={{ enabled: 'skins/dark/full_on.png', disabled: 'skins/dark/full.png' }}
              />
            </Toolbar>
            <CompassNavigation position="bottom-right" />
            <Sidebar host={sidebarHost} />
          </IIIFViewer>
        </div>

        <aside className="iiif-sidebar" ref={setSidebarHost} />
      </div>
    </div>
  )
}

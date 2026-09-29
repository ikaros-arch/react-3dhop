import React, { useState } from 'react';
import { useIIIFManifest } from '../context.js';

export type IIIFSavedViewsPanelProps = {
  heading?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  /** Hides the "save current view" control, leaving only the manifest's own cameras. */
  hideSaveControl?: boolean;
  saveLabel?: string;
  /**
   * Called with the IIIF camera annotation for the current view. When omitted, the annotation is
   * shown in the panel so it can be copied into a manifest.
   */
  onSaveView?: (annotation: Record<string, unknown>) => void;
  className?: string;
  headingClassName?: string;
  listClassName?: string;
  buttonClassName?: string;
};

/** Buttons for the manifest's camera annotations, plus a way to capture the current view. */
export const IIIFSavedViewsPanel: React.FC<IIIFSavedViewsPanelProps> = ({
  heading = 'Saved views',
  emptyMessage = 'No saved views in manifest',
  hideSaveControl = false,
  saveLabel = 'Save current view',
  onSaveView,
  className = 'iiif-views',
  headingClassName = 'iiif-views__heading',
  listClassName = 'iiif-views__list',
  buttonClassName = 'iiif-views__button'
}) => {
  const { cameras, localize, goToCamera, saveCurrentView, isSceneReady } = useIIIFManifest();
  const [captured, setCaptured] = useState<string | null>(null);

  const handleSave = () => {
    const annotation = saveCurrentView();
    if (!annotation) {
      return;
    }
    if (onSaveView) {
      onSaveView(annotation);
      return;
    }
    setCaptured(JSON.stringify(annotation, null, 2));
  };

  return (
    <section className={className}>
      {heading ? <h2 className={headingClassName}>{heading}</h2> : null}

      {cameras.length === 0 ? (
        <p className="iiif-views__empty">{emptyMessage}</p>
      ) : (
        <ul className={listClassName}>
          {cameras.map((camera, index) => (
            <li key={camera.id ?? index}>
              <button
                type="button"
                className={buttonClassName}
                onClick={() => goToCamera(index)}
                disabled={!isSceneReady}
              >
                {localize(camera.rawLabel) || `View ${index + 1}`}
              </button>
            </li>
          ))}
        </ul>
      )}

      {hideSaveControl ? null : (
        <button
          type="button"
          className="iiif-views__save"
          onClick={handleSave}
          disabled={!isSceneReady}
        >
          {saveLabel}
        </button>
      )}

      {captured ? (
        <pre className="iiif-views__output">
          <code>{captured}</code>
        </pre>
      ) : null}
    </section>
  );
};

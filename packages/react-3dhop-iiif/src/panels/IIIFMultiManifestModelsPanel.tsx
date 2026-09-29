import React from 'react';
import { useIIIFMultiManifest } from '../multiManifestContext.js';
import type { ParsedModel } from '../iiif/types.js';

/** Falls back to the source filename when an annotation carries no label. */
function fallbackName(model: ParsedModel, index: number): string {
  const filename = model.url.split('/').pop() ?? '';
  const stem = filename.split('?')[0].split('#')[0].split('.')[0];
  return stem || `Model ${index + 1}`;
}

export type IIIFMultiManifestModelsPanelProps = {
  heading?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  visibilityLabel?: string;
  transparencyLabel?: string;
  className?: string;
  headingClassName?: string;
  groupClassName?: string;
  groupHeadingClassName?: string;
  listClassName?: string;
  itemClassName?: string;
};

/** Per-model visibility and transparency toggles, grouped under a heading per source manifest. */
export const IIIFMultiManifestModelsPanel: React.FC<IIIFMultiManifestModelsPanelProps> = ({
  heading = 'Models',
  emptyMessage = 'No manifests selected',
  visibilityLabel = 'Show model',
  transparencyLabel = 'Toggle transparency',
  className = 'iiif-multi-models',
  headingClassName = 'iiif-multi-models__heading',
  groupClassName = 'iiif-multi-models__group',
  groupHeadingClassName = 'iiif-multi-models__group-heading',
  listClassName = 'iiif-multi-models__list',
  itemClassName = 'iiif-multi-models__item'
}) => {
  const { manifests, isModelVisible, setModelVisible, isModelTransparent, toggleModelTransparency } =
    useIIIFMultiManifest();

  return (
    <section className={className}>
      {heading ? <h2 className={headingClassName}>{heading}</h2> : null}
      {manifests.length === 0 ? (
        <p className="iiif-multi-models__empty">{emptyMessage}</p>
      ) : (
        manifests.map((manifest) => (
          <div key={manifest.key} className={groupClassName}>
            <h3 className={groupHeadingClassName}>{manifest.label}</h3>
            <ul className={listClassName}>
              {manifest.models.map((model, index) => {
                const name = model.rawLabel && typeof model.rawLabel === 'string' ? model.rawLabel : fallbackName(model, index);
                const visible = isModelVisible(manifest.key, model.id);
                const transparent = isModelTransparent(manifest.key, model.id);

                return (
                  <li key={model.id} className={itemClassName}>
                    <label className="iiif-multi-models__visibility">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={(event) => setModelVisible(manifest.key, model.id, event.target.checked)}
                        aria-label={`${visibilityLabel}: ${name}`}
                      />
                      <span className="iiif-multi-models__name">{name}</span>
                    </label>
                    <label className="iiif-multi-models__transparency">
                      <input
                        type="checkbox"
                        checked={transparent}
                        onChange={() => toggleModelTransparency(manifest.key, model.id)}
                        aria-label={`${transparencyLabel}: ${name}`}
                      />
                      <span className="iiif-multi-models__transparency-text">{transparencyLabel}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
};

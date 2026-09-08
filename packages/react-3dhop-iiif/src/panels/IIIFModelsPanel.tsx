import React from 'react';
import { useIIIFManifest } from '../context.js';
import type { ParsedModel } from '../iiif/types.js';

/** Falls back to the source filename when an annotation carries no label. */
function fallbackName(model: ParsedModel, index: number): string {
  const filename = model.url.split('/').pop() ?? '';
  const stem = filename.split('?')[0].split('#')[0].split('.')[0];
  return stem || `Model ${index + 1}`;
}

export type IIIFModelsPanelProps = {
  heading?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  visibilityLabel?: string;
  transparencyLabel?: string;
  className?: string;
  headingClassName?: string;
  listClassName?: string;
  itemClassName?: string;
};

/** Per-model visibility and transparency toggles, one row per model annotation. */
export const IIIFModelsPanel: React.FC<IIIFModelsPanelProps> = ({
  heading = 'Models',
  emptyMessage = 'No models in manifest',
  visibilityLabel = 'Show model',
  transparencyLabel = 'Toggle transparency',
  className = 'iiif-models',
  headingClassName = 'iiif-models__heading',
  listClassName = 'iiif-models__list',
  itemClassName = 'iiif-models__item'
}) => {
  const { models, localize, isModelVisible, setModelVisible, isModelTransparent, toggleModelTransparency } =
    useIIIFManifest();

  return (
    <section className={className}>
      {heading ? <h2 className={headingClassName}>{heading}</h2> : null}
      {models.length === 0 ? (
        <p className="iiif-models__empty">{emptyMessage}</p>
      ) : (
        <ul className={listClassName}>
          {models.map((model, index) => {
            const name = localize(model.rawLabel) || fallbackName(model, index);
            const visible = isModelVisible(model.id);
            const transparent = isModelTransparent(model.id);

            return (
              <li key={model.id} className={itemClassName}>
                <label className="iiif-models__visibility">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={(event) => setModelVisible(model.id, event.target.checked)}
                    aria-label={`${visibilityLabel}: ${name}`}
                  />
                  <span className="iiif-models__name">{name}</span>
                </label>
                <label className="iiif-models__transparency">
                  <input
                    type="checkbox"
                    checked={transparent}
                    onChange={() => toggleModelTransparency(model.id)}
                    aria-label={`${transparencyLabel}: ${name}`}
                  />
                  <span className="iiif-models__transparency-text">{transparencyLabel}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

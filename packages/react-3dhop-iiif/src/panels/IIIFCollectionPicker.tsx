import React from 'react';
import { useIIIFCollection } from '../collectionContext.js';

export type IIIFCollectionPickerProps = {
  label?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  className?: string;
  labelClassName?: string;
  selectClassName?: string;
};

/** A `<select>` of every manifest in the collection. Pass the selected id straight to `<IIIFViewer>`. */
export const IIIFCollectionPicker: React.FC<IIIFCollectionPickerProps> = ({
  label = 'Object',
  emptyMessage = 'No objects in this collection.',
  className = 'iiif-collection-picker',
  labelClassName = 'iiif-collection-picker__label',
  selectClassName = 'iiif-collection-picker__select'
}) => {
  const { items, selectedId, selectManifest, status } = useIIIFCollection();

  if (status === 'ready' && items.length === 0) {
    return <p className={`${className}__empty`}>{emptyMessage}</p>;
  }

  return (
    <div className={className}>
      {label ? (
        <label className={labelClassName} htmlFor="iiif-collection-select">
          {label}
        </label>
      ) : null}
      <select
        id="iiif-collection-select"
        className={selectClassName}
        value={selectedId ?? ''}
        onChange={(event) => selectManifest(event.target.value)}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
};

import React from 'react';
import { useIIIFCollection } from '../collectionContext.js';

export type IIIFCollectionCarouselProps = {
  previousLabel?: string;
  nextLabel?: string;
  emptyMessage?: React.ReactNode;
  className?: string;
  trackClassName?: string;
  itemClassName?: string;
  activeItemClassName?: string;
  thumbnailClassName?: string;
  labelClassName?: string;
  controlClassName?: string;
};

/** A scrollable strip of thumbnails, one per manifest in the collection, with prev/next controls. */
export const IIIFCollectionCarousel: React.FC<IIIFCollectionCarouselProps> = ({
  previousLabel = 'Previous object',
  nextLabel = 'Next object',
  emptyMessage = 'No objects in this collection.',
  className = 'iiif-carousel',
  trackClassName = 'iiif-carousel__track',
  itemClassName = 'iiif-carousel__item',
  activeItemClassName = 'iiif-carousel__item--active',
  thumbnailClassName = 'iiif-carousel__thumbnail',
  labelClassName = 'iiif-carousel__label',
  controlClassName = 'iiif-carousel__control'
}) => {
  const { items, selectedId, selectManifest, next, previous, status } = useIIIFCollection();

  if (status === 'ready' && items.length === 0) {
    return <p className={`${className}__empty`}>{emptyMessage}</p>;
  }

  return (
    <div className={className}>
      <button
        type="button"
        className={controlClassName}
        onClick={previous}
        disabled={items.length < 2}
        aria-label={previousLabel}
      >
        ‹
      </button>
      <ul className={trackClassName}>
        {items.map((item) => {
          const active = item.id === selectedId;
          return (
            <li key={item.id} className={active ? `${itemClassName} ${activeItemClassName}` : itemClassName}>
              <button type="button" onClick={() => selectManifest(item.id)} aria-current={active || undefined}>
                {item.thumbnail ? (
                  <img className={thumbnailClassName} src={item.thumbnail} alt="" loading="lazy" />
                ) : (
                  <span className={thumbnailClassName} aria-hidden="true" />
                )}
                <span className={labelClassName}>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className={controlClassName}
        onClick={next}
        disabled={items.length < 2}
        aria-label={nextLabel}
      >
        ›
      </button>
    </div>
  );
};

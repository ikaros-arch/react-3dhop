import React from 'react';
import { useIIIFManifest } from '../context.js';

export type IIIFSummaryProps = {
  className?: string;
  summaryClassName?: string;
  attributionClassName?: string;
};

/**
 * The manifest's `summary` and the attribution from its `requiredStatement`.
 *
 * Renders nothing when the manifest supplies neither.
 */
export const IIIFSummary: React.FC<IIIFSummaryProps> = ({
  className = 'iiif-summary',
  summaryClassName = 'iiif-summary__text',
  attributionClassName = 'iiif-summary__attribution'
}) => {
  const { metadata } = useIIIFManifest();

  const summary = metadata?.summary;
  const attribution = metadata?.attribution;

  if (!summary && !attribution) {
    return null;
  }

  return (
    <div className={className}>
      {summary ? <p className={summaryClassName}>{summary}</p> : null}
      {attribution ? (
        <p className={attributionClassName}>
          <small>{attribution}</small>
        </p>
      ) : null}
    </div>
  );
};

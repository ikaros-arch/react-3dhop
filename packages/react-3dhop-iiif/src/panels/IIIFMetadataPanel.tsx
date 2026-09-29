import React, { useMemo } from 'react';
import { useIIIFManifest } from '../context.js';
import type { ParsedMetadata } from '../iiif/types.js';

/**
 * Fields shown first, in this order, when the manifest provides them. Anything else the manifest
 * carries follows underneath, in manifest order.
 */
const PRIORITY_FIELDS: Array<{ key: keyof ParsedMetadata; label: string }> = [
  { key: 'label', label: 'Title' },
  { key: 'museum', label: 'Museum' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'objectId', label: 'Object ID' },
  { key: 'measureUnit', label: 'Measure unit' },
  { key: 'displayUnit', label: 'Display unit' },
  { key: 'summary', label: 'Description' },
  { key: 'attribution', label: 'Attribution' }
];

export type IIIFMetadataPanelProps = {
  heading?: React.ReactNode;
  /** Shown when the manifest carries no metadata at all. */
  emptyMessage?: React.ReactNode;
  /** Hides the metadata entries that are already shown as priority fields. */
  hideDuplicateFields?: boolean;
  className?: string;
  headingClassName?: string;
  tableClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
};

/** The manifest's descriptive metadata as a definition table. */
export const IIIFMetadataPanel: React.FC<IIIFMetadataPanelProps> = ({
  heading = 'Metadata',
  emptyMessage = 'No metadata available',
  hideDuplicateFields = true,
  className = 'iiif-metadata',
  headingClassName = 'iiif-metadata__heading',
  tableClassName = 'iiif-metadata__table',
  labelClassName = 'iiif-metadata__label',
  valueClassName = 'iiif-metadata__value'
}) => {
  const { metadata } = useIIIFManifest();

  const rows = useMemo(() => {
    if (!metadata) {
      return [];
    }

    const entries: Array<{ label: string; value: string }> = [];
    const shown = new Set<string>();

    PRIORITY_FIELDS.forEach(({ key, label }) => {
      const value = metadata[key];
      if (typeof value === 'string' && value.length > 0) {
        entries.push({ label, value });
        shown.add(value);
      }
    });

    metadata.fields.forEach((field) => {
      if (!field.value) {
        return;
      }
      if (hideDuplicateFields && shown.has(field.value)) {
        return;
      }
      entries.push(field);
    });

    return entries;
  }, [hideDuplicateFields, metadata]);

  return (
    <section className={className}>
      {heading ? <h2 className={headingClassName}>{heading}</h2> : null}
      {rows.length === 0 ? (
        <p className="iiif-metadata__empty">{emptyMessage}</p>
      ) : (
        <table className={tableClassName}>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.label}-${index}`}>
                <th scope="row" className={labelClassName}>
                  {row.label}
                </th>
                <td className={valueClassName}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

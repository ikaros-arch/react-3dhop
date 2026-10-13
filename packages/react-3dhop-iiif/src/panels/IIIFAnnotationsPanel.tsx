import React, { useState } from 'react';
import { useIIIFManifest } from '../context.js';

export type IIIFAnnotationsPanelProps = {
  heading?: React.ReactNode;
  emptyMessage?: React.ReactNode;
  addLabel?: string;
  removeLabel?: string;
  className?: string;
  headingClassName?: string;
  listClassName?: string;
  itemClassName?: string;
  formClassName?: string;
};

/**
 * Lists the manifest's comment annotations, with a minimal form for adding new ones.
 *
 * Position is entered by hand here: this package has no notion of a "picked point" (that lives in
 * `@ikaros-arch/react-3dhop`'s pick tool). An app that wants comments placed by clicking the model
 * should build its own form on `addComment`/`updateComment`/`removeComment` instead of this panel,
 * same as `IIIFModelsPanel` is skippable in favour of custom UI built on the same hook.
 */
export const IIIFAnnotationsPanel: React.FC<IIIFAnnotationsPanelProps> = ({
  heading = 'Annotations',
  emptyMessage = 'No annotations yet',
  addLabel = 'Add annotation',
  removeLabel = 'Remove',
  className = 'iiif-annotations',
  headingClassName = 'iiif-annotations__heading',
  listClassName = 'iiif-annotations__list',
  itemClassName = 'iiif-annotations__item',
  formClassName = 'iiif-annotations__form'
}) => {
  const { comments, localize, addComment, removeComment } = useIIIFManifest();
  const [text, setText] = useState('');
  const [position, setPosition] = useState({ x: '0', y: '0', z: '0' });

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    addComment({
      text: trimmed,
      position: [Number(position.x) || 0, Number(position.y) || 0, Number(position.z) || 0]
    });
    setText('');
  };

  return (
    <section className={className}>
      {heading ? <h2 className={headingClassName}>{heading}</h2> : null}

      {comments.length === 0 ? (
        <p className="iiif-annotations__empty">{emptyMessage}</p>
      ) : (
        <ul className={listClassName}>
          {comments.map((comment) => {
            const label = localize(comment.rawLabel);
            return (
              <li key={comment.id} className={itemClassName}>
                {label ? <strong className="iiif-annotations__label">{label}</strong> : null}
                <p className="iiif-annotations__text">{comment.text}</p>
                <button type="button" className="iiif-annotations__remove" onClick={() => removeComment(comment.id)}>
                  {removeLabel}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form className={formClassName} onSubmit={handleAdd}>
        <label className="iiif-annotations__field">
          Text
          <textarea value={text} onChange={(event) => setText(event.target.value)} required />
        </label>
        <fieldset className="iiif-annotations__position">
          <legend>Position</legend>
          {(['x', 'y', 'z'] as const).map((axis) => (
            <label key={axis} className="iiif-annotations__axis">
              {axis.toUpperCase()}
              <input
                type="number"
                step="any"
                value={position[axis]}
                onChange={(event) => setPosition((current) => ({ ...current, [axis]: event.target.value }))}
              />
            </label>
          ))}
        </fieldset>
        <button type="submit" className="iiif-annotations__add">
          {addLabel}
        </button>
      </form>
    </section>
  );
};

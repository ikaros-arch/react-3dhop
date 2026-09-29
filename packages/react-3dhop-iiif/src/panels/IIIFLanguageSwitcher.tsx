import React from 'react';
import { useIIIFManifest } from '../context.js';

/** Endonyms for the languages this collection publishes in; anything else falls back to the tag. */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  no: 'Norsk',
  nn: 'Nynorsk',
  nb: 'Bokmål',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  se: 'Davvisámegiella'
};

export type IIIFLanguageSwitcherProps = {
  label?: React.ReactNode;
  /** Merged over {@link LANGUAGE_NAMES} to name additional languages. */
  languageNames?: Record<string, string>;
  /** Renders the switcher even when the manifest offers only one language. */
  alwaysShow?: boolean;
  className?: string;
  labelClassName?: string;
  selectClassName?: string;
};

/**
 * Switches the language used for labels and metadata.
 *
 * Hidden when the manifest has one language or fewer, since there is nothing to choose between.
 */
export const IIIFLanguageSwitcher: React.FC<IIIFLanguageSwitcherProps> = ({
  label = 'Language',
  languageNames,
  alwaysShow = false,
  className = 'iiif-language',
  labelClassName = 'iiif-language__label',
  selectClassName = 'iiif-language__select'
}) => {
  const { languages, language, setLanguage } = useIIIFManifest();

  if (!alwaysShow && languages.length <= 1) {
    return null;
  }

  const names = languageNames ? { ...LANGUAGE_NAMES, ...languageNames } : LANGUAGE_NAMES;

  // The active language may not be one the manifest advertises, e.g. when it came from the browser
  // and the manifest fell back. Showing it keeps the control from silently misreporting.
  const options = languages.includes(language) ? languages : [language, ...languages];

  return (
    <div className={className}>
      {label ? (
        <label className={labelClassName} htmlFor="iiif-language-select">
          {label}
        </label>
      ) : null}
      <select
        id="iiif-language-select"
        className={selectClassName}
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
      >
        {options.map((tag) => (
          <option key={tag} value={tag}>
            {names[tag] ?? tag.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
};

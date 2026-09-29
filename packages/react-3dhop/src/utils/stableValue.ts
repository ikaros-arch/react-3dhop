import { useRef } from 'react';

/**
 * Structural equality for the small, plain configuration objects the viewer accepts as props.
 *
 * Functions and class constructors are compared by identity rather than structure, so a custom
 * trackball constructor is treated as a leaf.
 */
function isEquivalent(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => isEquivalent(item, b[index]));
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(bRecord, key) && isEquivalent(aRecord[key], bRecord[key])
  );
}

/**
 * Returns the previous value whenever the incoming one is structurally identical to it.
 *
 * Configuration props are naturally written as inline object literals, which get a fresh identity
 * on every render. Without this, anything keyed on their identity — such as the memoised scene
 * builder — would rebuild the scene on every render.
 */
export function useStableValue<T>(value: T): T {
  const ref = useRef(value);
  if (!isEquivalent(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}

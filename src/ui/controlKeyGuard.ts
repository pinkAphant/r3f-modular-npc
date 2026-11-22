import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'number',
]);

const RANGE_SELECT_NAV_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

export function shouldStopControlKeyPropagation(
  e: ReactKeyboardEvent<HTMLElement>
): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const type = ((target as HTMLInputElement).type || 'text').toLowerCase();
    if (TEXT_INPUT_TYPES.has(type)) return true;
    if (type === 'range') return RANGE_SELECT_NAV_KEYS.has(e.key);
    if (type === 'checkbox' || type === 'radio' || type === 'button' || type === 'submit') {
      return e.key === ' ' || e.key === 'Enter';
    }
    return false;
  }
  if (tag === 'SELECT') {
    return e.key !== 'Escape' && e.key !== 'Tab';
  }
  if (tag === 'BUTTON') {
    return e.key === ' ' || e.key === 'Enter';
  }
  return false;
}

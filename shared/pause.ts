import type { Role } from './types.js';

export const DEFAULT_PARTNER_PAUSE_MESSAGE = 'Dean is cooking something';

/**
 * The partner can keep a valid session while the museum stays hidden. The owner
 * is never paused, and turning the flag off reopens the partner's side.
 */
export function pausedMessageFor(role: Role, paused: boolean, message: string): string | null {
  if (!paused || role !== 'PARTNER') return null;
  return message.trim() || DEFAULT_PARTNER_PAUSE_MESSAGE;
}

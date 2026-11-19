import { describe, expect, it } from 'vitest';
import { DEFAULT_PARTNER_PAUSE_MESSAGE, pausedMessageFor } from '../../shared/pause';

describe('partner pause', () => {
  it('hides the museum from the partner while the flag is on', () => {
    expect(pausedMessageFor('PARTNER', true, 'Dean is cooking something')).toBe('Dean is cooking something');
  });

  it('never pauses the owner, even while the flag is on', () => {
    expect(pausedMessageFor('OWNER', true, 'Dean is cooking something')).toBeNull();
  });

  it('reopens the partner side when the flag is off', () => {
    expect(pausedMessageFor('PARTNER', false, 'Dean is cooking something')).toBeNull();
  });

  it('falls back to the default message when the configured one is blank', () => {
    expect(pausedMessageFor('PARTNER', true, '   ')).toBe(DEFAULT_PARTNER_PAUSE_MESSAGE);
  });

  it('trims a configured message before showing it', () => {
    expect(pausedMessageFor('PARTNER', true, '  Dinner soon  ')).toBe('Dinner soon');
  });
});

import { describe, expect, it } from 'vitest';
import { planHashPrefix, sanitizeLogFields } from './logger.js';

describe('logger', () => {
  it('redacts secret-like fields recursively', () => {
    const sanitized = sanitizeLogFields({
      event: 'discord_sync_apply_started',
      botToken: 'token-value',
      nested: {
        password: 'password-value',
        safe: 'guild-1',
      },
    });

    expect(JSON.stringify(sanitized)).not.toContain('token-value');
    expect(JSON.stringify(sanitized)).not.toContain('password-value');
    expect(sanitized).toMatchObject({
      botToken: '[redacted]',
      nested: { password: '[redacted]', safe: 'guild-1' },
    });
  });

  it('uses only a safe plan hash prefix for logs', () => {
    expect(planHashPrefix('a'.repeat(64))).toBe('a'.repeat(12));
  });
});

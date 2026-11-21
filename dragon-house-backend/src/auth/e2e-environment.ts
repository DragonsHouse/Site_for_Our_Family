import type { AppConfig } from '../config/env.js';

/**
 * Synthetic E2E sessions exist only in an explicit test process connected to the
 * dedicated E2E database. Every other environment fails closed.
 */
export function isE2eAuthEnvironment(config: Pick<AppConfig, 'nodeEnv' | 'e2eTestMode' | 'databaseUrl' | 'e2eDatabaseName'>): boolean {
  if (config.nodeEnv !== 'test' || !config.e2eTestMode) return false;
  if (!config.databaseUrl) return false;
  try {
    const databaseName = new URL(config.databaseUrl).pathname.replace(/^\/+/u, '');
    return databaseName === config.e2eDatabaseName && databaseName.includes('e2e');
  } catch {
    return false;
  }
}

/** True only for connections that originate on this machine; proxy headers are ignored on purpose. */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = address.startsWith('::ffff:') ? address.slice(7) : address;
  return normalized === '::1' || normalized === '127.0.0.1' || normalized.startsWith('127.');
}

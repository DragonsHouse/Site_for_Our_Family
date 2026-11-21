import { describe, expect, it } from 'vitest';
import { createTestConfig } from '../test/test-config.js';
import { isE2eAuthEnvironment, isLoopbackAddress } from './e2e-environment.js';

const e2eUrl = 'postgresql://user:pass@127.0.0.1:5432/dragon_house_e2e';

describe('E2E auth environment guard', () => {
  it('requires test mode, E2E flag and the dedicated E2E database together', () => {
    expect(isE2eAuthEnvironment(createTestConfig({ e2eTestMode: true, databaseUrl: e2eUrl }))).toBe(true);
    expect(isE2eAuthEnvironment(createTestConfig({ e2eTestMode: false, databaseUrl: e2eUrl }))).toBe(false);
    expect(isE2eAuthEnvironment(createTestConfig({ nodeEnv: 'development', e2eTestMode: true, databaseUrl: e2eUrl }))).toBe(false);
    expect(isE2eAuthEnvironment(createTestConfig({ nodeEnv: 'production', e2eTestMode: true, databaseUrl: e2eUrl }))).toBe(false);
    expect(isE2eAuthEnvironment(createTestConfig({ e2eTestMode: true, databaseUrl: null }))).toBe(false);
    expect(isE2eAuthEnvironment(createTestConfig({ e2eTestMode: true, databaseUrl: 'postgresql://user:pass@127.0.0.1:5432/dragon_house' }))).toBe(false);
    expect(isE2eAuthEnvironment(createTestConfig({ e2eTestMode: true, e2eDatabaseName: 'family', databaseUrl: 'postgresql://user:pass@127.0.0.1:5432/family' }))).toBe(false);
    expect(isE2eAuthEnvironment(createTestConfig({ e2eTestMode: true, databaseUrl: 'not a url' }))).toBe(false);
  });

  it('accepts only loopback peers', () => {
    for (const address of ['127.0.0.1', '127.0.1.5', '::1', '::ffff:127.0.0.1']) expect(isLoopbackAddress(address), address).toBe(true);
    for (const address of [undefined, '', '10.0.0.5', '192.168.1.20', '::ffff:10.0.0.5', 'fe80::1', '0.0.0.0']) expect(isLoopbackAddress(address), String(address)).toBe(false);
  });
});

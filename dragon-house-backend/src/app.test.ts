import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createTestConfig } from './test/test-config.js';

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];

async function getJson(path: string) {
  const config = createTestConfig();
  const { app } = createApp(config);
  const server = app.listen(0);
  servers.push(server);
  const address = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
  return { status: response.status, body: await response.json() };
}

async function getJsonWithPool(path: string, pgPool: { query: () => Promise<unknown> }) {
  const config = createTestConfig();
  const { app } = createApp(config, { pgPool: pgPool as never });
  const server = app.listen(0);
  servers.push(server);
  const address = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
  return { status: response.status, body: await response.json() };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

describe('api routes', () => {
  it('returns health without claiming Discord is connected', async () => {
    const result = await getJson('/api/health');

    expect(result.status).toBe(200);
    expect(result.body.discordConfigured).toBe(false);
    expect(result.body.discordConnected).toBe(false);
  });

  it('returns only public Discord config', async () => {
    const result = await getJson('/api/discord/config/public');

    expect(result.status).toBe(200);
    expect(result.body.connectionStatus).toBe('not_configured');
    expect(result.body.configuredChannelPurposes).toEqual([]);
    expect(result.body).not.toHaveProperty('clientSecret');
    expect(result.body).not.toHaveProperty('botToken');
  });

  it('returns disabled Discord status', async () => {
    const result = await getJson('/api/discord/status');

    expect(result.status).toBe(200);
    expect(result.body.status).toBe('not_configured');
    expect(result.body.lastConnectedAt).toBeNull();
  });

  it('returns database health success', async () => {
    const result = await getJsonWithPool('/health/database', { query: async () => ({ rows: [{ '?column?': 1 }] }) });

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: 'ok', database: 'connected' });
  });

  it('returns database health failure without secrets', async () => {
    const result = await getJsonWithPool('/health/database', {
      query: async () => {
        throw new Error('connection failed for password secret');
      },
    });

    expect(result.status).toBe(503);
    expect(result.body).toEqual({ status: 'error', database: 'unavailable' });
  });
});

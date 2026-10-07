import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_SKIP_E2E_DB_SETUP === 'true') return;
  const backendDir = resolve(process.cwd(), '..', 'dragon-house-backend');
  const databaseName = process.env.E2E_DATABASE_NAME ?? 'dragon_house_e2e';
  const sourceDatabaseUrl = process.env.DATABASE_URL ?? readBackendDatabaseUrl(backendDir);
  const databaseUrl = process.env.E2E_DATABASE_URL ?? buildE2eDatabaseUrl(sourceDatabaseUrl, databaseName);
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    E2E_TEST_MODE: 'true',
    E2E_DATABASE_NAME: databaseName,
    DATABASE_URL: databaseUrl,
    LOG_LEVEL: 'silent',
    DISCORD_SYNC_AUTO_ENABLED: 'false',
    DISCORD_ORCHESTRATION_ENABLED: 'false',
    DISCORD_TOWER_SYNC_ENABLED: 'false',
  };
  run('npm', ['run', 'e2e:db:reset'], backendDir, env);
  run('npm', ['run', 'e2e:db:setup'], backendDir, env);
}

function readBackendDatabaseUrl(backendDir: string): string | undefined {
  const envPath = resolve(backendDir, '.env');
  if (!existsSync(envPath)) return undefined;
  const match = readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.+)$/m);
  return match?.[1]?.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
}

function buildE2eDatabaseUrl(databaseUrl: string | undefined, databaseName: string): string {
  if (!databaseUrl) {
    return `postgresql://dragon_house:dragon_house@127.0.0.1:5433/${databaseName}`;
  }
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): void {
  const executable = process.platform === 'win32' && command === 'npm' ? 'cmd.exe' : command;
  const executableArgs =
    process.platform === 'win32' && command === 'npm' ? ['/d', '/s', '/c', [command, ...args].join(' ')] : args;
  const result = spawnSync(executable, executableArgs, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) {
    const reason = result.error ? `: ${result.error.message}` : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}${reason}`);
  }
}

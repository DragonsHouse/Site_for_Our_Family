import type { AppConfig } from '../config/env.js';

export type LogLevel = AppConfig['logLevel'];
export type LogFields = Record<string, unknown>;

const LEVEL_WEIGHT: Record<Exclude<LogLevel, 'silent'>, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY_PATTERN = /(authorization|cookie|password|secret|token|databaseurl|database_url|connectionstring)/iu;

export class AppLogger {
  constructor(private readonly config: Pick<AppConfig, 'logLevel' | 'logFormat' | 'nodeEnv'>) {}

  debug(event: string, fields: LogFields = {}): void {
    this.write('debug', event, fields);
  }

  info(event: string, fields: LogFields = {}): void {
    this.write('info', event, fields);
  }

  warn(event: string, fields: LogFields = {}): void {
    this.write('warn', event, fields);
  }

  error(event: string, fields: LogFields = {}): void {
    this.write('error', event, fields);
  }

  private write(level: Exclude<LogLevel, 'silent'>, event: string, fields: LogFields): void {
    if (!shouldLog(this.config.logLevel, level)) return;
    const payload = sanitizeLogFields({
      level,
      event,
      environment: this.config.nodeEnv,
      timestamp: new Date().toISOString(),
      ...fields,
    }) as LogFields;
    if (this.config.logFormat === 'json') {
      console.log(JSON.stringify(payload));
      return;
    }
    console.log(`${payload.timestamp} ${level.toUpperCase()} ${event} ${JSON.stringify(omitCoreFields(payload))}`);
  }
}

export function createLogger(config: Pick<AppConfig, 'logLevel' | 'logFormat' | 'nodeEnv'>): AppLogger {
  return new AppLogger(config);
}

export function sanitizeLogFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeLogFields(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, fieldValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeLogFields(fieldValue),
    ]),
  );
}

export function planHashPrefix(planHash: string | null | undefined): string | null {
  return planHash ? planHash.slice(0, 12) : null;
}

function shouldLog(configured: LogLevel, actual: Exclude<LogLevel, 'silent'>): boolean {
  if (configured === 'silent') return false;
  return LEVEL_WEIGHT[actual] >= LEVEL_WEIGHT[configured];
}

function omitCoreFields(fields: LogFields): LogFields {
  return Object.fromEntries(
    Object.entries(fields).filter(([key]) => !['level', 'event', 'environment', 'timestamp'].includes(key)),
  );
}

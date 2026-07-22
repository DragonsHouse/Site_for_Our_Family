import type { CorsOptions } from 'cors';
import type { AppConfig } from '../config/env.js';

function isLocalhostOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/u.test(origin);
}

export function createCorsOptions(config: AppConfig): CorsOptions {
  const extensionOrigin = config.frontendExtensionId
    ? `chrome-extension://${config.frontendExtensionId}`
    : null;

  return {
    origin(origin, callback) {
      if (!origin && config.nodeEnv !== 'production') {
        callback(null, true);
        return;
      }

      if (origin && extensionOrigin && origin === extensionOrigin) {
        callback(null, true);
        return;
      }

      if (origin && config.nodeEnv !== 'production' && isLocalhostOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: false,
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

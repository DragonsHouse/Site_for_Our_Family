import type { RequestHandler } from 'express';
import type { AppLogger } from '../logging/logger.js';

type RateLimitOptions = {
  name: string;
  limit: number;
  windowMs: number;
  keyPrefix?: string;
  logger?: AppLogger;
};

type RateBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateBucket>();

export function createAuthenticatedRateLimit(options: RateLimitOptions): RequestHandler {
  return (request, response, next) => {
    if (!request.familyAuth?.familyMemberId) {
      next();
      return;
    }

    const identity = request.familyAuth.familyMemberId;
    const key = `${options.keyPrefix ?? options.name}:${identity}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    const activeBucket = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + options.windowMs };

    if (activeBucket.count >= options.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((activeBucket.resetAt - now) / 1000));
      response.setHeader('Retry-After', String(retryAfterSeconds));
      response.setHeader('X-RateLimit-Limit', String(options.limit));
      response.setHeader('X-RateLimit-Remaining', '0');
      response.setHeader('X-RateLimit-Reset', new Date(activeBucket.resetAt).toISOString());
      options.logger?.warn('rate_limit_rejected', {
        limiter: options.name,
        familyMemberId: request.familyAuth.familyMemberId,
        retryAfterSeconds,
      });
      response.status(429).json({
        error: 'rate_limited',
        message: 'Too many requests. Try again later.',
        retryAfterSeconds,
      });
      return;
    }

    activeBucket.count += 1;
    buckets.set(key, activeBucket);
    response.setHeader('X-RateLimit-Limit', String(options.limit));
    response.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.limit - activeBucket.count)));
    response.setHeader('X-RateLimit-Reset', new Date(activeBucket.resetAt).toISOString());
    next();
  };
}

export function clearRateLimitBucketsForTests(): void {
  buckets.clear();
}

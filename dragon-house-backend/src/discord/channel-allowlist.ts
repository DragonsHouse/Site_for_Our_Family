import type { AppConfig } from '../config/env.js';

export function getAllowedChannelIds(config: AppConfig): Set<string> {
  return new Set(
    Object.values(config.discord.channels).filter(
      (channelId): channelId is string => typeof channelId === 'string' && channelId.length > 0,
    ),
  );
}

export function isAllowedChannel(config: AppConfig, channelId: string): boolean {
  return getAllowedChannelIds(config).has(channelId);
}

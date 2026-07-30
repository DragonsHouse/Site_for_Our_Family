export const DRAGON_THEME = {
  colors: {
    obsidian: 'var(--dragon-obsidian)',
    obsidianSoft: 'var(--dragon-obsidian-soft)',
    stone: 'var(--dragon-stone)',
    metal: 'var(--dragon-metal)',
    ember: 'var(--dragon-ember)',
    emberHot: 'var(--dragon-ember-hot)',
    gold: 'var(--dragon-gold)',
    text: 'var(--dragon-text)',
    textSoft: 'var(--dragon-text-soft)',
    textMuted: 'var(--dragon-text-muted)',
    success: 'var(--dragon-success)',
    danger: 'var(--dragon-danger)'
  },
  radius: {
    sm: 'var(--dragon-radius-sm)',
    md: 'var(--dragon-radius-md)',
    lg: 'var(--dragon-radius-lg)',
    xl: 'var(--dragon-radius-xl)'
  },
  shadow: {
    panel: 'var(--dragon-shadow-panel)',
    ember: 'var(--dragon-shadow-ember)',
    inset: 'var(--dragon-shadow-inset)'
  },
  motion: {
    fast: 'var(--dragon-motion-fast)',
    base: 'var(--dragon-motion-base)',
    slow: 'var(--dragon-motion-slow)',
    ambient: 'var(--dragon-motion-ambient)',
    easeOut: 'var(--dragon-ease-out)',
    easeSpring: 'var(--dragon-ease-spring)'
  }
} as const;

export type DragonBackgroundVariant =
  | 'login'
  | 'dashboard'
  | 'calendar'
  | 'members'
  | 'profile'
  | 'events'
  | 'achievements'
  | 'quests'
  | 'resources';

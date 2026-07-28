export const DRAGON_THEME = {
  colors: {
    obsidian: '#050403',
    obsidianSoft: '#100805',
    stone: '#241913',
    metal: '#2b211c',
    ember: '#ff5a00',
    emberHot: '#ff8b00',
    gold: '#d4af37',
    text: '#f8efe3',
    textSoft: '#c9b7a2',
    textMuted: '#8e7c6b',
    success: '#8fa66a',
    danger: '#f87171'
  },
  radius: {
    sm: '0.75rem',
    md: '1rem',
    lg: '1.25rem',
    xl: '1.5rem'
  },
  shadow: {
    panel: '0 28px 96px rgba(0, 0, 0, 0.68)',
    ember: '0 0 34px rgba(255, 91, 27, 0.2)',
    inset: 'inset 0 1px 0 rgba(255, 226, 180, 0.08)'
  },
  motion: {
    fast: '140ms',
    base: '220ms',
    slow: '420ms',
    ambient: '8000ms',
    easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
    easeSpring: 'cubic-bezier(0.2, 0.9, 0.2, 1.15)'
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

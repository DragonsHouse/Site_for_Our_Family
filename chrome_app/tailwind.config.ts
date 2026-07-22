import type { Config } from 'tailwindcss';

export default {
  content: ['./entrypoints/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f1f5f9',
          500: '#0f172a',
          600: '#0b1220',
          accent: '#f97316'
        }
      }
    }
  },
  plugins: []
} satisfies Config;

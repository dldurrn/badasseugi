import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        card: 'var(--card)',
        rule: 'var(--rule)',
        ink: { DEFAULT: 'var(--ink)', soft: 'var(--ink-soft)', faint: 'var(--ink-faint)' },
        grid: { DEFAULT: 'var(--grid)', deep: 'var(--grid-deep)', tint: 'var(--grid-tint)' },
        pen: { DEFAULT: 'var(--pen)', tint: 'var(--pen-tint)', deep: 'var(--pen-deep)' },
        gold: { DEFAULT: 'var(--gold)', tint: 'var(--gold-tint)' },
      },
      borderRadius: { DEFAULT: 'var(--radius)', sm: 'var(--radius-sm)' },
    },
  },
  plugins: [],
} satisfies Config;

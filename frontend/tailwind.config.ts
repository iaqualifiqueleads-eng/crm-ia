import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta principal (acromática + dourado discreto)
        onyx:      { DEFAULT: '#0A0A0B', 50: '#1A1A1D', 100: '#16161A' },
        carbon:    { DEFAULT: '#16161A', 50: '#1E1E22', 100: '#26262B' },
        graphite:  { DEFAULT: '#2A2A2F', 50: '#3A3A40' },
        smoke:     { DEFAULT: '#6C6C72' },
        platinum:  { DEFAULT: '#E8E6E1', 50: '#F2F0EB', 100: '#D9D6CF' },
        pearl:     { DEFAULT: '#FAFAF7' },
        champagne: { DEFAULT: '#C9A961', 50: '#D9BB7C', 100: '#B89548' },
        signal:    { DEFAULT: '#C8553D', soft: '#E8917F' },
        forest:    { DEFAULT: '#3D5A4A' }, // ok / sucesso discreto
      },
      fontFamily: {
        // Display = serif editorial; sans = neo-grotesque refinado
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans:    ['"Geist"', '"Inter"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
      },
      letterSpacing: {
        'micro': '0.18em',
      },
      borderRadius: {
        'sharp': '2px',
      },
      boxShadow: {
        'card':  '0 1px 0 rgba(10,10,11,0.04), 0 8px 24px -16px rgba(10,10,11,0.12)',
        'lift':  '0 24px 64px -32px rgba(10,10,11,0.25)',
        'inset-line': 'inset 0 -1px 0 rgba(10,10,11,0.08)',
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'shimmer': 'shimmer 2.4s linear infinite',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;

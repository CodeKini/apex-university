import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — replace these hex values to rebrand instantly
        navy: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#1e3a5f',  // primary navy
          800: '#152d4a',
          900: '#0d1f35',
          950: '#080f1a',
        },
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#d4a017',  // primary gold
          600: '#b8860b',
          700: '#92690a',
          800: '#6b4c07',
          900: '#3d2b04',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #0d1f35 0%, #1e3a5f 50%, #152d4a 100%)',
        'gold-gradient': 'linear-gradient(135deg, #d4a017 0%, #fbbf24 100%)',
        'card-gradient': 'linear-gradient(145deg, #152d4a 0%, #0d1f35 100%)',
      },
    },
  },
  plugins: [],
}

export default config

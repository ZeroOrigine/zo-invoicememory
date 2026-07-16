import type { Config } from 'tailwindcss'

// CANONICAL MERGED CONFIG. The last-written version dropped the success /
// warning / danger palettes used across every auth and billing component —
// those classes would silently not exist. This merge carries the full brand
// scale (landing) PLUS the semantic palettes (auth/billing), with content
// globs covering app, components, and lib.

const config: Config = {
  darkMode: 'media',
  content: [
    './app/**/*.{ts,tsx,js,jsx,mdx}',
    './components/**/*.{ts,tsx,js,jsx,mdx}',
    './lib/**/*.{ts,tsx,js,jsx,mdx}',
    './src/**/*.{ts,tsx,js,jsx,mdx}',
    './pages/**/*.{ts,tsx,js,jsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dce7fd',
          200: '#c1d3fc',
          300: '#96b6fa',
          400: '#638ef6',
          500: '#3f66f1',
          600: '#2748e8',
          700: '#1e36d0',
          800: '#1e2fa6',
          900: '#1e2c83',
          950: '#161d50',
        },
        success: { 50: '#effaf3', 100: '#d8f3e2', 500: '#22a35e', 700: '#177a45' },
        warning: { 50: '#fff8eb', 100: '#feefc7', 500: '#e79b13', 700: '#a86a08' },
        danger: { 50: '#fdf1f0', 100: '#fbdedb', 500: '#dc4437', 700: '#a92f25' },
      },
      boxShadow: {
        glow: '0 0 40px -12px rgb(39 72 232 / 0.4)',
      },
    },
  },
  plugins: [],
}

export default config

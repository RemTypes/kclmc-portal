import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0B0F17',
        foreground: '#F8FAFC',
        kclmc: {
          pine: '#041F1E',        // Deep Alpine Pine (Top bar, hero overlay)
          green: '#052322',       // Primary Club Green (from Instagram branding)
          forest: '#084746',      // Mid-tone Forest Green
          moss: '#0D5F5E',        // Accent & Border Green
          gold: '#FFBD59',        // Official Warm Summit Gold
          goldLight: '#FFE0A3',   // Interactive Gold Hover
          goldDark: '#E5A844',    // Muted Gold
          chalk: '#F8FAFC',       // Off-white Clean Surface
          sandstone: '#E2E8F0',   // Light Stone Borders
          slateText: '#1E293B',   // High-contrast readable body text
          darkText: '#0F172A',
        },
        kcl: {
          pine: '#041F1E',
          greenDark: '#052322',
          green: '#084746',
          greenLight: '#0D5F5E',
          gold: '#FFBD59',
          goldLight: '#FFE0A3',
          goldDark: '#E5A844',
          crimson: '#D40026',
          navy: '#142647',
        },
        lube: {
          black: '#0A0A0A',
          asphalt: '#121212',
          chalk: '#F5F5F0',
          electric: '#00FF66',
          tapeOrange: '#FF5500',
          tapePink: '#FF007F',
        }
      },
      fontFamily: {
        heading: ['var(--font-barlow-condensed)', 'sans-serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-bitter)', 'Georgia', 'Cambria', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config

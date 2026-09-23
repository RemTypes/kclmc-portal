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
        serif: ['var(--font-bitter)', 'Georgia', 'Cambria', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config

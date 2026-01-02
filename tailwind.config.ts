import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        void: '#0a0a0a',
        stone: '#171717',
        subtle: '#262626',
        muted: '#a3a3a3',
        cream: '#d4c4a8', // The Japandi Gold
      },
      // Crucial for the background gradients
      backgroundImage: {
        'cinematic': 'radial-gradient(circle at top, #171717 0%, #0a0a0a 100%)',
      },
    },
  },
  plugins: [],
}
export default config

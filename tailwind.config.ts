import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './index.html'],
  theme: {
    extend: {
      aspectRatio: {
        '9/16': '9 / 16'
      }
    }
  },
  plugins: []
}

export default config

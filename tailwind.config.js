/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        dark: {
          bg: '#0d0d0d',
          panel: '#1a1a1a',
          border: '#2a2a2a',
          hover: '#333333',
        },
        trade: {
          buy: '#1e4d2b',
          buyHover: '#2d5f3a',
          buyText: '#4ade80',
          sell: '#4d1e1e',
          sellHover: '#5f2d2d',
          sellText: '#f87171',
          neutral: '#1e3a5f',
          neutralHover: '#2d4a6f',
        }
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}

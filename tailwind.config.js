/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: '#D9D4C5',
        rule: '#C9C3B1',
        sheet: '#F4F0E6',
        ink: '#1E1D1A',
        muted: '#67635A',
        prussian: { DEFAULT: '#26449A', dark: '#1C3478' },
        sun: '#E9C45A',
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}

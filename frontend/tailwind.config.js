/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f6f7fb',
        ink: '#0f172a',
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        accent: {
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
        },
        hot: {
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
        },
      },
      boxShadow: {
        glow: '0 8px 32px -8px rgba(79, 70, 229, 0.18), 0 2px 8px -2px rgba(15, 23, 42, 0.06)',
      },
      fontFamily: {
        sans: [
          'Inter var',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}

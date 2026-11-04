/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        chat: {
          bg: '#f0f2f5',
          sidebar: '#ffffff',
          header: '#ffffff',
          'bubble-out': '#d9fdd3',
          'bubble-in': '#ffffff',
          input: '#f0f2f5',
        },
        dark: {
          bg: '#111b21',
          sidebar: '#111b21',
          header: '#202c33',
          'bubble-out': '#005c4b',
          'bubble-in': '#202c33',
          input: '#2a3942',
        },
      },
      animation: {
        'bounce-dot': 'bounce 1.4s infinite ease-in-out',
      },
    },
  },
  plugins: [],
};

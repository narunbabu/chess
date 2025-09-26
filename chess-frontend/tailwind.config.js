/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        secondary: {
          DEFAULT: '#10B981',
          500: '#10B981',
          600: '#059669',
        },
        accent: {
          DEFAULT: '#F59E0B',
          500: '#F59E0B',
          600: '#D97706',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#06B6D4',
      },
      fontFamily: {
        // Add a custom font family for kid-friendly typography
        'display': ['Nunito', ...defaultTheme.fontFamily.sans],
      },
      keyframes: {
        cardSlideIn: {
          '0%': {
            opacity: '0',
            transform: 'translateY(50px) scale(0.9)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) scale(1)',
          },
        },
      },
      animation: {
        'cardSlideIn': 'cardSlideIn 0.8s ease-out',
      },
    },
  },
  plugins: [],
}
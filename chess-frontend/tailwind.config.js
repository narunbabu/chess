/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  safelist: [
    'landscape',
    'full-bleed',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Surfaces ── */
        surface: {
          deepest:  '#1a1a18',
          base:     '#262421',
          card:     '#312e2b',
          elevated: '#3d3a37',
          hover:    '#4a4744',
        },
        /* ── Chess Green (Primary) ── */
        chess: {
          DEFAULT:  '#81b64c',
          green:    '#81b64c',
          board:    '#769656',
          pressed:  '#4e7837',
          hover:    '#a3d160',
          light:    '#eeeed2',
        },
        /* ── Gold / Premium ── */
        gold: {
          DEFAULT:  '#e8a93e',
          hover:    '#f4c66a',
          pressed:  '#c48b28',
        },
        /* ── Semantic ── */
        danger: {
          DEFAULT:  '#e74c3c',
          light:    '#fa6a5b',
        },
        info: {
          DEFAULT:  '#4a90d9',
          light:    '#6aabef',
        },
        /* ── Legacy aliases (keep for gradual migration) ── */
        primary: {
          DEFAULT: '#81b64c',
          50:  '#f3f9ec',
          100: '#e4f2d4',
          200: '#c9e6a9',
          300: '#a3d160',
          400: '#81b64c',
          500: '#769656',
          600: '#4e7837',
          700: '#3d5f2b',
          800: '#2d4520',
          900: '#1e2f15',
        },
        secondary: {
          DEFAULT: '#e8a93e',
          50:  '#fdf8eb',
          100: '#faedd0',
          200: '#f4dba1',
          300: '#f4c66a',
          400: '#e8a93e',
          500: '#c48b28',
          600: '#9e6f20',
          700: '#7a5618',
          800: '#5c4012',
          900: '#3d2b0c',
        },
        accent: {
          DEFAULT: '#e8a93e',
        },
        success: {
          DEFAULT: '#81b64c',
          50:  '#f3f9ec',
          100: '#e4f2d4',
          200: '#c9e6a9',
          500: '#81b64c',
          600: '#4e7837',
          700: '#3d5f2b',
        },
        warning: {
          DEFAULT: '#e8a93e',
          50:  '#fdf8eb',
          100: '#faedd0',
          500: '#e8a93e',
          600: '#c48b28',
        },
        error: {
          DEFAULT: '#e74c3c',
          50:  '#fdf2f1',
          100: '#fce4e2',
          500: '#e74c3c',
          600: '#c0392b',
          700: '#a93226',
        },
      },
      fontFamily: {
        'display': ['Inter', ...defaultTheme.fontFamily.sans],
        'sans': ['Inter', ...defaultTheme.fontFamily.sans],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
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
        float: {
          '0%, 100%': {
            transform: 'translateY(0)',
          },
          '50%': {
            transform: 'translateY(-20px)',
          },
        },
        fadeIn: {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },
        fadeInUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(12px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        slideInRight: {
          '0%': {
            transform: 'translateX(100%)',
            opacity: '0',
          },
          '100%': {
            transform: 'translateX(0)',
            opacity: '1',
          },
        },
        pulseGlow: {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(129, 182, 76, 0.4)',
          },
          '50%': {
            boxShadow: '0 0 0 8px rgba(129, 182, 76, 0)',
          },
        },
      },
      animation: {
        'cardSlideIn': 'cardSlideIn 0.8s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'fadeIn': 'fadeIn 0.5s ease-in',
        'fadeInUp': 'fadeInUp 0.4s ease forwards',
        'slideInRight': 'slideInRight 0.5s ease-out',
        'pulseGlow': 'pulseGlow 2s ease-in-out infinite',
      },
      boxShadow: {
        'soft': '0 2px 15px rgba(0, 0, 0, 0.15)',
        'hard': '0 4px 20px rgba(0, 0, 0, 0.25)',
        'card': '0 4px 12px rgba(0, 0, 0, 0.35)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.4)',
        'glow-green': '0 0 20px rgba(129, 182, 76, 0.3)',
        'glow-gold': '0 0 20px rgba(232, 169, 62, 0.3)',
      },
    },
  },
  plugins: [],
}

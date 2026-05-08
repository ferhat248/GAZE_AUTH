/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#050510',
        bg2: '#0d0d20',
        indigo: { DEFAULT: '#6366f1', light: '#818cf8' },
        violet: { DEFAULT: '#8b5cf6', light: '#a78bfa' },
        cyan: { DEFAULT: '#06b6d4' },
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%':       { opacity: 0.7, transform: 'scale(1.08)' },
        },
        fadeIn: {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

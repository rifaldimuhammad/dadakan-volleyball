export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Clash Display', 'Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        ink: {
          DEFAULT: '#0f1222',
          soft: '#2a2d42',
          muted: '#6b7090',
        },
        canvas: '#f4f5fb',
        court: {
          50: '#eef4ff',
          100: '#dbe6ff',
          500: '#3b63ff',
          600: '#2b4ff0',
          700: '#1f3bd4',
        },
        sun: {
          400: '#ffb43b',
          500: '#ff9d1c',
        },
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgba(15,18,34,0.08), 0 8px 24px -8px rgba(15,18,34,0.10)',
        lift: '0 8px 28px -6px rgba(15,18,34,0.18)',
        glow: '0 10px 40px -8px rgba(59,99,255,0.45)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pop': {
          '0%': { transform: 'scale(.8)', opacity: '0' },
          '60%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.22,1,.36,1) both',
        'sheet-up': 'sheet-up .35s cubic-bezier(.22,1,.36,1) both',
        'scale-in': 'scale-in .25s cubic-bezier(.22,1,.36,1) both',
        pop: 'pop .4s cubic-bezier(.34,1.56,.64,1) both',
      },
    },
  },
  plugins: [],
}

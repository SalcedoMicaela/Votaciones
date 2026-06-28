/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verde institucional ESPE
        espe: {
          50: '#eaf6ee',
          100: '#cfead9',
          200: '#a3d6b8',
          300: '#6fbd90',
          400: '#3fa069',
          500: '#1f8a4c',
          600: '#147a40',
          700: '#0f6334',
          800: '#0d4f2b',
          900: '#0b4124',
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

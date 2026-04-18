/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  prefix: 'ew-',
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        embed: {
          accent: '#0284c7',
          accentHover: '#0369a1',
        },
      },
    },
  },
  plugins: [],
};

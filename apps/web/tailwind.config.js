/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ee',
          100: '#d7ecda',
          500: '#2e7d32',
          600: '#256b29',
          700: '#1e5522',
        },
      },
    },
  },
  plugins: [],
};

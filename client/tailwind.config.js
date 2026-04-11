/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8eef5',
          100: '#c5d4e6',
          500: '#1F4E79',
          600: '#1a4268',
          700: '#153556',
          800: '#102845',
          900: '#0b1b33',
        },
        amber: {
          accent: '#C65911',
          light: '#e06b14',
          dark: '#a34a0e',
        }
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,css}",
  ],
  safelist: [
    'bg-gray-800',
    'bg-gray-700',
    'text-white',
    'text-gray-300',
    'text-red-400',
    'text-blue-400'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} 
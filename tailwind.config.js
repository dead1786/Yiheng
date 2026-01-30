/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // ← 這是關鍵！
  theme: {
    extend: {},
  },
  plugins: [],
}
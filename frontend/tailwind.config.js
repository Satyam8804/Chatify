/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    "bg-blue-500",
    "bg-red-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-yellow-500",
    "bg-teal-500",

    "text-blue-500",
    "text-red-500",
    "text-green-500",
    "text-purple-500",
    "text-pink-500",
    "text-indigo-500",
    "text-yellow-500",
    "text-teal-500",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

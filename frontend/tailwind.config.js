/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#e5eef4", // MMT light blue-grey background
          card: "#ffffff", // pure white cards
          border: "#dfdfdf", // light line dividers
          primary: "#0a2240", // MMT signature dark blue
          secondary: "#008cff", // MMT bright blue links
          accent: "#ff5f00", // MMT hot orange for CTAs/Search buttons
          text: "#1a1a1a", // high contrast dark text
          muted: "#666666", // grey text
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        }
      }
    },
  },
  plugins: [],
}

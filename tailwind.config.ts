import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#17171c",
        cream: "#f7f4ee",
        coral: "#f06449",
        violet: "#6558d3",
        mint: "#b8e6d2"
      },
      boxShadow: {
        card: "0 18px 50px rgba(29, 27, 40, 0.10)"
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-6px)" },
          "75%": { transform: "translateX(6px)" }
        }
      },
      animation: { shake: "shake .25s ease-in-out" }
    }
  },
  plugins: []
} satisfies Config;

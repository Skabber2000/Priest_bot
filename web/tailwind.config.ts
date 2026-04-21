import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', '"EB Garamond"', "Georgia", "serif"],
        display: ['"Cinzel"', '"Cormorant Garamond"', "Georgia", "serif"],
      },
      colors: {
        parchment: "#d9c9a8",
        altar: "#0a0a0d",
        ember: "#c77a3f",
        stained: "#6b2a6b",
      },
      animation: {
        flicker: "flicker 7s infinite alternate",
        "subtle-pan": "subtle-pan 40s ease-in-out infinite alternate",
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "0.9" },
          "25%": { opacity: "1" },
          "55%": { opacity: "0.82" },
          "80%": { opacity: "0.96" },
        },
        "subtle-pan": {
          "0%": { transform: "scale(1.02) translate(-0.4%, -0.3%)" },
          "100%": { transform: "scale(1.04) translate(0.4%, 0.3%)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
